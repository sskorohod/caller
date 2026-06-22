import { EventEmitter } from 'node:events';
import pino from 'pino';
import { WebSocket } from 'ws';
import { eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import { translatorSessions } from '../db/schema.js';
import { getIo } from '../realtime/io.js';
import * as callService from './call.service.js';
import { calculateTelephonyCost } from '../config/pricing.js';
import { LANG_NAMES } from '../config/languages.js';
import { DeepgramSTT, OpenAISTT, type STTProvider, type TranscriptEvent } from './stt.service.js';
import { detectTranslationDirection } from '../lib/lang-direction.js';
import { translateText } from './translate-text.js';
import type { TranslatorCarryover } from './conference-translator.js';

const log = pino({ name: 'stealth-translator' });

export interface StealthTranslatorOptions {
  callId: string;
  workspaceId: string;
  myLanguage: string;      // subscriber's language (e.g. 'ru')
  targetLanguage: string;  // other party's language (e.g. 'en')
  socket: WebSocket;       // Twilio media stream — audio SOURCE only; we never write back
  streamSid: string;
  /** Mid-call engine swap: reuse the existing session instead of starting fresh. */
  carryover?: TranslatorCarryover;
}

// Swappable STT provider/model/language — tune in prod without code changes.
const STT_PROVIDER = (process.env.STEALTH_STT_PROVIDER || 'deepgram') as 'deepgram' | 'openai';
// nova-3 multilingual code-switching covers ru+en on one mixed stream; nova-2's
// 'multi' is limited (es+en). If the account lacks nova-3, set STEALTH_STT_MODEL.
const STT_MODEL = process.env.STEALTH_STT_MODEL || 'nova-3';
// 'multi' = Deepgram code-switching (transcribe both languages on one mixed stream).
const STT_LANGUAGE = process.env.STEALTH_STT_LANGUAGE || 'multi';

// Translation provider (swappable). Default OpenAI gpt-4o-mini.
const TRANSLATE_PROVIDER = (process.env.STEALTH_TRANSLATE_PROVIDER || 'openai') as 'openai' | 'xai';
const TRANSLATE_CRED = TRANSLATE_PROVIDER === 'openai' ? 'openai' : 'xai';
const TRANSLATE_BASE_URL = TRANSLATE_PROVIDER === 'openai' ? 'https://api.openai.com/v1' : 'https://api.x.ai/v1';
const TRANSLATE_MODEL = process.env.STEALTH_TRANSLATE_MODEL
  || (TRANSLATE_PROVIDER === 'openai' ? 'gpt-4o-mini' : 'grok-3-mini');

/**
 * Stealth Translator — silent, text-only live interpretation.
 *
 * Unlike ConferenceTranslator (Grok Voice Agent, speaks on the line), Stealth:
 *   - transcribes via a fast streaming STT (Deepgram, swappable to OpenAI)
 *   - translates each chunk via a fast text model (grok-3-mini, swappable)
 *   - pushes interim drafts + authoritative finals to the /translate/<token> page
 *   - NEVER speaks: no TTS, no greeting, nothing written back to Twilio
 *
 * Audio flow:
 *   mixed audio (mulaw 8kHz) → Deepgram → text chunks → translateText → Socket.IO
 */
export class StealthTranslator extends EventEmitter {
  readonly engine = 'stealth' as const;
  private carryover?: TranslatorCarryover;
  private callId: string;
  private workspaceId: string;
  private myLang: string;
  private targetLang: string;
  private streamSid: string;

  private stt: STTProvider | null = null;
  private translateApiKey = '';

  private transcript: Array<{ speaker: string; text: string; lang: string; translated: string; timestamp: string }> = [];
  private sessionId: string | null = null;
  private startTime = Date.now();
  private saved = false;
  private paused = false;
  private safetyTimer?: ReturnType<typeof setTimeout>;
  private statsTimer?: ReturnType<typeof setInterval>;

  // Live (non-final) tail of the current segment — shown as the "Listening…"
  // original; translated only once it finalizes (append-only).
  private latestInterim = '';

  // Serialize commits so transcript order is preserved (one is_final segment per turn).
  private commitChain: Promise<void> = Promise.resolve();

  // Provider cost estimate (Deepgram STT + grok-3-mini chunks). Far below the
  // Grok Voice path (~$0.05/min) — stealth is genuinely cheaper.
  private static readonly COST_PER_MIN = 0.02;

  constructor(options: StealthTranslatorOptions) {
    super();
    this.callId = options.callId;
    this.workspaceId = options.workspaceId;
    this.myLang = options.myLanguage;
    this.targetLang = options.targetLanguage;
    this.streamSid = options.streamSid;
    this.carryover = options.carryover;
  }

  async start(): Promise<void> {
    const { resolveCredentialsWithGlobalFallback } = await import('./credential-resolver.service.js');

    // Translation provider key (OpenAI by default).
    const tcreds = await resolveCredentialsWithGlobalFallback<{ api_key: string }>(this.workspaceId, TRANSLATE_CRED);
    this.translateApiKey = tcreds.api_key;

    // STT provider.
    if (STT_PROVIDER === 'openai') {
      const openai = await resolveCredentialsWithGlobalFallback<{ api_key: string }>(this.workspaceId, 'openai');
      this.stt = new OpenAISTT(openai.api_key);
    } else {
      const dg = await resolveCredentialsWithGlobalFallback<{ api_key: string }>(this.workspaceId, 'deepgram');
      this.stt = new DeepgramSTT(dg.api_key);
    }
    this.wireSTT();

    if (this.stt instanceof DeepgramSTT) {
      // endpointing 200 keeps a non-final window during fluent speech so the live
      // draft translation has time to show. NB: utterance_end_ms must be >= 1000.
      this.stt.connect({ language: STT_LANGUAGE, model: STT_MODEL, endpointing: 200, utteranceEndMs: 1000 });
    } else {
      this.stt.connect({}); // OpenAI whisper auto-detects language
    }

    if (this.carryover) {
      // Mid-call engine swap — reuse session & accumulated state (copy transcript
      // so a stray event on the detached engine can't mutate ours).
      this.sessionId = this.carryover.sessionId;
      this.startTime = this.carryover.startTime;
      this.transcript = this.carryover.transcript.slice();
    } else {
      // Create translator session record (same table as the voice translator).
      const [session] = await db.insert(translatorSessions).values({
        subscriber_id: null as any,
        call_id: this.callId,
        workspace_id: this.workspaceId,
      }).returning();
      this.sessionId = session.id;
    }

    // Safety timer (4 hours max).
    this.safetyTimer = setTimeout(() => {
      log.warn({ callId: this.callId }, 'Stealth translator safety timer fired');
      this.finalize().catch(() => {});
    }, 4 * 60 * 60 * 1000);

    // Live duration/cost stats for the /translate page header.
    this.statsTimer = setInterval(() => {
      const io = getIo();
      if (io) {
        const secs = Math.floor((Date.now() - this.startTime) / 1000);
        io.to(`call:${this.callId}`).emit('translator:stats', {
          call_id: this.callId,
          duration_seconds: secs,
          cost_usd: (secs / 60) * StealthTranslator.COST_PER_MIN,
        });
      }
    }, 5000);

    log.info({
      callId: this.callId, myLang: this.myLang, targetLang: this.targetLang,
      sttProvider: STT_PROVIDER, sttModel: STT_MODEL, sttLanguage: STT_LANGUAGE,
      translateProvider: TRANSLATE_PROVIDER, translateModel: TRANSLATE_MODEL,
    }, 'Stealth translator started');
  }

  private wireSTT(): void {
    if (!this.stt) return;
    this.stt.on('open', () => log.info({ callId: this.callId }, 'Stealth STT connected'));
    this.stt.on('error', (err: Error) => log.error({ err, callId: this.callId }, 'Stealth STT error'));
    this.stt.on('transcript', (e: TranscriptEvent) => this.onTranscript(e));
    this.stt.on('utterance_end', () => this.onUtteranceEnd());
  }

  /** Feed inbound Twilio µ-law audio to the STT. */
  sendAudio(audioBuffer: Buffer): void {
    if (this.paused) return;
    this.stt?.sendAudio(audioBuffer);
  }

  private onTranscript(e: TranscriptEvent): void {
    if (this.saved || this.paused) return;
    const text = (e.text || '').trim();
    if (!text) return;

    if (e.isFinal) {
      // Append-only: translate each finalized segment exactly once and commit it.
      // No re-translation of a growing buffer → no flicker, no lag, no stalling
      // on long speech. The frontend merges consecutive segments into a flowing
      // block so it doesn't look like many separate lines.
      this.latestInterim = '';
      const seg = text;
      this.commitChain = this.commitChain.then(() => this.commitTurn(seg)).catch(() => {});
    } else {
      // Live original (typing feel) for the "Listening…" indicator — NOT a
      // translated draft, so the translation text never rewrites/blinks.
      this.latestInterim = text;
      const io = getIo();
      if (io) {
        io.to(`call:${this.callId}`).emit('call:transcript', {
          call_id: this.callId, text, isFinal: false, timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private onUtteranceEnd(): void {
    if (this.saved) return;
    // Flush any trailing non-final words that never got an is_final segment.
    const tail = this.latestInterim.trim();
    this.latestInterim = '';
    if (!tail) return;
    this.commitChain = this.commitChain.then(() => this.commitTurn(tail)).catch(() => {});
  }

  private async commitTurn(original: string): Promise<void> {
    if (this.paused || this.saved) return;
    const dir = detectTranslationDirection(original, this.myLang, this.targetLang);
    const targetLangCode = dir.isMyLang ? this.targetLang : this.myLang;
    const targetLangName = LANG_NAMES[targetLangCode] || targetLangCode;
    const speaker = dir.isMyLang ? 'subscriber' : 'other';

    const translated = (await translateText(original, targetLangName, {
      apiKey: this.translateApiKey, baseUrl: TRANSLATE_BASE_URL, model: TRANSLATE_MODEL,
    })) || '';

    this.transcript.push({
      speaker, text: original, lang: dir.detectedLang, translated,
      timestamp: new Date().toISOString(),
    });

    const io = getIo();
    if (io) {
      io.to(`call:${this.callId}:translate`).emit('call:translation', {
        call_id: this.callId, speaker, original, translated,
        detected_language: dir.detectedLang, timestamp: new Date().toISOString(),
      });
      io.to(`call:${this.callId}`).emit('call:transcript', {
        call_id: this.callId, speaker: 'conference', text: original,
        timestamp: new Date().toISOString(), isFinal: true,
      });
    }

    log.info({
      callId: this.callId, metric: 'stealth_chunk_metrics',
      speaker, input_chars: original.length, output_chars: translated.length,
    }, 'stealth_chunk_metrics');
  }

  /** Update language pair mid-call (from the /translate page selector). */
  updateLanguages(myLang: string, targetLang: string): void {
    this.myLang = myLang;
    this.targetLang = targetLang;
    log.info({ callId: this.callId, myLang, targetLang }, 'Stealth translator languages updated');
  }

  pause(): void { this.paused = true; log.info({ callId: this.callId }, 'Stealth translator paused'); }
  resume(): void { this.paused = false; log.info({ callId: this.callId }, 'Stealth translator resumed'); }
  isPaused(): boolean { return this.paused; }

  // Voice-only controls — no-ops in stealth (page hides them, but the page also
  // pushes current state on connect, so accept and ignore).
  updateMode(_mode: string): void { /* stealth has no voice mode */ }
  updateVoice(_voice: string): void { /* no TTS in stealth */ }
  updateTone(_tone: string): void { /* tone only affects spoken output */ }

  stop(): void {
    this.finalize().catch(err => log.error({ err, callId: this.callId }, 'Finalize error on stop'));
  }

  /**
   * Tear down for a mid-call engine swap WITHOUT finalizing/billing. `saved`
   * blocks any stray STT event from emitting and makes finalize() a no-op.
   */
  detach(): TranslatorCarryover {
    this.saved = true;
    if (this.safetyTimer) { clearTimeout(this.safetyTimer); this.safetyTimer = undefined; }
    if (this.statsTimer) { clearInterval(this.statsTimer); this.statsTimer = undefined; }
    try { this.stt?.close(); } catch { /* ignore */ }
    return { sessionId: this.sessionId, startTime: this.startTime, transcript: this.transcript };
  }

  async finalize(): Promise<void> {
    if (this.saved) return;
    this.saved = true;

    if (this.safetyTimer) { clearTimeout(this.safetyTimer); this.safetyTimer = undefined; }
    if (this.statsTimer) { clearInterval(this.statsTimer); this.statsTimer = undefined; }
    try { this.stt?.close(); } catch { /* ignore */ }

    const durationSecs = Math.floor((Date.now() - this.startTime) / 1000);
    const durationMins = durationSecs / 60;
    const minutesUsed = Math.ceil(durationMins * 100) / 100;

    const costStt = durationMins * 0.0043;            // Deepgram nova-2
    const costLlm = durationMins * 0.01;              // grok-3-mini chunks (estimate)
    const costTelephony = calculateTelephonyCost('twilio', durationMins);
    const costTotal = costStt + costLlm + costTelephony;

    if (this.sessionId) {
      try {
        await db.update(translatorSessions).set({
          duration_seconds: durationSecs,
          minutes_used: String(minutesUsed),
          cost_usd: String(costTotal),
          transcript: this.transcript as any,
          status: 'completed',
        }).where(eq(translatorSessions.id, this.sessionId));
      } catch (err) {
        log.error({ err, callId: this.callId }, 'Failed to update stealth translator session');
      }
    }

    const aiSession = await callService.getAiSession(this.callId);
    if (aiSession) {
      const { finalizeSession } = await import('./session-finalizer.service.js');
      await finalizeSession({
        callId: this.callId,
        workspaceId: this.workspaceId,
        sessionId: aiSession.id,
        transcript: this.transcript,
        costs: { stt: costStt, llm: costLlm, tts: 0, telephony: costTelephony, sttProvider: STT_PROVIDER, llmProvider: 'xai' },
        durationSecs,
      });
    }

    log.info({ callId: this.callId, durationSecs, minutesUsed, costTotal, turns: this.transcript.length },
      'Stealth translator finalized');
  }
}
