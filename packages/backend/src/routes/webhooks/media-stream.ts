import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import websocket from '@fastify/websocket';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { calls as callsTable, aiCallSessions, workspaces as workspacesTable } from '../../db/schema.js';
import * as callService from '../../services/call.service.js';
import * as workspaceService from '../../services/workspace.service.js';
import * as telephonyService from '../../services/telephony.service.js';
import { createSTTProvider } from '../../services/stt.service.js';
import { createTTSProvider } from '../../services/tts.service.js';
import { createLLMProvider } from '../../services/llm.service.js';
import { decrypt } from '../../lib/crypto.js';
import { env } from '../../config/env.js';
import { registerSession, unregisterSession } from '../../services/active-sessions.service.js';
import { calculateLLMCost, calculateTTSCost, calculateSTTCost, calculateTelephonyCost } from '../../config/pricing.js';
import type { DeepgramSTT } from '../../services/stt.service.js';
import type { Call } from '../../models/types.js';
import { getIo } from '../../realtime/io.js';
import { callEvents } from '../../realtime/call-events.js';
import { redis } from '../../config/redis.js';
import { SandboxSession, type SandboxMode } from '../../services/sandbox-session.service.js';
import { verifyJWT } from '../../lib/jwt.js';
import { verifyStreamToken } from '../../lib/stream-token.js';
import { workspaceMembers } from '../../db/schema.js';
import pino from 'pino';

const logger = pino({ name: 'media-stream' });

// Max concurrent browser sandbox sessions per workspace. Bounds the
// check-then-act budget race so a burst of parallel sockets can't all read
// "budget available" at once and amplify platform-billed Grok spend.
const SANDBOX_MAX_CONCURRENT = 2;

/** Convert PCM 16-bit 24kHz to mulaw 8kHz (Twilio format) */
export function pcmToMulaw(pcmBuf: Buffer): Buffer {
  // Downsample 24kHz → 8kHz (take every 3rd sample)
  const samples16 = new Int16Array(pcmBuf.buffer, pcmBuf.byteOffset, pcmBuf.length / 2);
  const downsampled = new Int16Array(Math.floor(samples16.length / 3));
  for (let i = 0; i < downsampled.length; i++) {
    downsampled[i] = samples16[i * 3];
  }
  // Encode to mulaw
  const mulaw = Buffer.alloc(downsampled.length);
  for (let i = 0; i < downsampled.length; i++) {
    let sample = downsampled[i];
    const sign = sample < 0 ? 0x80 : 0;
    if (sample < 0) sample = -sample;
    sample = Math.min(sample, 32635);
    sample += 0x84;
    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    mulaw[i] = ~(sign | (exponent << 4) | mantissa) & 0xFF;
  }
  return mulaw;
}

// Retained as an always-empty stub: the AI-agent orchestrator was removed in the
// translator-only split, but getActiveOrchestrator() is still referenced by
// socket-server / call-takeover, which now simply find nothing and no-op.
const activeOrchestrators = new Map<string, any>();
const activeTranslators = new Map<string, { feedAudio: (buf: Buffer) => void; stop: () => void; translateText?: (text: string) => void; flushTranslation?: () => void }>();

interface ManualSession {
  calleeStt: import('../../services/stt.service.js').STTProvider;    // outbound track — person on the other end
  operatorStt: import('../../services/stt.service.js').STTProvider;  // inbound track — operator in browser
  transcript: Array<{ speaker: string; text: string; timestamp: string }>;
  callId: string;
  calleeCallSid?: string; // Twilio SID for callee call (to hang up)
  sessionId?: string;
  workspaceId: string;
  saved: boolean;
  stop: () => void;
}
const activeManualSessions = new Map<string, ManualSession>();

interface VoiceTranslateSession {
  operatorSocket: import('ws').WebSocket;
  operatorStreamSid: string;
  grokWs: import('ws').WebSocket | null; // Grok Voice Agent WebSocket
  calleeSocket: import('ws').WebSocket | null;
  calleeStreamSid: string | null;
  calleeStt: import('../../services/stt.service.js').STTProvider | null;
  calleeCallSid: string | null; // Twilio SID for callee call (to hang up)
  workspaceId: string;
  transcript: Array<{ speaker: string; text: string; timestamp: string }>;
  sessionId?: string;
  pttActive: boolean;
  sequentialMode: boolean;
  translationEnabled: boolean;
  saved: boolean;
  safetyTimer?: ReturnType<typeof setTimeout>;
  // Grok event accumulators
  currentInputTranscript: string;
  currentOutputTranscript: string;
  pttAudioBuffer: Buffer[];
}
const activeVoiceTranslateSessions = new Map<string, VoiceTranslateSession>();

export function getActiveTranslators() { return activeTranslators; }
export function getActiveVoiceTranslateSessions() { return activeVoiceTranslateSessions; }
export function getActiveManualSessions() { return activeManualSessions; }

// Conference translators (Grok Voice Agent) — indexed by callId
const activeConferenceTranslators = new Map<string, any>();
export function getActiveConferenceTranslators() { return activeConferenceTranslators; }

// PTT audio buffer flush callbacks (registered per call, called when PTT released)
const pttFlushCallbacks = new Map<string, () => void>();

// Safety-net timers for manual sessions
const manualSafetyTimers = new Map<string, ReturnType<typeof setTimeout>>();

/* ------------------------------------------------------------------ */
/*  Idempotent finalize functions — called from stop/close/error/timer */
/* ------------------------------------------------------------------ */

async function finalizeVTSession(callId: string): Promise<void> {
  const vt = activeVoiceTranslateSessions.get(callId);
  if (!vt || vt.saved) return;
  vt.saved = true;

  if (vt.safetyTimer) { clearTimeout(vt.safetyTimer); vt.safetyTimer = undefined; }
  try { vt.grokWs?.close(); } catch { /* ignore */ }
  try { if (vt.calleeStt) vt.calleeStt.close(); } catch { /* ignore */ }

  if (vt.sessionId) {
    try {
      const [callRow] = await db.select({ connected_at: callsTable.connected_at }).from(callsTable).where(eq(callsTable.id, callId));
      const durationSecs = callRow?.connected_at
        ? Math.floor((Date.now() - new Date(callRow.connected_at).getTime()) / 1000) : 0;
      const durationMins = durationSecs / 60;
      const costGrok = durationMins * 0.05;
      const costTelephony = calculateTelephonyCost('twilio', durationMins) * 2;

      const { finalizeSession } = await import('../../services/session-finalizer.service.js');
      await finalizeSession({
        callId, workspaceId: vt.workspaceId, sessionId: vt.sessionId,
        transcript: vt.transcript,
        costs: { stt: costGrok, llm: 0, tts: 0, telephony: costTelephony, sttProvider: 'xai' },
        durationSecs,
      });
    } catch (err) {
      logger.error({ err, callId }, 'Failed to finalize VT session');
    }
  }

  if (vt.calleeCallSid) {
    telephonyService.hangupCall(vt.workspaceId, vt.calleeCallSid).catch((err: unknown) => {
      logger.warn({ err, callId }, 'Failed to hangup callee');
    });
  }

  activeVoiceTranslateSessions.delete(callId);
  unregisterSession(callId).catch(() => {});
  pttFlushCallbacks.delete(callId);
}

async function finalizeManualSession(callId: string): Promise<void> {
  const ms = activeManualSessions.get(callId);
  if (!ms || ms.saved) return;
  ms.saved = true;

  const timer = manualSafetyTimers.get(callId);
  if (timer) { clearTimeout(timer); manualSafetyTimers.delete(callId); }
  try { ms.calleeStt.close(); } catch { /* ignore */ }
  try { ms.operatorStt.close(); } catch { /* ignore */ }

  if (ms.sessionId) {
    try {
      const [callRow] = await db.select({ connected_at: callsTable.connected_at, metadata: callsTable.metadata })
        .from(callsTable).where(eq(callsTable.id, callId));
      const durationSecs = callRow?.connected_at
        ? Math.floor((Date.now() - new Date(callRow.connected_at).getTime()) / 1000) : 0;
      const durationMins = durationSecs / 60;
      const sttProv = (callRow?.metadata as import('../../models/types.js').CallMetadata)?.stt_provider ?? 'deepgram';
      const costStt = calculateSTTCost(sttProv, durationMins) * 2;
      const costTelephony = calculateTelephonyCost('twilio', durationMins);

      const { finalizeSession } = await import('../../services/session-finalizer.service.js');
      await finalizeSession({
        callId, workspaceId: ms.workspaceId, sessionId: ms.sessionId,
        transcript: ms.transcript,
        costs: { stt: costStt, llm: 0, tts: 0, telephony: costTelephony, sttProvider: sttProv },
        durationSecs,
      });
    } catch (err) {
      logger.error({ err, callId }, 'Failed to finalize manual session');
    }
  }

  activeManualSessions.delete(callId);
  unregisterSession(callId).catch(() => {});
}
export function registerPttFlush(callId: string, cb: () => void | Promise<void>) { pttFlushCallbacks.set(callId, cb); }
export function flushPttAudio(callId: string): void | Promise<void> { return pttFlushCallbacks.get(callId)?.(); }

export function getActiveOrchestrator(callId: string): any {
  return activeOrchestrators.get(callId);
}

const CORRECTION_MODELS: Record<string, string> = {
  xai: 'grok-3-mini-fast',
  openai: process.env.OPENAI_OAUTH_PROXY_URL ? 'gpt-5.4-mini' : 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-5-20250514',
};

async function correctOperatorSpeech(
  callId: string,
  text: string,
  llm: import('../../services/llm.service.js').LLMProvider,
  providerName: string,
): Promise<void> {
  const model = CORRECTION_MODELS[providerName] ?? 'gpt-4o-mini';

  const messages: import('../../services/llm.service.js').LLMMessage[] = [
    {
      role: 'system',
      content: `You help correct English speech during phone calls. The user said something aloud.
If the English is imperfect or unnatural, suggest a more natural way to say it.
If it's already good natural English, return exactly: {"corrected":null}
Return JSON only: {"corrected": "better version" | null, "explanation": "brief note"}`,
    },
    { role: 'user', content: `"${text}"` },
  ];

  let result = '';
  await new Promise<void>((resolve) => {
    llm.generateStream(messages, model, 0.3, {
      onToken: (token: string) => { result += token; },
      onComplete: () => resolve(),
      onError: (err: Error) => {
        logger.error({ err, callId }, 'Correction LLM error');
        resolve();
      },
    });
  });

  if (!result.trim()) return;

  let parsed: { corrected: string | null; explanation?: string };
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    logger.warn({ callId, raw: result }, 'Failed to parse correction JSON');
    return;
  }

  if (!parsed.corrected) return;

  const io = getIo();
  if (!io) return;

  io.to(`call:${callId}`).emit('call:speech-correction', {
    call_id: callId,
    original: text,
    corrected: parsed.corrected,
    explanation: parsed.explanation ?? null,
    timestamp: new Date().toISOString(),
  });

  logger.debug({ callId, original: text, corrected: parsed.corrected }, 'Speech correction emitted');
}

const mediaStreamRoutes: FastifyPluginAsync = async (app) => {
  await app.register(websocket);

  // Track active external sessions by callId so external WS can find them

  /* ----------------------------------------------------------------- */
  /*  Online Sandbox (AI-trainer) — Twilio-free browser ↔ Grok bridge.   */
  /*  Login-only (dashboard feature): the client sends its JWT as the    */
  /*  first {type:'start'} message (keeps the token out of the URL).     */
  /* ----------------------------------------------------------------- */
  app.get('/sandbox', { websocket: true }, async (socket) => {
    const send = (obj: Record<string, unknown>) => {
      if (socket.readyState === 1) socket.send(JSON.stringify(obj));
    };

    let session: SandboxSession | null = null;
    let authed = false;
    let sandboxConcKey: string | null = null;

    const authTimer = setTimeout(() => {
      if (!authed) { send({ type: 'error', message: 'auth timeout' }); socket.close(); }
    }, 6000);
    const ping = setInterval(() => { if (socket.readyState === 1) socket.ping(); }, 30000);

    const cleanup = () => {
      clearTimeout(authTimer);
      clearInterval(ping);
      // Release the per-workspace concurrency slot reserved at session start.
      if (sandboxConcKey) { redis.decr(sandboxConcKey).catch(() => {}); sandboxConcKey = null; }
      session?.finalize().catch(() => {});
    };
    socket.on('close', cleanup);
    socket.on('error', cleanup);

    socket.on('message', async (data: Buffer) => {
      // Once authed, every message is audio for the live session.
      if (authed) { session?.handleBrowserMessage(data); return; }

      // First message must be {type:'start', token, mode, lang}.
      let msg: any;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg.type !== 'start') return;

      // Authenticate via JWT → resolve the user's workspace.
      let workspaceId: string;
      try {
        const payload = await verifyJWT(String(msg.token || ''));
        const [row] = await db.select({ workspace_id: workspaceMembers.workspace_id })
          .from(workspaceMembers)
          .where(eq(workspaceMembers.user_id, payload.sub))
          .limit(1);
        if (!row) { send({ type: 'error', message: 'unauthorized' }); socket.close(); return; }
        workspaceId = row.workspace_id;
      } catch {
        send({ type: 'error', message: 'unauthorized' }); socket.close(); return;
      }

      authed = true;
      clearTimeout(authTimer);

      const mode = (['echo', 'simulation', 'support'].includes(msg.mode) ? msg.mode : 'echo') as SandboxMode;
      const lang = (typeof msg.lang === 'string' ? msg.lang : 'ru').slice(0, 8);

      // Daily per-workspace budget (SANDBOX_MAX_SECONDS total per day).
      // Fail CLOSED: this bridges to the platform's metered xAI key, so a Redis
      // outage must not turn into an unbounded free-for-all on the admin's bill.
      const rlKey = `sandbox:used:${workspaceId}`;
      let used = 0;
      try {
        used = parseInt((await redis.get(rlKey)) || '0', 10) || 0;
      } catch {
        send({ type: 'error', message: 'unavailable' }); socket.close(); return;
      }
      const remaining = Math.max(0, env.SANDBOX_MAX_SECONDS - used);
      if (remaining <= 0) { send({ type: 'limit', remainingSeconds: 0 }); socket.close(); return; }

      // Reserve a concurrency slot atomically (INCR). Without this the budget
      // read above is a check-then-act race: many sockets opened together all
      // see used=0 and each start a full session, blowing past the daily cap.
      const concKey = `sandbox:active:${workspaceId}`;
      try {
        const active = await redis.incr(concKey);
        await redis.expire(concKey, 3600); // self-heal if a finalizer is ever missed
        if (active > SANDBOX_MAX_CONCURRENT) {
          await redis.decr(concKey).catch(() => {});
          send({ type: 'limit', remainingSeconds: remaining, reason: 'too_many_sessions' }); socket.close(); return;
        }
        sandboxConcKey = concKey; // released in cleanup()
      } catch {
        send({ type: 'error', message: 'unavailable' }); socket.close(); return;
      }
      send({ type: 'session', remainingSeconds: remaining });

      session = new SandboxSession({ browserWs: socket as any, workspaceId, mode, lang, maxSeconds: remaining });
      session.setOnFinalize(async (durationSecs) => {
        try { await redis.incrby(rlKey, durationSecs); await redis.expire(rlKey, 86400); } catch { /* non-critical */ }
      });
      try {
        await session.start();
      } catch (err) {
        logger.error({ err }, 'Sandbox session start failed');
        send({ type: 'error', message: 'Failed to start session' });
        socket.close();
      }
    });
  });

  app.get('/media-stream/:callId', { websocket: true }, async (socket, request) => {
    const rawCallId = (request.params as any).callId as string;
    const isCalleeLeg = rawCallId.endsWith('-callee');
    const callId = isCalleeLeg ? rawCallId.replace('-callee', '') : rawCallId;
    z.string().uuid().parse(callId); // validate

    // --- Callee leg for voice translate mode ---
    if (isCalleeLeg) {
      logger.info({ callId }, 'Voice translate callee leg WebSocket connected');

      // WebSocket keepalive ping to prevent Cloudflare/proxy idle timeout
      const calleePingInterval = setInterval(() => {
        if (socket.readyState === 1) socket.ping();
      }, 30000);
      socket.on('close', () => clearInterval(calleePingInterval));

      let calleeStreamSid: string | null = null;
      let calleeAuthed = false;

      socket.on('message', async (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());

          // Ignore everything until a token-verified 'start' — an unauthenticated
          // socket must not be able to inject 'media' into a live session.
          if (!calleeAuthed && msg.event !== 'start') return;

          if (msg.event === 'start') {
            if (!verifyStreamToken(rawCallId, msg.start?.customParameters?.token)) {
              logger.warn({ rawCallId }, 'media-stream callee WS rejected — invalid/missing stream token');
              socket.close();
              return;
            }
            calleeAuthed = true;
            calleeStreamSid = msg.start.streamSid;
            const session = activeVoiceTranslateSessions.get(callId);
            if (session) {
              session.calleeSocket = socket as any;
              session.calleeStreamSid = calleeStreamSid;

              // Create callee STT for transcription
              const [call] = await db.select().from(callsTable).where(eq(callsTable.id, callId));
              const meta = call?.metadata as any;
              const calleeLang = meta?.translate_to_language ?? 'en';
              const sttProviderName = (meta?.stt_provider ?? 'deepgram') as 'deepgram' | 'openai';

              session.calleeStt = await createSTTProvider(call!.workspace_id, sttProviderName);
              const io = getIo();

              let calleeAccum = '';
              session.calleeStt.on('transcript', (evt: import('../../services/stt.service.js').TranscriptEvent) => {
                const text = evt.text.trim();
                if (!text) return;

                if (!evt.isFinal) {
                  // Interim → show raw transcript in UI immediately. Non-volatile
                  // because socket.io is forced onto polling (CF Tunnel breaks WS),
                  // and volatile would drop deltas that land between poll requests.
                  if (io) {
                    io.to(`call:${callId}`).emit('call:transcript', {
                      call_id: callId, speaker: 'caller', text: calleeAccum ? calleeAccum + ' ' + text : text,
                      timestamp: new Date().toISOString(), isFinal: false,
                    });
                  }
                  return;
                }

                // Final segment → accumulate (save only on utterance_end for clean transcript)
                calleeAccum += (calleeAccum ? ' ' : '') + text;

                // Translate each final segment right away (don't wait for utterance_end)
                const translator = activeTranslators.get(callId);
                if (translator?.translateText) translator.translateText(text);
                if (translator?.flushTranslation) translator.flushTranslation();
              });
              session.calleeStt.on('utterance_end', () => {
                const text = calleeAccum.trim();
                calleeAccum = '';
                if (!text) return;

                // Save complete utterance to transcript (not individual segments)
                session.transcript.push({ speaker: 'caller', text, timestamp: new Date().toISOString() });

                // Emit final transcript for UI display
                logger.info({ callId, speaker: 'caller', text: text.slice(0, 50) }, 'Callee transcript emitted');
                if (io) {
                  io.to(`call:${callId}`).emit('call:transcript', {
                    call_id: callId, speaker: 'caller', text,
                    timestamp: new Date().toISOString(), isFinal: true,
                  });
                }
              });
              session.calleeStt.on('error', (err: Error) => logger.error({ err, callId }, 'Callee STT error'));
              session.calleeStt.connect({ language: calleeLang === 'auto' ? undefined : calleeLang });

              logger.info({ callId, calleeStreamSid }, 'Callee leg stream started');

              // Notify frontend that callee answered (for timer start)
              if (io) {
                io.to(`call:${callId}`).emit('call:status', { call_id: callId, status: 'in_progress' });
              }
            }
          }

          if (msg.event === 'media' && msg.media?.payload) {
            const audioBuffer = Buffer.from(msg.media.payload, 'base64');
            const session = activeVoiceTranslateSessions.get(callId);
            if (session) {
              // Send callee audio to STT
              if (session.calleeStt) session.calleeStt.sendAudio(audioBuffer);

              // Forward callee audio to operator via Socket.IO (so operator can hear)
              const io = getIo();
              if (io) {
                io.to(`call:${callId}:audio`).volatile.emit('call:audio', {
                  source: 'caller',
                  payload: msg.media.payload,
                });
              }

              // Also forward callee audio to operator's Twilio stream (so they hear in browser)
              if (session.operatorSocket && session.operatorStreamSid) {
                session.operatorSocket.send(JSON.stringify({
                  event: 'media',
                  streamSid: session.operatorStreamSid,
                  media: { payload: msg.media.payload },
                }));
              }
            }
          }

          if (msg.event === 'stop') {
            const session = activeVoiceTranslateSessions.get(callId);
            if (session?.calleeStt) session.calleeStt.close();
          }
        } catch (err) {
          logger.error({ err, callId }, 'Error in callee leg WebSocket');
        }
      });

      socket.on('close', () => {
        logger.info({ callId }, 'Voice translate callee leg WebSocket closed');
        const session = activeVoiceTranslateSessions.get(callId);
        if (session) {
          if (session.calleeStt) session.calleeStt.close();
          // Close operator WebSocket → triggers operator close handler which saves everything
          if (session.operatorSocket && session.operatorSocket.readyState === 1) {
            session.operatorSocket.close();
          }
        }
      });

      return; // Don't fall through to main handler
    }

    logger.info({ callId }, 'Twilio MediaStream WebSocket connected');

    // WebSocket keepalive ping to prevent Cloudflare/proxy idle timeout
    const pingInterval = setInterval(() => {
      if (socket.readyState === 1) socket.ping();
    }, 30000);
    socket.on('close', () => clearInterval(pingInterval));

    let streamSid: string | null = null;
    let streamAuthed = false;

    socket.on('message', async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        // Ignore everything until a token-verified 'start' — an unauthenticated
        // socket must not be able to inject 'media' into an active session.
        if (!streamAuthed && msg.event !== 'start') return;

        if (msg.event === 'start') {
          // Authenticate the stream before any billable work: the signed token
          // arrives as a Twilio <Parameter> (query strings are stripped by
          // Twilio) and must match this exact stream id. Verified end-to-end on a
          // live Twilio translator call ("media-stream stream-token OK") — valid
          // tokens pass, so enforcement only rejects forged/missing-token sockets.
          if (!verifyStreamToken(rawCallId, msg.start?.customParameters?.token)) {
            logger.warn({ rawCallId }, 'media-stream WS rejected — invalid/missing stream token');
            socket.close();
            return;
          }
          streamAuthed = true;
          streamSid = msg.start.streamSid;
          logger.info({ callId, streamSid }, 'Stream started');

          const [call] = await db.select().from(callsTable).where(eq(callsTable.id, callId));

          if (!call) {
            logger.error({ callId }, 'Call not found');
            socket.close();
            return;
          }

          await callService.updateCallStatus(callId, 'in_progress');

          // --- Conference Translator call ---
          const callMeta = call.metadata as import('../../models/types.js').CallMetadata;
          if (callMeta?.call_type === 'translator') {
            const callerWsId = callMeta.caller_workspace_id;
            logger.info({ callId, callerWsId }, 'Translator call — starting conference translator');
            try {
              const { workspaces: wsTable } = await import('../../db/schema.js');

              // Load caller workspace settings
              const [callerWs] = await db.select({ translator_defaults: wsTable.translator_defaults })
                .from(wsTable).where(eq(wsTable.id, callerWsId || call.workspace_id));
              const wsDefs = (callerWs?.translator_defaults as Record<string, string>) || {};

              // Guard against unconfigured or identical languages — would make Grok
              // "translate" from/to the same language and just echo the input.
              let myLanguage = wsDefs.my_language || 'ru';
              let targetLanguage = wsDefs.target_language || 'en';
              if (myLanguage === targetLanguage) {
                const fallback = myLanguage === 'en' ? 'ru' : 'en';
                logger.warn({ callId, myLanguage, targetLanguage, fallback },
                  'Translator languages identical — using fallback pair');
                targetLanguage = fallback;
              }

              const { ConferenceTranslator, DEFAULT_GREETING } = await import('../../services/conference-translator.js');
              // Greeting precedence: per-call meta → workspace setting →
              // admin-configured platform default → hardcoded fallback.
              const { getStringSetting } = await import('../../services/platform-settings.service.js');
              const platformGreeting = await getStringSetting('default_greeting', DEFAULT_GREETING).catch(() => DEFAULT_GREETING);
              const translator = new ConferenceTranslator({
                callId,
                workspaceId: callerWsId || call.workspace_id,
                subscriberId: callerWsId || call.workspace_id,
                myLanguage,
                targetLanguage,
                mode: wsDefs.translation_mode === 'unidirectional' ? 'text' : 'voice',
                whoHears: (wsDefs.who_hears as any) || 'both',
                ttsProvider: 'xai',
                ttsVoiceId: wsDefs.tts_voice_id || 'eve',
                tone: wsDefs.tone || 'business',
                personalContext: wsDefs.personal_context || '',
                greetingText: callMeta.greeting_text || wsDefs.greeting_text || platformGreeting,
                greetingDelaySeconds: Number(wsDefs.greeting_delay_seconds ?? 3),
                socket: socket as any,
                streamSid: streamSid!,
              });
              await translator.start();
              (socket as any).__conferenceTranslator = translator;
              activeConferenceTranslators.set(callId, translator);
              registerSession(callId, { callId, workspaceId: callerWsId || call.workspace_id, type: 'conference', startedAt: new Date().toISOString() }).catch(() => {});

              // Notify workspace that translator call started (for live sidebar)
              const io = getIo();
              if (io) {
                io.to(`workspace:${callerWsId || call.workspace_id}`).emit('call:status', {
                  call_id: callId,
                  status: 'in_progress',
                });
              }
            } catch (err) {
              logger.error({ err, callId }, 'Failed to start conference translator');
              await callService.updateCallStatus(callId, 'failed', {
                metadata: {
                  ...callMeta,
                  failure_reason: 'translator_start_failed',
                  failure_message: err instanceof Error ? err.message : String(err),
                },
              } as any);
              const io = getIo();
              if (io) {
                io.to(`workspace:${callerWsId || call.workspace_id}`).emit('call:status', {
                  call_id: callId,
                  status: 'failed',
                });
                io.to(`call:${callId}`).emit('call:status', {
                  call_id: callId,
                  status: 'failed',
                });
              }
              socket.close(1011, 'translator_start_failed');
            }
            return;
          }

          // --- Dialer call: Voice Translate via Grok Voice Agent ---
          if (call.conversation_owner_requested === 'manual' && !!(call.metadata as import('../../models/types.js').CallMetadata)?.voice_translate) {
            logger.info({ callId }, 'Dialer call — Grok Voice Agent mode');
            try {
              const meta = call.metadata as import('../../models/types.js').CallMetadata;
              const operatorLang = meta.stt_language ?? 'ru';
              const calleeLang = meta.translate_to_language ?? 'en';
              const ttsVoiceId = meta.tts_voice_id ?? 'ara';
              const io = getIo();
              const transcript: ManualSession['transcript'] = [];
              const aiSession = await callService.getAiSession(callId);

              // xAI is managed centrally by the platform admin.
              const { resolveCredentials } = await import('../../services/credential-resolver.service.js');
              const xaiApiKey = (await resolveCredentials<{ api_key: string }>(call.workspace_id, 'xai')).api_key;

              const { getLangName } = await import('../../config/languages.js');
              const opLangName = getLangName(operatorLang);
              const clLangName = getLangName(calleeLang);

              // Connect Grok Voice Agent
              const { WebSocket: WsClient } = await import('ws');
              let grokWs: import('ws').WebSocket | null = new WsClient('wss://api.x.ai/v1/realtime', {
                headers: { Authorization: `Bearer ${xaiApiKey}` },
              });

              let currentInputTranscript = '';
              let currentOutputTranscript = '';
              const pttAudioBuffer: Buffer[] = [];

              // Send TTS audio to callee only
              const sendTtsToCallee = (audio: Buffer) => {
                const vtSess = activeVoiceTranslateSessions.get(callId);
                if (!vtSess) return;
                const chunkSize = 640;
                const calleeWs = vtSess.calleeSocket;
                const calleeSid = vtSess.calleeStreamSid;
                if (calleeWs && calleeSid && calleeWs.readyState === 1) {
                  for (let i = 0; i < audio.length; i += chunkSize) {
                    calleeWs.send(JSON.stringify({
                      event: 'media', streamSid: calleeSid,
                      media: { payload: audio.subarray(i, i + chunkSize).toString('base64') },
                    }));
                  }
                }
              };

              const flushPttAudioBuffer = () => {
                if (pttAudioBuffer.length === 0) return;
                for (const audio of pttAudioBuffer) sendTtsToCallee(audio);
                logger.info({ callId, chunks: pttAudioBuffer.length }, 'PTT audio buffer flushed');
                pttAudioBuffer.length = 0;
              };
              registerPttFlush(callId, flushPttAudioBuffer);

              grokWs.on('open', () => {
                logger.info({ callId }, 'Grok Voice Agent connected for dialer VT');
                grokWs!.send(JSON.stringify({
                  type: 'session.update',
                  session: {
                    voice: ttsVoiceId,
                    instructions: `You are a live phone interpreter. Translate ${opLangName} to ${clLangName}. ONLY speak the translation, nothing else. Be natural and concise.`,
                    turn_detection: { type: 'server_vad', threshold: 0.6, silence_duration_ms: 1200, prefix_padding_ms: 400 },
                    input_audio_transcription: { model: 'whisper-1' },
                    audio: {
                      input: { format: { type: 'audio/pcmu', rate: 8000 } },
                      output: { format: { type: 'audio/pcmu', rate: 8000 } },
                    },
                  },
                }));
              });

              grokWs.on('message', (data: Buffer) => {
                try {
                  const msg = JSON.parse(data.toString());
                  const vtSess = activeVoiceTranslateSessions.get(callId);

                  if (msg.type === 'input_audio_buffer.speech_started') {
                    currentInputTranscript = '';
                    currentOutputTranscript = '';
                    if (io) {
                      // Non-volatile (see note above): polling-only transport
                      // would otherwise drop the speaking-indicator pulse.
                      io.to(`call:${callId}`).emit('call:transcript', {
                        call_id: callId, speaker: 'operator', text: '', timestamp: new Date().toISOString(), isFinal: false,
                      });
                    }
                  }

                  if (msg.type === 'response.output_audio.delta' && msg.delta) {
                    const audio = Buffer.from(msg.delta, 'base64');
                    if (vtSess?.sequentialMode) {
                      pttAudioBuffer.push(audio);
                    } else {
                      sendTtsToCallee(audio);
                    }
                  }

                  if (msg.type === 'response.audio_transcript.delta' || msg.type === 'response.output_audio_transcript.delta') {
                    if (msg.delta) {
                      currentOutputTranscript += msg.delta;
                      if (io) {
                        // Non-volatile — see conference-translator.ts note.
                        io.to(`call:${callId}:translate`).emit('call:translation:interim', {
                          call_id: callId, original: currentInputTranscript, translated: currentOutputTranscript,
                          timestamp: new Date().toISOString(),
                        });
                      }
                    }
                  }

                  if (msg.type === 'conversation.item.input_audio_transcription.completed') {
                    if (msg.transcript) {
                      currentInputTranscript = msg.transcript.trim();
                      if (io) {
                        io.to(`call:${callId}`).emit('call:transcript', {
                          call_id: callId, speaker: 'operator', text: currentInputTranscript,
                          timestamp: new Date().toISOString(), isFinal: false,
                        });
                      }
                    }
                  }

                  if (msg.type === 'response.done') {
                    const original = currentInputTranscript;
                    const translated = currentOutputTranscript.trim();
                    if (original && translated) {
                      transcript.push({ speaker: 'operator', text: original, timestamp: new Date().toISOString() });
                      if (io) {
                        io.to(`call:${callId}:translate`).emit('call:translation', {
                          call_id: callId, speaker: 'operator', original, translated,
                          timestamp: new Date().toISOString(),
                        });
                        io.to(`call:${callId}`).emit('call:transcript', {
                          call_id: callId, speaker: 'operator', text: original,
                          timestamp: new Date().toISOString(), isFinal: true,
                        });
                      }
                    }
                    // Flush PTT buffer if needed
                    if (vtSess?.sequentialMode && !vtSess.pttActive) flushPttAudioBuffer();
                    currentInputTranscript = '';
                    currentOutputTranscript = '';
                  }

                  if (msg.type === 'error') {
                    logger.error({ error: msg.error, callId }, 'Grok Voice Agent error (dialer VT)');
                  }
                } catch { /* ignore parse errors */ }
              });

              grokWs.on('error', (err: Error) => logger.error({ err, callId }, 'Grok VT WebSocket error'));
              grokWs.on('close', () => logger.info({ callId }, 'Grok VT WebSocket closed'));

              // Pre-allocate the session BEFORE dialing the callee. Twilio can
              // connect the callee leg before initiateOutboundCall returns; if the
              // session isn't registered yet, the callee 'start' handler reads null
              // and silently drops all callee audio (no STT, no transcript).
              const vtSession: VoiceTranslateSession = {
                operatorSocket: socket as any,
                operatorStreamSid: streamSid!,
                grokWs,
                calleeSocket: null,
                calleeStreamSid: null,
                calleeStt: null,
                calleeCallSid: null,
                workspaceId: call.workspace_id,
                transcript,
                sessionId: aiSession?.id,
                pttActive: false,
                sequentialMode: meta?.voice_translate_mode === 'sequential',
                translationEnabled: true,
                saved: false,
                currentInputTranscript: '',
                currentOutputTranscript: '',
                pttAudioBuffer,
                safetyTimer: setTimeout(() => {
                  logger.warn({ callId }, 'VT safety timer fired — force-finalizing session');
                  finalizeVTSession(callId).catch(() => {});
                }, 4 * 60 * 60 * 1000),
              };
              activeVoiceTranslateSessions.set(callId, vtSession);

              // Initiate callee call via Twilio REST API
              const calleeStreamUrl = `wss://${env.API_DOMAIN}/webhooks/ws/media-stream/${callId}-callee`;
              const statusCallbackUrl = `https://${env.API_DOMAIN}/webhooks/twilio/status`;

              const twilioCallSid = await telephonyService.initiateOutboundCall({
                workspaceId: call.workspace_id,
                to: call.to_number,
                from: call.from_number,
                callId,
                statusCallbackUrl,
                streamUrl: calleeStreamUrl,
              });
              vtSession.calleeCallSid = twilioCallSid;

              await callService.updateCallStatus(callId, 'in_progress', {
                twilio_call_sid: twilioCallSid,
              } as any);

              registerSession(callId, { callId, workspaceId: call.workspace_id, type: 'voice_translate', startedAt: new Date().toISOString() }).catch(() => {});

            } catch (err) {
              logger.error({ err, callId }, 'Failed to start Grok Voice Translate');
            }
            return;
          }

          // --- Manual call path (no AI agent, just STT transcription) ---
          if (call.conversation_owner_requested === 'manual') {
            logger.info({ callId }, 'Manual call — starting dual STT for transcription');
            try {
              const rawLang = (call.metadata as import('../../models/types.js').CallMetadata)?.stt_language ?? 'en';
              const sttLanguage = rawLang === 'auto' ? undefined : rawLang;
              const sttProviderName = ((call.metadata as import('../../models/types.js').CallMetadata)?.stt_provider ?? 'deepgram') as 'deepgram' | 'openai';
              logger.info({ callId, sttProviderName, sttLanguage }, 'Using STT provider');

              const calleeStt = await createSTTProvider(call.workspace_id, sttProviderName);
              const operatorStt = await createSTTProvider(call.workspace_id, sttProviderName);

              const transcript: ManualSession['transcript'] = [];
              const io = getIo();

              // Get AI session ID for later transcript save
              const aiSession = await callService.getAiSession(callId);

              const wireSTT = (stt: import('../../services/stt.service.js').STTProvider, speaker: 'caller' | 'operator') => {
                let accum = '';
                stt.on('transcript', (evt: import('../../services/stt.service.js').TranscriptEvent) => {
                  const text = evt.text.trim();
                  if (!text) return;

                  if (!evt.isFinal) {
                    // Interim → show in UI immediately. Non-volatile because
                    // socket.io is forced onto polling (see conference-translator.ts).
                    if (io) {
                      io.to(`call:${callId}`).emit('call:transcript', {
                        call_id: callId, speaker,
                        text: accum ? accum + ' ' + text : text,
                        timestamp: new Date().toISOString(), isFinal: false,
                      });
                    }
                    return;
                  }

                  accum += (accum ? ' ' : '') + text;

                  // Translate callee segments immediately (don't wait for utterance_end)
                  if (speaker === 'caller') {
                    const translator = activeTranslators.get(callId);
                    if (translator?.translateText) translator.translateText(text);
                    if (translator?.flushTranslation) translator.flushTranslation();
                  }
                });
                stt.on('utterance_end', () => {
                  const text = accum.trim();
                  accum = '';
                  if (!text) return;

                  if (io) {
                    io.to(`call:${callId}`).emit('call:transcript', {
                      call_id: callId,
                      speaker,
                      text,
                      timestamp: new Date().toISOString(),
                      isFinal: true,
                    });
                  }
                  transcript.push({ speaker, text, timestamp: new Date().toISOString() });
                });
                stt.on('error', (err: Error) => {
                  logger.error({ err, callId, speaker }, 'Manual call STT error');
                  if (io) {
                    io.to(`call:${callId}`).emit('call:transcript', {
                      call_id: callId,
                      speaker: 'system',
                      text: `STT error (${speaker}): ${err.message || 'connection failed'}`,
                      timestamp: new Date().toISOString(),
                      isFinal: true,
                    });
                  }
                });
                stt.on('close', () => {
                  logger.info({ callId, speaker }, 'Manual call STT closed');
                });
              };

              wireSTT(calleeStt, 'caller');
              wireSTT(operatorStt, 'operator');

              // Resolve LLM for speech correction (prefer fast/cheap models)
              let correctionLlm: import('../../services/llm.service.js').LLMProvider | null = null;
              let correctionProvider = 'openai';
              for (const provider of ['xai', 'openai', 'anthropic'] as const) {
                try {
                  correctionLlm = await createLLMProvider(call.workspace_id, provider);
                  correctionProvider = provider;
                  break;
                } catch { /* try next */ }
              }

              // Wire operator speech correction
              if (correctionLlm) {
                let operatorAccumulated = '';
                operatorStt.on('transcript', (evt: import('../../services/stt.service.js').TranscriptEvent) => {
                  if (evt.isFinal && evt.text.trim()) {
                    operatorAccumulated += (operatorAccumulated ? ' ' : '') + evt.text.trim();
                  }
                });
                operatorStt.on('utterance_end', () => {
                  const text = operatorAccumulated.trim();
                  operatorAccumulated = '';
                  if (text && correctionLlm) {
                    correctOperatorSpeech(callId, text, correctionLlm, correctionProvider).catch(err =>
                      logger.error({ err, callId }, 'Speech correction error'),
                    );
                  }
                });
              }

              calleeStt.connect({ language: sttLanguage });
              operatorStt.connect({ language: sttLanguage });

              const manualSession: ManualSession = {
                calleeStt,
                operatorStt,
                transcript,
                callId,
                workspaceId: call.workspace_id,
                sessionId: aiSession?.id,
                saved: false,
                stop: () => {
                  // Delegate to idempotent finalizer
                  finalizeManualSession(callId).catch(err =>
                    logger.error({ err, callId }, 'finalizeManualSession error'));
                },
              };

              activeManualSessions.set(callId, manualSession);
              registerSession(callId, { callId, workspaceId: call.workspace_id, type: 'manual', startedAt: new Date().toISOString() }).catch(() => {});

              // Initiate callee call via Twilio REST API
              const calleeStreamUrl = `wss://${env.API_DOMAIN}/webhooks/ws/media-stream/${callId}-callee`;
              const statusCallbackUrl = `https://${env.API_DOMAIN}/webhooks/twilio/status`;
              try {
                const calleeSid = await telephonyService.initiateOutboundCall({
                  workspaceId: call.workspace_id,
                  to: call.to_number,
                  from: call.from_number,
                  callId,
                  statusCallbackUrl,
                  streamUrl: calleeStreamUrl,
                });
                manualSession.calleeCallSid = calleeSid;
                logger.info({ callId, to: call.to_number, calleeSid }, 'Manual call: callee outbound initiated');
              } catch (err) {
                logger.error({ err, callId }, 'Manual call: failed to initiate callee outbound');
              }

              manualSafetyTimers.set(callId, setTimeout(() => {
                logger.warn({ callId }, 'Manual session safety timer fired — force-finalizing');
                finalizeManualSession(callId).catch(() => {});
              }, 4 * 60 * 60 * 1000));
            } catch (err) {
              logger.error({ err, callId }, 'Failed to start manual call STT');
            }
            return; // Manual call — no orchestrator needed
          }

          // Translator-only product: any call that isn't translator / voice-translate /
          // manual / sandbox has no handler here (the AI business agent was removed).
          logger.warn({ callId }, 'Unhandled media-stream call type — closing socket');
          socket.close();
          return;
        }

        if (msg.event === 'media' && msg.media?.payload) {
          const audioBuffer = Buffer.from(msg.media.payload, 'base64');
          const track = msg.media.track as string | undefined; // 'inbound' | 'outbound' when both_tracks

          // --- Conference translator: forward audio ---
          const confTranslator = (socket as any).__conferenceTranslator;
          if (confTranslator) {
            confTranslator.sendAudio(audioBuffer);
            return;
          }

          // --- Voice translate mode: route operator audio ---
          const vtSession = activeVoiceTranslateSessions.get(callId);
          if (vtSession) {
            // Sequential interpretation: forward operator's raw voice to callee when PTT is held
            if (vtSession.translationEnabled && vtSession.sequentialMode && vtSession.pttActive
              && vtSession.calleeSocket && vtSession.calleeStreamSid
              && vtSession.calleeSocket.readyState === 1) {
              vtSession.calleeSocket.send(JSON.stringify({
                event: 'media',
                streamSid: vtSession.calleeStreamSid,
                media: { payload: msg.media.payload },
              }));
            }
            // Send to Grok Voice Agent for translation
            if (vtSession.grokWs?.readyState === 1) {
              vtSession.grokWs.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: audioBuffer.toString('base64'),
              }));
            }
            return;
          }

          // --- Manual call: route audio to per-track STT ---
          // Twilio <Start><Stream> track naming (from callee's perspective):
          //   inbound  = audio arriving TO callee = operator's voice
          //   outbound = audio leaving FROM callee = callee's voice
          const manualSession = activeManualSessions.get(callId);
          if (manualSession) {
            if (track === 'inbound') {
              // Operator's voice (arriving to callee)
              manualSession.operatorStt.sendAudio(audioBuffer);
            } else {
              // Callee's voice (outbound from callee, or default when no track)
              manualSession.calleeStt.sendAudio(audioBuffer);
            }

            // Note: LiveTranslator for manual calls uses skipStt mode —
            // text is fed directly via translateText() from calleeStt transcript events.
            // No need to feedAudio() here.

            // Broadcast audio for monitoring
            const io = getIo();
            if (io) {
              io.to(`call:${callId}:audio`).volatile.emit('call:audio', {
                source: track === 'inbound' ? 'agent' : 'caller',
                payload: msg.media.payload,
              });
            }
            return;
          }


          // Forward caller audio to listen room for browser monitoring
          const io = getIo();
          if (io) {
            io.to(`call:${callId}:audio`).volatile.emit('call:audio', {
              source: 'caller',
              payload: msg.media.payload,
            });
          }

          // Forward to active LiveTranslator if running
          const translator = activeTranslators.get(callId);
          if (translator) {
            translator.feedAudio(audioBuffer);
          }
        }

        if (msg.event === 'mark' && msg.mark?.name) {
          const ct = (socket as any).__conferenceTranslator;
          if (ct && typeof ct.onMark === 'function') {
            ct.onMark(msg.mark.name);
          }
        }

        if (msg.event === 'stop') {
          // Conference translator
          const ct = (socket as any).__conferenceTranslator;
          if (ct) { ct.stop(); activeConferenceTranslators.delete(callId); unregisterSession(callId).catch(() => {}); }
          finalizeVTSession(callId).catch(err => logger.error({ err, callId }, 'finalizeVTSession error on stop'));
          finalizeManualSession(callId).catch(err => logger.error({ err, callId }, 'finalizeManualSession error on stop'));
        }
      } catch (err) {
        logger.error({ err, callId }, 'Error processing WebSocket message');
      }
    });

    socket.on('close', (code: number, reason: Buffer) => {
      logger.info({ callId, code, reason: reason?.toString() }, 'Twilio MediaStream WebSocket closed');
      // Finalize all session types (idempotent — safe to call even if already finalized in stop)
      const ct = (socket as any).__conferenceTranslator;
      if (ct) { ct.stop(); activeConferenceTranslators.delete(callId); unregisterSession(callId).catch(() => {}); }
      finalizeVTSession(callId).catch(err => logger.error({ err, callId }, 'finalizeVTSession error on close'));
      finalizeManualSession(callId).catch(err => logger.error({ err, callId }, 'finalizeManualSession error on close'));
    });
  });
};


export default mediaStreamRoutes;
