import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import websocket from '@fastify/websocket';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { calls as callsTable, callerProfiles, callerMemoryFacts } from '../../db/schema.js';
import * as callService from '../../services/call.service.js';
import * as agentService from '../../services/agent.service.js';
import * as workspaceService from '../../services/workspace.service.js';
import * as telephonyService from '../../services/telephony.service.js';
import { createSTTProvider } from '../../services/stt.service.js';
import { createTTSProvider } from '../../services/tts.service.js';
import { createLLMProvider } from '../../services/llm.service.js';
import { CallOrchestrator } from '../../services/call-orchestrator.js';
import { GrokRealtimeOrchestrator } from '../../services/grok-realtime.service.js';
import { sendBootstrapWebhook, ExternalAgentSession } from '../../services/external-handoff.service.js';
import { getProviderCredential } from '../../services/provider.service.js';
import * as knowledgeService from '../../services/knowledge.service.js';
import { env } from '../../config/env.js';
import { queuePostCallProcessing } from '../../workers/post-call.worker.js';
import { calculateLLMCost, calculateTTSCost, calculateSTTCost, calculateTelephonyCost } from '../../config/pricing.js';
import type { DeepgramSTT } from '../../services/stt.service.js';
import type { Call } from '../../models/types.js';
import { getIo } from '../../realtime/io.js';
import pino from 'pino';

const logger = pino({ name: 'media-stream' });

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

const activeOrchestrators = new Map<string, CallOrchestrator | GrokRealtimeOrchestrator>();
const activeTranslators = new Map<string, { feedAudio: (buf: Buffer) => void; stop: () => void; translateText?: (text: string) => void; flushTranslation?: () => void }>();

interface ManualSession {
  calleeStt: import('../../services/stt.service.js').STTProvider;    // outbound track — person on the other end
  operatorStt: import('../../services/stt.service.js').STTProvider;  // inbound track — operator in browser
  transcript: Array<{ speaker: string; text: string; timestamp: string }>;
  callId: string;
  sessionId?: string;
  workspaceId: string;
  saved: boolean;
  stop: () => void;
}
const activeManualSessions = new Map<string, ManualSession>();

interface VoiceTranslateSession {
  operatorSocket: import('ws').WebSocket;
  operatorStreamSid: string;
  operatorStt: import('../../services/stt.service.js').STTProvider;
  calleeSocket: import('ws').WebSocket | null;
  calleeStreamSid: string | null;
  calleeStt: import('../../services/stt.service.js').STTProvider | null;
  calleeCallSid: string | null; // Twilio SID for callee call (to hang up)
  workspaceId: string;
  transcript: Array<{ speaker: string; text: string; timestamp: string }>;
  sessionId?: string;
  tts: import('../../services/tts.service.js').TTSProvider;
  translationLlm: import('../../services/llm.service.js').LLMProvider | null;
  pttActive: boolean;
  sequentialMode: boolean;
  translationEnabled: boolean;
  saved: boolean;
  safetyTimer?: ReturnType<typeof setTimeout>;
}
const activeVoiceTranslateSessions = new Map<string, VoiceTranslateSession>();

export function getActiveTranslators() { return activeTranslators; }
export function getActiveVoiceTranslateSessions() { return activeVoiceTranslateSessions; }

// PTT audio buffer flush callbacks (registered per call, called when PTT released)
const pttFlushCallbacks = new Map<string, () => void>();

// Safety-net timers for manual sessions
const manualSafetyTimers = new Map<string, ReturnType<typeof setTimeout>>();

/* ------------------------------------------------------------------ */
/*  Idempotent finalize functions — called from stop/close/error/timer */
/* ------------------------------------------------------------------ */

async function finalizeVTSession(callId: string): Promise<void> {
  const vt = activeVoiceTranslateSessions.get(callId);
  if (!vt || vt.saved) return; // already saved or session gone
  vt.saved = true; // prevent double-save

  // Clear safety timer
  if (vt.safetyTimer) { clearTimeout(vt.safetyTimer); vt.safetyTimer = undefined; }

  // Close STT connections
  try { vt.operatorStt.close(); } catch { /* ignore */ }
  try { if (vt.calleeStt) vt.calleeStt.close(); } catch { /* ignore */ }

  // Save transcript + costs + queue post-call
  const sessionId = vt.sessionId;
  if (sessionId) {
    try {
      const [callRow] = await db.select().from(callsTable).where(eq(callsTable.id, callId));
      if (callRow) {
        const meta = callRow.metadata as any;
        const durationSecs = callRow.connected_at
          ? Math.floor((Date.now() - new Date(callRow.connected_at).getTime()) / 1000)
          : 0;
        const durationMins = durationSecs / 60;
        const sttProv = meta?.stt_provider ?? 'deepgram';
        const costStt = calculateSTTCost(sttProv, durationMins) * 2;
        const costTelephony = calculateTelephonyCost('twilio', durationMins) * 2;
        const costTotal = costStt + costTelephony;

        await callService.updateAiSession(sessionId, {
          transcript: vt.transcript as any,
          total_turns: vt.transcript.length,
          cost_stt: String(costStt),
          cost_telephony: String(costTelephony),
          cost_total: String(costTotal),
        } as any);

        await callService.updateCallStatus(callId, 'completed', {
          duration_seconds: durationSecs,
        } as any);

        if (vt.transcript.length > 0) {
          queuePostCallProcessing({ callId, workspaceId: vt.workspaceId, sessionId });
        }
        logger.info({ callId, turns: vt.transcript.length, costTotal }, 'VT session finalized');
      }
    } catch (err) {
      logger.error({ err, callId }, 'Failed to finalize VT session');
    }
  }

  // Notify frontend
  const io = getIo();
  if (io) {
    io.to(`call:${callId}`).emit('call:status', { call_id: callId, status: 'completed' });
  }

  // Hang up callee
  if (vt.calleeCallSid) {
    telephonyService.hangupCall(vt.workspaceId, vt.calleeCallSid).catch((err: unknown) => {
      logger.warn({ err, callId }, 'Failed to hangup callee');
    });
  }

  activeVoiceTranslateSessions.delete(callId);
  pttFlushCallbacks.delete(callId);
}

async function finalizeManualSession(callId: string): Promise<void> {
  const ms = activeManualSessions.get(callId);
  if (!ms || ms.saved) return;
  ms.saved = true;

  // Clear safety timer
  const timer = manualSafetyTimers.get(callId);
  if (timer) { clearTimeout(timer); manualSafetyTimers.delete(callId); }

  // Close STT
  try { ms.calleeStt.close(); } catch { /* ignore */ }
  try { ms.operatorStt.close(); } catch { /* ignore */ }

  // Save transcript + costs
  if (ms.sessionId) {
    try {
      const [callRow] = await db.select().from(callsTable).where(eq(callsTable.id, callId));
      if (callRow) {
        const durationSecs = callRow.connected_at
          ? Math.floor((Date.now() - new Date(callRow.connected_at).getTime()) / 1000)
          : 0;
        const durationMins = durationSecs / 60;
        const meta = callRow.metadata as any;
        const sttProv = meta?.stt_provider ?? 'deepgram';
        const costStt = calculateSTTCost(sttProv, durationMins) * 2;
        const costTelephony = calculateTelephonyCost('twilio', durationMins);
        const costTotal = costStt + costTelephony;

        await callService.updateAiSession(ms.sessionId, {
          transcript: ms.transcript as any,
          total_turns: ms.transcript.length,
          cost_stt: String(costStt),
          cost_telephony: String(costTelephony),
          cost_total: String(costTotal),
        } as any);

        await callService.updateCallStatus(callId, 'completed', {
          duration_seconds: durationSecs,
        } as any);

        if (ms.transcript.length > 0) {
          queuePostCallProcessing({ callId, workspaceId: ms.workspaceId, sessionId: ms.sessionId });
        }
        logger.info({ callId, turns: ms.transcript.length, costTotal }, 'Manual session finalized');
      }
    } catch (err) {
      logger.error({ err, callId }, 'Failed to finalize manual session');
    }
  }

  activeManualSessions.delete(callId);
}
export function registerPttFlush(callId: string, cb: () => void) { pttFlushCallbacks.set(callId, cb); }
export function flushPttAudio(callId: string) { pttFlushCallbacks.get(callId)?.(); }

export function getActiveOrchestrator(callId: string): CallOrchestrator | GrokRealtimeOrchestrator | undefined {
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
  const externalSessions = new Map<string, ExternalAgentSession>();

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

      socket.on('message', async (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.event === 'start') {
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
                  // Interim → show raw transcript in UI immediately (real-time feel)
                  if (io) {
                    io.to(`call:${callId}`).volatile.emit('call:transcript', {
                      call_id: callId, speaker: 'caller', text: calleeAccum ? calleeAccum + ' ' + text : text,
                      timestamp: new Date().toISOString(), isFinal: false,
                    });
                  }
                  return;
                }

                // Final segment → accumulate and translate immediately
                calleeAccum += (calleeAccum ? ' ' : '') + text;

                // Save each final segment to transcript immediately (don't rely on utterance_end)
                session.transcript.push({ speaker: 'caller', text, timestamp: new Date().toISOString() });

                // Translate each final segment right away (don't wait for utterance_end)
                const translator = activeTranslators.get(callId);
                if (translator?.translateText) translator.translateText(text);
                if (translator?.flushTranslation) translator.flushTranslation();
              });
              session.calleeStt.on('utterance_end', () => {
                const text = calleeAccum.trim();
                calleeAccum = '';
                if (!text) return;

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

    let orchestrator: CallOrchestrator | GrokRealtimeOrchestrator | null = null;
    let externalSession: ExternalAgentSession | null = null;
    let streamSid: string | null = null;

    socket.on('message', async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.event === 'start') {
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
          const callMeta = call.metadata as any;
          if (callMeta?.call_type === 'translator' && callMeta?.subscriber_id) {
            logger.info({ callId, subscriberId: callMeta.subscriber_id }, 'Translator call — starting conference translator');
            try {
              const { translatorSubscribers } = await import('../../db/schema.js');
              const [sub] = await db.select().from(translatorSubscribers)
                .where(eq(translatorSubscribers.id, callMeta.subscriber_id));
              if (sub) {
                const { ConferenceTranslator } = await import('../../services/conference-translator.js');
                const translator = new ConferenceTranslator({
                  callId,
                  workspaceId: call.workspace_id,
                  subscriberId: sub.id,
                  myLanguage: sub.my_language,
                  targetLanguage: sub.target_language,
                  mode: sub.mode as 'voice' | 'text' | 'both',
                  whoHears: sub.who_hears as 'subscriber' | 'both',
                  ttsProvider: sub.tts_provider,
                  ttsVoiceId: sub.tts_voice_id ?? undefined,
                  socket: socket as any,
                  streamSid: streamSid!,
                });
                await translator.start();
                // Store reference for media/stop/close events
                (socket as any).__conferenceTranslator = translator;
              }
            } catch (err) {
              logger.error({ err, callId }, 'Failed to start conference translator');
            }
            return;
          }

          // --- Dialer call: always use bidirectional <Connect><Stream> (supports mid-call translate toggle) ---
          if (call.conversation_owner_requested === 'manual') {
            const vtEnabled = !!(call.metadata as any)?.voice_translate;
            logger.info({ callId, vtEnabled }, 'Dialer call — bidirectional stream mode');
            try {
              const meta = call.metadata as any;
              const operatorLang = meta.stt_language ?? 'ru';
              const calleeLang = meta.translate_to_language ?? 'en';
              const ttsVoiceId = meta.tts_voice_id;
              const sttProviderName = (meta.stt_provider ?? 'deepgram') as 'deepgram' | 'openai';
              const io = getIo();

              // STT for operator's voice (operator speaks in their language)
              const operatorStt = await createSTTProvider(call.workspace_id, sttProviderName);
              const transcript: ManualSession['transcript'] = [];
              const aiSession = await callService.getAiSession(callId);

              // LLM for translation
              let translationLlm: import('../../services/llm.service.js').LLMProvider | null = null;
              let translationProvider = 'openai';
              for (const provider of ['openai', 'xai'] as const) {
                try {
                  translationLlm = await createLLMProvider(call.workspace_id, provider);
                  translationProvider = provider;
                  break;
                } catch { /* try next */ }
              }

              // TTS for translated speech (callee hears this)
              // TTS: use selected provider or fallback chain
              const preferredTts = meta.tts_provider as string | undefined;
              let tts: import('../../services/tts.service.js').TTSProvider | null = null;
              let ttsProviderUsed = 'elevenlabs';
              const ttsOrder = preferredTts
                ? [preferredTts as 'elevenlabs' | 'openai' | 'xai']
                : (['elevenlabs', 'openai', 'xai'] as const);
              for (const ttsProv of ttsOrder) {
                try {
                  tts = await createTTSProvider(call.workspace_id, ttsProv, ttsVoiceId ?? (ttsProv === 'openai' ? 'alloy' : undefined), calleeLang);
                  ttsProviderUsed = ttsProv;
                  break;
                } catch { /* try next */ }
              }
              if (!tts) throw new Error('No TTS provider available');

              // Wire operator STT — stream mode: translate+TTS each isFinal segment immediately
              let operatorAccum = ''; // for transcript display only
              operatorStt.on('error', (err: Error) => logger.error({ err, callId }, 'Voice translate operator STT error'));

              const translationModel = process.env.OPENAI_OAUTH_PROXY_URL ? 'gpt-5.4-mini' : 'gpt-4o-mini';

              // Pre-translate during PTT: translate+TTS each segment immediately, buffer audio
              const pttAudioBuffer: Buffer[] = []; // pre-generated TTS audio chunks
              let pttTranslatedTexts: string[] = []; // for UI display

              operatorStt.on('transcript', (evt: import('../../services/stt.service.js').TranscriptEvent) => {
                if (!evt.isFinal || !evt.text.trim()) return;
                const segmentText = evt.text.trim();
                operatorAccum += (operatorAccum ? ' ' : '') + segmentText;

                // Check if translation is enabled (can be toggled mid-call)
                const vtSessCheck = activeVoiceTranslateSessions.get(callId);
                if (!translationLlm || !vtSessCheck?.translationEnabled) return;

                // Always translate immediately — even during PTT (pre-buffer TTS audio)
                const textToTranslate = segmentText;

                // Fire-and-forget: translate + TTS this segment immediately
                (async () => {
                  try {
                    // Translate
                    const client = (translationLlm as any).client;
                    const resp = await client.chat.completions.create({
                      model: translationModel,
                      temperature: 0.3,
                      max_tokens: 150,
                      stream: false,
                      messages: [
                        { role: 'system', content: `Translate to ${calleeLang}. Phone call. Be natural.\nOnly output the translation.` },
                        { role: 'user', content: `"${textToTranslate}"` },
                      ],
                    });
                    const translated = resp.choices?.[0]?.message?.content?.trim();
                    if (!translated) return;

                    // Emit translation to UI
                    if (io) {
                      io.to(`call:${callId}:translate`).emit('call:translation', {
                        call_id: callId, speaker: 'operator', original: textToTranslate,
                        translated, timestamp: new Date().toISOString(),
                      });
                    }

                    // Save to transcript for persistence
                    transcript.push({ speaker: 'operator', text: textToTranslate, timestamp: new Date().toISOString() });

                    // TTS → generate audio with runtime fallback (use session.tts for mid-call changes)
                    const vtSession = activeVoiceTranslateSessions.get(callId);
                    const currentTts = vtSession?.tts ?? tts;
                    let audio: Buffer | null = null;
                    // Detect current TTS provider dynamically (handles mid-call changes)
                    const currentTtsName = (currentTts as any).constructor?.name;
                    let actualTtsProvider = currentTtsName === 'ElevenLabsTTS' ? 'elevenlabs'
                      : currentTtsName === 'XaiTTS' ? 'xai' : 'openai';
                    try {
                      audio = await currentTts.synthesize(translated);
                    } catch (ttsErr) {
                      logger.warn({ err: ttsErr, callId, provider: actualTtsProvider }, 'TTS synthesis failed, trying fallback');
                      // Try fallback providers — match voice gender + pass voiceId
                      const xaiVoice = ttsVoiceId ?? 'ara';
                      const isMale = ['ara', 'rex', 'leo'].includes(xaiVoice);
                      const openaiVoice = isMale ? 'onyx' : 'nova';
                      const elevenVoice = ttsVoiceId; // keep same ElevenLabs voice if configured
                      for (const fallback of (['openai', 'elevenlabs', 'xai'] as const).filter(p => p !== actualTtsProvider)) {
                        try {
                          const fbVoice = fallback === 'openai' ? openaiVoice
                            : fallback === 'elevenlabs' ? elevenVoice
                            : xaiVoice;
                          const fallbackTts = await createTTSProvider(call.workspace_id, fallback, fbVoice, calleeLang);
                          audio = await fallbackTts.synthesize(translated);
                          actualTtsProvider = fallback;
                          // Lock session to fallback provider for rest of call (stable voice)
                          const vtSessFb = activeVoiceTranslateSessions.get(callId);
                          if (vtSessFb) vtSessFb.tts = fallbackTts;
                          logger.info({ callId, fallback, voice: fbVoice }, 'TTS fallback succeeded — locked for call');
                          break;
                        } catch { /* try next */ }
                      }
                    }
                    if (!audio) {
                      logger.error({ callId }, 'All TTS providers failed');
                      return;
                    }
                    // ElevenLabs and xAI output mulaw directly; OpenAI outputs PCM needing conversion
                    const skipConversion = actualTtsProvider === 'elevenlabs' || actualTtsProvider === 'xai';
                    if (!skipConversion) {
                      audio = pcmToMulaw(audio);
                    }

                    // Check if PTT is active — buffer audio for instant playback on release
                    const vtSessNow = activeVoiceTranslateSessions.get(callId);
                    if (vtSessNow?.sequentialMode) {
                      // Always buffer in sequential mode
                      pttAudioBuffer.push(audio);
                      pttTranslatedTexts.push(translated);
                      logger.info({ callId, original: textToTranslate.slice(0, 40), pttActive: vtSessNow.pttActive }, 'TTS pre-buffered');
                      // If PTT already released — flush immediately
                      if (!vtSessNow.pttActive) {
                        flushPttAudioBuffer();
                      }
                    } else {
                      // Inject TTS audio into callee + operator streams immediately
                      sendTtsAudioToBoth(audio);
                      logger.info({ callId, original: textToTranslate.slice(0, 40), translated: translated.slice(0, 40) }, 'Voice translation sent');
                    }
                  } catch (err) {
                    logger.error({ err, callId }, 'Voice translate pipeline error');
                  }
                })();
              });

              // Send TTS audio to both callee AND operator (so operator hears the translation too)
              const sendTtsAudioToBoth = (audio: Buffer) => {
                const vtSess = activeVoiceTranslateSessions.get(callId);
                if (!vtSess) return;
                const chunkSize = 640;
                // → callee
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
                // → operator (hear your own translation)
                if (vtSess.operatorSocket && vtSess.operatorStreamSid && vtSess.operatorSocket.readyState === 1) {
                  for (let i = 0; i < audio.length; i += chunkSize) {
                    vtSess.operatorSocket.send(JSON.stringify({
                      event: 'media', streamSid: vtSess.operatorStreamSid,
                      media: { payload: audio.subarray(i, i + chunkSize).toString('base64') },
                    }));
                  }
                }
              };

              // Flush pre-buffered TTS audio to callee+operator (called when PTT released)
              const flushPttAudioBuffer = () => {
                if (pttAudioBuffer.length === 0) return;
                for (const audio of pttAudioBuffer) {
                  sendTtsAudioToBoth(audio);
                }
                logger.info({ callId, chunks: pttAudioBuffer.length }, 'PTT audio buffer flushed instantly');
                // Translation already emitted per-segment in transcript handler (line 410)
                // Only clear buffers here — no duplicate UI emit
                pttAudioBuffer.length = 0;
                pttTranslatedTexts.length = 0;
              };
              registerPttFlush(callId, flushPttAudioBuffer);

              // Emit complete utterance to transcript UI on utterance_end
              operatorStt.on('utterance_end', () => {
                const text = operatorAccum.trim();
                operatorAccum = '';
                if (!text) return;
                if (io) {
                  io.to(`call:${callId}`).emit('call:transcript', {
                    call_id: callId, speaker: 'operator', text,
                    timestamp: new Date().toISOString(), isFinal: true,
                  });
                }
                // transcript.push moved to per-segment translation handler above
              });

              operatorStt.connect({ language: operatorLang === 'auto' ? undefined : operatorLang });

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

              // Update call with twilio SID
              await callService.updateCallStatus(callId, 'in_progress', {
                twilio_call_sid: twilioCallSid,
              } as any);

              // Store session for callee WS to connect to
              activeVoiceTranslateSessions.set(callId, {
                operatorSocket: socket as any,
                operatorStreamSid: streamSid!,
                operatorStt,
                calleeSocket: null,
                calleeStreamSid: null,
                calleeStt: null,
                calleeCallSid: twilioCallSid,
                workspaceId: call.workspace_id,
                transcript,
                sessionId: aiSession?.id,
                tts,
                translationLlm,
                pttActive: false,
                sequentialMode: meta?.voice_translate_mode === 'sequential',
                translationEnabled: vtEnabled,
                saved: false,
                safetyTimer: setTimeout(() => {
                  logger.warn({ callId }, 'VT safety timer fired — force-finalizing session');
                  finalizeVTSession(callId).catch(() => {});
                }, 4 * 60 * 60 * 1000), // 4 hours max
              });

              // Forward operator audio to STT
              // (handled in media event below)

            } catch (err) {
              logger.error({ err, callId }, 'Failed to start voice translate mode');
            }
            return;
          }

          // --- Manual call path (no AI agent, just STT transcription) ---
          if (call.conversation_owner_requested === 'manual') {
            logger.info({ callId }, 'Manual call — starting dual STT for transcription');
            try {
              const rawLang = (call.metadata as any)?.stt_language ?? 'en';
              const sttLanguage = rawLang === 'auto' ? undefined : rawLang;
              const sttProviderName = ((call.metadata as any)?.stt_provider ?? 'deepgram') as 'deepgram' | 'openai';
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
                    // Interim → show in UI immediately for real-time feel
                    if (io) {
                      io.to(`call:${callId}`).volatile.emit('call:transcript', {
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
              manualSafetyTimers.set(callId, setTimeout(() => {
                logger.warn({ callId }, 'Manual session safety timer fired — force-finalizing');
                finalizeManualSession(callId).catch(() => {});
              }, 4 * 60 * 60 * 1000));
            } catch (err) {
              logger.error({ err, callId }, 'Failed to start manual call STT');
            }
            return; // Manual call — no orchestrator needed
          }

          const agentProfile = call.agent_profile_id
            ? await agentService.getAgentProfile(call.workspace_id, call.agent_profile_id)
            : await agentService.getDefaultAgentProfile(call.workspace_id);

          if (!agentProfile) {
            logger.error({ callId }, 'No agent profile found');
            socket.close();
            return;
          }

          // --- External handoff path ---
          if (call.conversation_owner_requested === 'external') {
            const started = await startExternalHandoff(
              call as unknown as Call,
              agentProfile,
              callId,
              streamSid!,
              socket as any,
              externalSessions,
            );
            if (started) {
              externalSession = started;
              return; // External agent owns the call now
            }
            // Fallback: continue to internal orchestrator below
            logger.info({ callId }, 'External handoff failed, falling back to internal orchestrator');
          }

          // --- Internal orchestrator path ---
          orchestrator = await startInternalOrchestrator(
            call,
            agentProfile,
            callId,
            streamSid!,
            socket as any,
          );
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
            // Always send to STT for transcription + translation
            vtSession.operatorStt.sendAudio(audioBuffer);
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

          // --- AI orchestrator path ---
          // Forward audio to Grok Realtime orchestrator
          if (orchestrator && orchestrator instanceof GrokRealtimeOrchestrator) {
            (orchestrator as GrokRealtimeOrchestrator).sendAudio(msg.media.payload);
          }
          // Standard CallOrchestrator receives audio via STT directly (wired in start())

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

        if (msg.event === 'stop') {
          // Conference translator
          const ct = (socket as any).__conferenceTranslator;
          if (ct) ct.stop();
          finalizeVTSession(callId).catch(err => logger.error({ err, callId }, 'finalizeVTSession error on stop'));
          finalizeManualSession(callId).catch(err => logger.error({ err, callId }, 'finalizeManualSession error on stop'));
          if (orchestrator) orchestrator.stop('stream_stopped');
          if (externalSession) externalSession.sendCallEnded('stream_stopped');
        }
      } catch (err) {
        logger.error({ err, callId }, 'Error processing WebSocket message');
      }
    });

    socket.on('close', (code: number, reason: Buffer) => {
      logger.info({ callId, code, reason: reason?.toString() }, 'Twilio MediaStream WebSocket closed');
      // Finalize all session types (idempotent — safe to call even if already finalized in stop)
      const ct = (socket as any).__conferenceTranslator;
      if (ct) ct.stop();
      finalizeVTSession(callId).catch(err => logger.error({ err, callId }, 'finalizeVTSession error on close'));
      finalizeManualSession(callId).catch(err => logger.error({ err, callId }, 'finalizeManualSession error on close'));
      if (orchestrator) orchestrator.stop('ws_closed');
      if (externalSession) {
        externalSession.sendCallEnded('ws_closed');
        externalSessions.delete(callId);
      }
    });
  });

  /**
   * Attempt external handoff. Returns ExternalAgentSession if successful, null if fallback needed.
   */
  async function startExternalHandoff(
    call: Call,
    agentProfile: any,
    callId: string,
    streamSid: string,
    twilioSocket: import('ws').WebSocket,
    sessions: Map<string, ExternalAgentSession>,
  ): Promise<ExternalAgentSession | null> {
    const workspace = await workspaceService.getWorkspace(call.workspace_id);

    if (!workspace.external_inbound_webhook_url || !workspace.external_inbound_auth_secret) {
      logger.warn({ callId }, 'No external webhook URL configured, falling back to internal');
      await callService.updateCallStatus(callId, 'in_progress', {
        conversation_owner_actual: 'internal',
        external_bootstrap_status: 'failed',
        fallback_reason: 'no_webhook_url_configured',
      } as any);
      await callService.addCallEvent({
        callId,
        workspaceId: call.workspace_id,
        eventType: 'external_handoff_fallback',
        eventData: { reason: 'no_webhook_url_configured' },
      });
      return null;
    }

    const readyTimeoutMs = workspace.external_ready_timeout_ms ?? 8000;
    const sessionId = `es_${callId.slice(0, 8)}_${Date.now()}`;

    // Update bootstrap status to requested
    await callService.updateCallStatus(callId, 'in_progress', {
      external_bootstrap_status: 'requested',
    } as any);

    // Send bootstrap webhook
    const wsBaseUrl = `wss://${env.API_DOMAIN}`;
    const { accepted, sessionToken } = await sendBootstrapWebhook({
      callId,
      sessionId,
      workspaceId: call.workspace_id,
      calledNumber: call.to_number,
      callerNumber: call.from_number,
      agentProfileId: agentProfile.id,
      language: agentProfile.language,
      webhookUrl: workspace.external_inbound_webhook_url,
      authSecret: workspace.external_inbound_auth_secret,
      readyTimeoutMs,
      wsBaseUrl,
    });

    if (!accepted) {
      logger.warn({ callId }, 'External agent rejected bootstrap webhook');
      await callService.updateCallStatus(callId, 'in_progress', {
        conversation_owner_actual: 'internal',
        external_bootstrap_status: 'failed',
        fallback_reason: 'bootstrap_webhook_rejected',
      } as any);
      await callService.addCallEvent({
        callId,
        workspaceId: call.workspace_id,
        eventType: 'external_handoff_fallback',
        eventData: { reason: 'bootstrap_webhook_rejected' },
      });
      return null;
    }

    await callService.updateCallStatus(callId, 'in_progress', {
      external_bootstrap_status: 'accepted',
    } as any);

    // Create session and wait for external agent to connect
    const session = new ExternalAgentSession(callId, sessionId);
    sessions.set(callId, session);

    return new Promise<ExternalAgentSession | null>((resolve) => {
      const timeout = setTimeout(async () => {
        sessions.delete(callId);
        logger.warn({ callId }, 'External agent connection timed out');
        await callService.updateCallStatus(callId, 'in_progress', {
          conversation_owner_actual: 'internal',
          external_bootstrap_status: 'timed_out',
          fallback_reason: 'external_agent_connection_timeout',
        } as any);
        await callService.addCallEvent({
          callId,
          workspaceId: call.workspace_id,
          eventType: 'external_handoff_fallback',
          eventData: { reason: 'external_agent_connection_timeout', timeout_ms: readyTimeoutMs },
        });
        resolve(null);
      }, readyTimeoutMs);

      session.on('ready', async () => {
        clearTimeout(timeout);
        logger.info({ callId }, 'External agent is ready, handing off call');
        await callService.updateCallStatus(callId, 'in_progress', {
          conversation_owner_actual: 'external',
          external_bootstrap_status: 'ready',
          external_runtime_connected_at: new Date().toISOString(),
        } as any);
        await callService.addCallEvent({
          callId,
          workspaceId: call.workspace_id,
          eventType: 'external_agent_ready',
          eventData: { session_id: sessionId },
        });

        // Pipe Twilio audio to external agent via events
        // The ExternalAgentSession handles sending transcript deltas;
        // for raw audio piping, forward media events directly
        setupExternalAudioBridge(twilioSocket, session, streamSid);

        resolve(session);
      });

      session.on('timeout', async () => {
        clearTimeout(timeout);
        sessions.delete(callId);
        await callService.updateCallStatus(callId, 'in_progress', {
          conversation_owner_actual: 'internal',
          external_bootstrap_status: 'timed_out',
          fallback_reason: 'external_agent_readiness_timeout',
        } as any);
        resolve(null);
      });

      session.on('disconnected', async () => {
        clearTimeout(timeout);
        sessions.delete(callId);
        logger.info({ callId }, 'External agent disconnected');
        await callService.addCallEvent({
          callId,
          workspaceId: call.workspace_id,
          eventType: 'external_agent_disconnected',
          eventData: { session_id: sessionId },
        });
      });
    });
  }

  /**
   * Set up bidirectional audio bridge between Twilio WebSocket and external agent session.
   * Forward Twilio media events to external agent, and external agent replies back to Twilio.
   */
  function setupExternalAudioBridge(
    twilioSocket: import('ws').WebSocket,
    session: ExternalAgentSession,
    streamSid: string,
  ): void {
    // External agent reply_text events -> TTS would be handled by the external agent itself.
    // The external agent sends audio back via its own WebSocket; we listen for control events.
    session.on('control', (controlName: string) => {
      if (controlName === 'hangup') {
        logger.info('External agent requested hangup');
        twilioSocket.close();
      }
    });
  }

  /** Start the internal STT->LLM->TTS orchestrator (or Grok Realtime when both voice + LLM are xAI) */
  async function startInternalOrchestrator(
    call: any,
    agentProfile: any,
    callId: string,
    streamSid: string,
    twilioSocket: import('ws').WebSocket,
  ): Promise<CallOrchestrator | GrokRealtimeOrchestrator> {
    // Ensure conversation_owner_actual is set to internal
    await callService.updateCallStatus(callId, 'in_progress', {
      conversation_owner_actual: 'internal',
    } as any);

    const [promptPacks, attachedSkills, allSkills, attachedKBs] = await Promise.all([
      agentService.getAgentPromptPacks(agentProfile.id),
      agentService.getAgentSkillPacks(agentProfile.id),
      agentService.listSkillPacks(call.workspace_id),
      agentService.getAgentKnowledgeBases(agentProfile.id),
    ]);
    const systemPrompt = buildSystemPrompt(agentProfile, promptPacks, attachedSkills, allSkills, call, attachedKBs);
    const callerContext = await loadCallerContext(call.workspace_id, call.from_number);

    // Load workspace timezone
    const workspace = await workspaceService.getWorkspace(call.workspace_id);
    const timezone = workspace?.timezone || 'America/Los_Angeles';

    // --- Grok Realtime path: skip STT/TTS/LLM when both voice and LLM are xAI ---
    const useGrokRealtime =
      agentProfile.voice_provider === 'xai' && agentProfile.llm_provider === 'xai';

    if (useGrokRealtime) {
      logger.info({ callId }, 'Using Grok Realtime (voice-to-voice) orchestrator');

      const xaiCreds = await getProviderCredential(call.workspace_id, 'xai');
      const apiKey = xaiCreds.api_key;

      const grokOrchestrator = new GrokRealtimeOrchestrator({
        call: call as any,
        agentProfile: agentProfile as any,
        twilioWs: twilioSocket,
        streamSid,
        systemPrompt,
        callerContext,
        apiKey,
        timezone,
      });

      // Audio forwarding handled in main socket.on('message') handler
      wireOrchestratorEvents(grokOrchestrator, call, callId);
      grokOrchestrator.start();
      return grokOrchestrator;
    }

    // --- Standard STT -> LLM -> TTS pipeline ---
    const [stt, tts, llm] = await Promise.all([
      createSTTProvider(call.workspace_id, agentProfile.stt_provider as any),
      createTTSProvider(call.workspace_id, agentProfile.voice_provider as any, agentProfile.voice_id ?? undefined),
      createLLMProvider(call.workspace_id, agentProfile.llm_provider as any),
    ]);

    // Use language from call context (mission) if available, otherwise agent profile
    const callLanguage = (call.context as any)?.language || agentProfile.language;

    const orchestrator = new CallOrchestrator({
      call: call as any,
      agentProfile: agentProfile as any,
      stt: stt as DeepgramSTT,
      tts,
      llm,
      twilioWs: twilioSocket,
      streamSid,
      language: callLanguage,
      systemPrompt,
      callerContext,
      knowledgeSearch: attachedKBs.length > 0
        ? (query: string) => knowledgeService.searchKnowledgeForAgent(
            call.workspace_id, agentProfile.id, query, 3,
          )
        : undefined,
    });

    wireOrchestratorEvents(orchestrator, call, callId);
    orchestrator.start();
    return orchestrator;
  }

  /** Wire up stopped/error event handlers shared by both orchestrator types */
  function wireOrchestratorEvents(
    orchestrator: CallOrchestrator | GrokRealtimeOrchestrator,
    call: any,
    callId: string,
  ): void {
    // Store orchestrator for live monitoring access
    activeOrchestrators.set(callId, orchestrator);

    // Forward transcript events to Socket.IO for live monitoring
    orchestrator.on('transcript', (entry: { speaker: string; text: string; timestamp: string; isFinal: boolean }) => {
      const io = getIo();
      logger.info({ callId, speaker: entry.speaker, text: entry.text?.slice(0, 50), hasIo: !!io }, 'Forwarding transcript to Socket.IO');
      io?.to(`call:${callId}`).emit('call:transcript', { call_id: callId, ...entry });
    });

    // Forward agent TTS audio to browser listen room
    orchestrator.on('agent_audio', (data: { payload: string }) => {
      const io = getIo();
      if (io) {
        io.to(`call:${callId}:audio`).volatile.emit('call:audio', {
          source: 'agent',
          payload: data.payload,
        });
      }
    });

    orchestrator.on('skill_activated', (data: { intent: string }) => {
      const io = getIo();
      io?.to(`call:${callId}`).emit('call:transcript', {
        call_id: callId,
        speaker: 'system',
        text: `[Skill activated: ${data.intent}]`,
        timestamp: new Date().toISOString(),
        isFinal: true,
      });
    });

    orchestrator.on('stopped', async (result: any) => {
      activeOrchestrators.delete(callId);
      logger.info({ callId, reason: result.reason }, 'Orchestrator stopped');
      const session = await callService.getAiSession(callId);
      if (session) {
        // Calculate costs based on actual usage
        const costLlm = calculateLLMCost(
          result.llmModel ?? 'claude-sonnet-4-5-20250514',
          result.totalTokensIn ?? 0,
          result.totalTokensOut ?? 0,
        );
        const costTts = calculateTTSCost(
          result.voiceProvider ?? 'elevenlabs',
          result.totalTtsCharacters ?? 0,
        );
        const costStt = calculateSTTCost(
          result.sttProvider ?? 'deepgram',
          (result.sttAudioDurationMs ?? 0) / 60_000,
        );
        // Get call duration for telephony cost
        const callRecord = await callService.getCall(call.workspace_id, callId);
        const durationMin = (callRecord?.duration_seconds ?? 0) / 60;
        const costTelephony = calculateTelephonyCost('twilio', durationMin);
        const costTotal = costLlm + costTts + costStt + costTelephony;

        await callService.updateAiSession(session.id, {
          transcript: result.conversationHistory,
          total_turns: result.turnCount,
          total_tokens_in: result.totalTokensIn,
          total_tokens_out: result.totalTokensOut,
          avg_latency_ms: result.avgLatencyMs,
          cost_llm: costLlm.toFixed(6),
          cost_tts: costTts.toFixed(6),
          cost_stt: costStt.toFixed(6),
          cost_telephony: costTelephony.toFixed(6),
          cost_total: costTotal.toFixed(6),
        } as any);

        logger.info({ callId, costLlm, costTts, costStt, costTelephony, costTotal }, 'Call costs calculated');

        // Queue post-call processing (summary, sentiment, fact extraction, memory)
        queuePostCallProcessing({
          callId,
          sessionId: session.id,
          workspaceId: call.workspace_id,
          callerProfileId: call.caller_profile_id ?? undefined,
        }).catch(err => logger.error({ err, callId }, 'Failed to queue post-call processing'));
      }
      await callService.updateCallStatus(callId, 'completed');
    });

    orchestrator.on('error', (err) => {
      logger.error({ err, callId }, 'Orchestrator error');
    });
  }
};

function buildSystemPrompt(agentProfile: any, promptPacks: any[], attachedSkills: any[] = [], allSkills: any[] = [], call?: any, attachedKBs: any[] = []): string {
  const parts: string[] = [];
  parts.push(`You are ${agentProfile.display_name}, an AI phone agent.`);
  if (agentProfile.company_name) parts.push(`You represent ${agentProfile.company_name}.`);
  if (agentProfile.company_identity) parts.push(agentProfile.company_identity);
  if (agentProfile.system_prompt) parts.push(agentProfile.system_prompt);

  // Mission briefing from call goal/context
  if (call?.goal) {
    const missionParts = [`MISSION BRIEFING:\nGoal: ${call.goal}`];
    if (call.context && Object.keys(call.context).length > 0) {
      missionParts.push(`Context data to use during the call: ${JSON.stringify(call.context)}`);
    }
    parts.push(missionParts.join('\n'));
  }

  for (const pack of promptPacks) {
    if (pack.content) parts.push(`--- ${pack.name} ---\n${pack.content}`);
  }

  // Core skills (always active — full conversation rules)
  if (attachedSkills.length > 0) {
    const coreSkillParts = attachedSkills
      .filter(s => s.conversation_rules)
      .map(s => `[${s.name}]: ${s.conversation_rules}`);
    if (coreSkillParts.length > 0) {
      parts.push(`CORE SKILLS (always active):\n${coreSkillParts.join('\n')}`);
    }
  }

  // Optional skills (available but not attached — agent can activate if needed)
  const attachedIds = new Set(attachedSkills.map((s: any) => s.id));
  const optionalSkills = allSkills.filter(s => !attachedIds.has(s.id) && s.is_active);
  if (optionalSkills.length > 0) {
    const optParts = optionalSkills.map(s =>
      `- ${s.intent}: ${s.description || s.name}`
    );
    parts.push(`OPTIONAL SKILLS (activate when the conversation requires it — say [ACTIVATE:skill_intent] to enable):\n${optParts.join('\n')}`);
  }

  // Knowledge bases
  if (attachedKBs.length > 0) {
    const kbNames = attachedKBs.map((kb: any) => kb.name).join(', ');
    parts.push(`KNOWLEDGE BASES: You have access to these knowledge bases: ${kbNames}. Relevant excerpts will be provided during the conversation. Use them to give accurate, informed answers.`);
  }

  if (agentProfile.language === 'ru') {
    parts.push('Speak in Russian. Respond naturally as if on a phone call.');
  } else {
    parts.push('Speak in English. Respond naturally as if on a phone call.');
  }
  parts.push('Keep responses concise — this is a phone conversation, not a chat.');
  parts.push('Never use markdown, bullet points, or formatting. Speak naturally.');
  parts.push(`CALL ENDING RULES:
- When the caller says goodbye ("bye", "пока", "до свидания", "всё, пока") — say ONE short farewell (max 5 words) and add [END_CALL] at the end.
- When you have completed your goal/mission — say a brief closing and add [END_CALL].
- NEVER say goodbye more than once. One farewell + [END_CALL]. That's it.
- Do NOT repeat farewell phrases. If you already said goodbye, do NOT generate another response.`);

  return parts.join('\n\n');
}

async function loadCallerContext(workspaceId: string, phoneNumber: string): Promise<string | undefined> {
  const [profile] = await db.select().from(callerProfiles)
    .where(and(
      eq(callerProfiles.workspace_id, workspaceId),
      eq(callerProfiles.phone_number, phoneNumber),
    ));

  if (!profile) return undefined;

  const facts = await db.select().from(callerMemoryFacts)
    .where(and(
      eq(callerMemoryFacts.caller_profile_id, profile.id),
      eq(callerMemoryFacts.is_resolved, false),
    ))
    .orderBy(desc(callerMemoryFacts.created_at))
    .limit(10);

  const parts: string[] = [];
  if (profile.name) parts.push(`Caller name: ${profile.name}`);
  if (profile.relationship) parts.push(`Relationship: ${profile.relationship}`);
  parts.push(`Previous calls: ${profile.total_calls}`);

  if (facts.length > 0) {
    parts.push('Recent context:');
    for (const fact of facts) {
      parts.push(`- [${fact.fact_type}] ${fact.content}`);
    }
  }

  return parts.join('\n');
}

export default mediaStreamRoutes;
