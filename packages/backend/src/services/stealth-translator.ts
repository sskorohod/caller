import { EventEmitter } from 'node:events';
import pino from 'pino';
import { WebSocket } from 'ws';
import { eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import { translatorSessions, calls as callsTable } from '../db/schema.js';
import { getIo } from '../realtime/io.js';
import * as callService from './call.service.js';
import { calculateTelephonyCost } from '../config/pricing.js';
import { LANG_NAMES } from '../config/languages.js';
import { DeepgramSTT, OpenAISTT, type STTProvider, type TranscriptEvent } from './stt.service.js';
import { XaiTTS, OpenAITTS, type TTSChunk } from './tts.service.js';
import { detectTranslationDirection } from '../lib/lang-direction.js';
import { translateText } from './translate-text.js';
import type { TranslatorCarryover } from './conference-translator.js';

const log = pino({ name: 'stealth-translator' });

export interface StealthTranslatorOptions {
  callId: string;
  workspaceId: string;
  myLanguage: string;      // subscriber's language (e.g. 'ru')
  targetLanguage: string;  // other party's language (e.g. 'en')
  socket: WebSocket;       // Twilio media stream (audio source; also sink when speak=true)
  streamSid: string;
  /** Speak the translation back into the call (voice pipeline) vs silent text-only (stealth). */
  speak?: boolean;
  /** One-way: only speak the subscriber→other direction (other side shown as text). */
  oneWay?: boolean;
  /** Greeting spoken to the other party at call start (voice pipeline only). */
  greetingText?: string;
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

// TTS provider for the voice pipeline (speak=true). Default xAI Grok TTS — it
// outputs µ-law 8kHz natively (no conversion); OpenAI TTS outputs PCM 24kHz that
// we downsample via pcmToMulaw.
const TTS_PROVIDER = (process.env.VOICE_TTS_PROVIDER || 'xai') as 'xai' | 'openai';
const TTS_CRED = TTS_PROVIDER === 'openai' ? 'openai' : 'xai';
const TTS_VOICE = process.env.VOICE_TTS_VOICE || (TTS_PROVIDER === 'openai' ? 'alloy' : 'eve');

/** Data returned by doPrecompute — translation done, TTS is streaming in background. */
interface StreamingPlayData {
  translated: string;
  langCode: string;
  /** Mulaw 8kHz audio chunks; array grows as TTS streams. Reference stays valid. */
  mulawChunks: Buffer[];
  /** Resolves when the TTS API call finishes (all chunks buffered). */
  ttsComplete: Promise<void>;
  /** Register callback invoked for each new chunk arriving from the TTS stream. */
  setOnChunk: (fn: (buf: Buffer) => void) => void;
}

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
  // Voice pipeline (speak=true) reports as 'voice' so the mid-call mode toggle
  // treats it like a voice engine; silent stealth reports as 'stealth'.
  get engine() { return this.speak ? 'voice' : 'stealth'; }
  private speak: boolean;
  private oneWay: boolean;
  private greetingText: string;
  private carryover?: TranslatorCarryover;
  private callId: string;
  private workspaceId: string;
  private myLang: string;
  private targetLang: string;
  private streamSid: string;
  private twilioSocket: WebSocket;

  private stt: STTProvider | null = null;
  private translateApiKey = '';
  private ttsApiKey = '';
  // Echo suppression: while we're playing TTS into the line, the phone mic picks
  // it up — drop incoming audio so Deepgram doesn't transcribe our own voice.
  private playing = false;
  private playbackTimer?: ReturnType<typeof setTimeout>;
  private playbackResolve?: () => void;
  // Pause/resume barge-in. The full µ-law of the clip currently playing is kept so
  // a short interjection can pause it and resume from the same spot. Twilio gives
  // no playback-position feedback, so position is estimated from elapsed wall-clock
  // time (µ-law 8kHz = 8 bytes/ms).
  private playbackBuffer: Buffer = Buffer.alloc(0); // grows as chunks are sent
  private playbackStartAt = 0;                        // when the current play segment began streaming
  private playbackPaused = false;                     // paused by a short (<BARGE_IN_MS) barge-in
  private pausedAtByte = 0;                            // byte offset reached when we paused
  private resumeTimer?: ReturnType<typeof setTimeout>; // fires when the user goes quiet → resume
  private bargeCaptured: string[] = [];               // finalized speech heard during a barge-in
  // Resume the paused clip once the user is quiet this long (short interjection).
  private static readonly RESUME_SILENCE_MS = 800;
  // Replay ~0.8s of already-played audio on resume so the thought isn't cut (µ-law 8kHz).
  private static readonly REWIND_BYTES = 6400;
  // Barge-in echo filter: text we're currently speaking + recent outputs, so we
  // can tell our own TTS (heard back on the mic) from a real interruption.
  private currentSpokenNorm = '';
  private recentSpoken: string[] = [];
  // Barge-in requires sustained real speech (≥ BARGE_IN_MS of continuous talking,
  // gaps < 800ms) before it cuts our playback — so a stray sound or a short word
  // doesn't interrupt the translation. Default 3000ms per user request: only stop
  // the translator if the user keeps talking for 3 full seconds.
  private bargeInStartAt: number | null = null;
  private lastNonEchoAt = 0;
  private static readonly BARGE_IN_MS = Number(process.env.VOICE_BARGE_IN_MS) || 3000;
  // Voice mode: accumulate finalized segments and commit the whole utterance on
  // utterance_end (a pause) so we don't translate/speak before the person is done.
  private segmentBuffer: string[] = [];

  private transcript: Array<{ speaker: string; text: string; lang: string; translated: string; timestamp: string }> = [];
  private sessionId: string | null = null;
  private startTime = Date.now();
  private saved = false;
  private paused = false;
  private safetyTimer?: ReturnType<typeof setTimeout>;
  private statsTimer?: ReturnType<typeof setInterval>;
  // Idle hangup: no successful translation (silence or no-translation) for this
  // long → end the call so an off-hook line isn't billed indefinitely.
  private idleTimer?: ReturnType<typeof setTimeout>;
  private static readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000;

  // Live (non-final) tail of the current segment — shown as the "Listening…"
  // original; translated only once it finalizes (append-only).
  private latestInterim = '';

  // Serialize commits so transcript order is preserved (one is_final segment per turn).
  private commitChain: Promise<void> = Promise.resolve();

  // Streaming pre-computation: on each isFinal segment (voice mode), immediately
  // translate the accumulated text then stream TTS in background. By utterance_end
  // (1 s of silence), translation is done and TTS chunks have been accumulating
  // for ~400-800 ms → playback starts at utterance_end with near-zero extra wait.
  private precomputeState: {
    text: string;
    abort: AbortController;
    promise: Promise<StreamingPlayData | null>;
  } | null = null;

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
    this.twilioSocket = options.socket;
    this.speak = options.speak ?? false;
    this.oneWay = options.oneWay ?? false;
    this.greetingText = options.greetingText ?? '';
    this.carryover = options.carryover;
  }

  async start(): Promise<void> {
    const { resolveCredentialsWithGlobalFallback } = await import('./credential-resolver.service.js');

    // Translation provider key (OpenAI by default).
    const tcreds = await resolveCredentialsWithGlobalFallback<{ api_key: string }>(this.workspaceId, TRANSLATE_CRED);
    this.translateApiKey = tcreds.api_key;

    // TTS provider key (voice pipeline only).
    if (this.speak) {
      const ttsCreds = await resolveCredentialsWithGlobalFallback<{ api_key: string }>(this.workspaceId, TTS_CRED);
      this.ttsApiKey = ttsCreds.api_key;
    }

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
      // endpointing: 200 — sends isFinal after 200ms of silence, starting pre-computation.
      // utteranceEndMs: 1400 — commit only after 1.4 s of true silence. This is the
      // value the Grok engine used when the product "worked great": it lets the
      // speaker pause to think (breathing, between sentences, searching for a word)
      // without the system deciding they're done and cutting in mid-thought. 1000ms
      // was too aggressive — a ~1 s thinking pause triggered a premature commit and
      // the translation played over the still-speaking user. Pre-computation runs
      // during this window, so playback still starts immediately once it fires.
      this.stt.connect({ language: STT_LANGUAGE, model: STT_MODEL, endpointing: 200, utteranceEndMs: 1400 });
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

    // Arm idle-hangup (reset on each successful translation).
    this.resetIdleTimer();

    // Voice pipeline: greet the other party once at call start (not on swap-in).
    if (this.speak && this.greetingText && !this.carryover) {
      this.commitChain = this.commitChain.then(() => this.speakTranslation(this.greetingText, this.targetLang)).catch(() => {});
    }

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

  /** Feed inbound Twilio µ-law audio to the STT. We keep feeding during TTS
   *  playback so we can detect a real interruption (barge-in); our own TTS heard
   *  back on the mic is filtered out by text in onTranscript. */
  sendAudio(audioBuffer: Buffer): void {
    if (this.paused) return;
    this.stt?.sendAudio(audioBuffer);
  }

  private onTranscript(e: TranscriptEvent): void {
    if (this.saved || this.paused) return;
    const text = (e.text || '').trim();
    if (!text) return;

    // While our TTS is playing and the user starts talking over it:
    //  • ignore our own TTS echo,
    //  • pause playback immediately so the two voices don't overlap,
    //  • SHORT interjection (< BARGE_IN_MS, then a quiet gap): resume the clip from
    //    where we paused (rewound a touch for continuity); the interjection is
    //    dropped, not translated.
    //  • SUSTAINED speech (≥ BARGE_IN_MS continuous, gaps < 800ms): full stop —
    //    discard the rest of the clip and translate the whole interjection from the
    //    moment the user began talking.
    if (this.playing) {
      if (this.isEcho(text)) return;
      const now = Date.now();
      if (this.bargeInStartAt === null || now - this.lastNonEchoAt > 800) this.bargeInStartAt = now;
      this.lastNonEchoAt = now;

      // First real speech over playback → pause right away.
      if (!this.playbackPaused) this.pausePlayback();

      // Capture finalized speech so escalation can translate the whole thought.
      if (e.isFinal) this.bargeCaptured.push(text);

      // (Re)arm the resume timer: if the user goes quiet before hitting BARGE_IN_MS,
      // resume the paused clip and drop the interjection.
      if (this.resumeTimer) clearTimeout(this.resumeTimer);
      this.resumeTimer = setTimeout(() => this.resumePlayback(), StealthTranslator.RESUME_SILENCE_MS);

      if (now - this.bargeInStartAt < StealthTranslator.BARGE_IN_MS) return; // still short — keep paused

      // Sustained → escalate to a full stop and translate the captured interjection.
      if (this.resumeTimer) { clearTimeout(this.resumeTimer); this.resumeTimer = undefined; }
      this.bargeInStartAt = null;
      this.stopPlayback();                       // discard the paused clip
      const captured = this.bargeCaptured.slice();
      this.bargeCaptured = [];
      if (this.speak && captured.length) {
        // Seed the new utterance with everything heard since the barge-in began, so
        // the translation covers the full thought from the start.
        this.segmentBuffer.push(...captured);
        this.startPrecompute(this.segmentBuffer.join(' ').trim());
        return; // utterance_end will commit; this segment is already captured
      }
      // fall through and process this (sustained) speech normally
    }

    if (e.isFinal) {
      if (this.speak) {
        // Voice: accumulate the utterance; commit the whole thing on the pause.
        this.segmentBuffer.push(text);
        this.latestInterim = '';
        // Start pre-computing translate+TTS immediately. If another isFinal arrives
        // before utterance_end, the previous pre-compute is cancelled and restarted
        // with the fuller text — the final pre-compute runs during the silence window
        // so audio is ready (or near-ready) when utterance_end fires.
        this.startPrecompute(this.segmentBuffer.join(' ').trim());
      } else {
        // Stealth (text): commit each finalized segment immediately (responsive).
        this.latestInterim = '';
        const seg = text;
        this.commitChain = this.commitChain.then(() => this.commitTurn(seg)).catch(() => {});
      }
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
    // Speaker paused → end of thought. Commit ONLY finalized segments. Deepgram
    // sends UtteranceEnd after the matching is_final, so everything the speaker
    // actually finished is already in segmentBuffer. latestInterim at this point
    // is a not-yet-finalized tail — typically the START of the next phrase the
    // speaker began during the pause. Including it caused that fragment to be
    // committed with the current turn AND again with the next (the "А ещё"
    // duplication). Leave latestInterim intact so it finalizes into its own turn.
    const full = this.segmentBuffer.join(' ').trim();
    this.segmentBuffer = [];
    if (!full) return;

    // Voice mode: check if pre-computation started on the last isFinal matches.
    // If so, await it (it's been running in parallel) → near-zero additional wait.
    const pc = this.precomputeState;
    this.precomputeState = null;

    if (this.speak && pc && pc.text === full) {
      this.commitChain = this.commitChain.then(async () => {
        let playData: StreamingPlayData | null = null;
        try { playData = await pc.promise; } catch { /* fall through */ }
        if (playData) {
          await this.commitTurnWithPrecomputed(full, playData);
        } else {
          await this.commitTurn(full);
        }
      }).catch(() => {});
    } else {
      // No matching pre-compute (text changed due to latestInterim tail, or no speak).
      this.commitChain = this.commitChain.then(() => this.commitTurn(full)).catch(() => {});
    }
  }

  /** Start translate → TTS-stream pipeline for the accumulated text. Cancelled and
   *  restarted on each new isFinal; the final call runs during the 1 s silence
   *  window so translation is done and TTS is already streaming by utterance_end. */
  private startPrecompute(text: string): void {
    if (!text) return;
    this.precomputeState?.abort.abort();
    const abort = new AbortController();
    this.precomputeState = { text, abort, promise: this.doPrecompute(text, abort.signal) };
  }

  private async doPrecompute(
    text: string, signal: AbortSignal,
  ): Promise<StreamingPlayData | null> {
    const dir = detectTranslationDirection(text, this.myLang, this.targetLang);
    const langCode = dir.isMyLang ? this.targetLang : this.myLang;
    const targetLangName = LANG_NAMES[langCode] || langCode;
    if (this.oneWay && !dir.isMyLang) return null;

    // Phase 1: translate (~300-600 ms). Promise resolves HERE — not after TTS.
    const translated = (await translateText(text, targetLangName, {
      apiKey: this.translateApiKey, baseUrl: TRANSLATE_BASE_URL, model: TRANSLATE_MODEL,
    })) || '';
    if (signal.aborted || !translated) return null;

    // Phase 2: stream TTS in background — chunks accumulate in mulawChunks while
    // the caller waits for utterance_end. By the time speakTranslation is called,
    // most or all audio is buffered → playback starts at utterance_end with zero
    // (or minimal) extra wait regardless of translation length.
    const mulawChunks: Buffer[] = [];
    let chunkCallback: ((buf: Buffer) => void) | null = null;
    let ttsResolve!: () => void;
    const ttsComplete = new Promise<void>(r => { ttsResolve = r; });

    const runTTS = async () => {
      try {
        if (TTS_PROVIDER === 'openai') {
          // OpenAI returns PCM — await full synthesis then convert in one shot.
          const pcm = await new OpenAITTS(this.ttsApiKey, TTS_VOICE).synthesize(translated);
          if (!signal.aborted) {
            const { pcmToMulaw } = await import('../routes/webhooks/media-stream.js');
            const buf = pcmToMulaw(pcm);
            mulawChunks.push(buf);
            chunkCallback?.(buf);
          }
        } else {
          // xAI returns mulaw 8kHz natively — each HTTP chunk plays immediately.
          const tts = new XaiTTS(this.ttsApiKey, TTS_VOICE.toLowerCase(), langCode || 'en');
          tts.on('chunk', (c: TTSChunk) => {
            if (signal.aborted) return;
            mulawChunks.push(c.audio);
            chunkCallback?.(c.audio);
          });
          await tts.synthesize(translated);
        }
      } catch { /* ttsComplete resolves below; playback falls back to commitTurn */ }
      ttsResolve();
    };
    void runTTS(); // fire-and-forget: runs in background during 1 s silence window

    return {
      translated,
      langCode,
      mulawChunks,
      ttsComplete,
      setOnChunk: (fn) => { chunkCallback = fn; },
    };
  }

  /** Fast commit path: translation pre-computed, TTS already streaming into buffer. */
  private async commitTurnWithPrecomputed(
    original: string, playData: StreamingPlayData,
  ): Promise<void> {
    if (this.paused || this.saved) return;
    const { translated, langCode } = playData;
    const on = this.normalize(original);
    if (on && this.recentSpoken.some(s => s.includes(on) || on.includes(s))) return;

    const dir = detectTranslationDirection(original, this.myLang, this.targetLang);
    const speaker = dir.isMyLang ? 'subscriber' : 'other';

    if (translated) this.resetIdleTimer();
    this.transcript.push({ speaker, text: original, lang: dir.detectedLang, translated, timestamp: new Date().toISOString() });

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
      speaker, input_chars: original.length, output_chars: translated.length, spoke: true,
    }, 'stealth_chunk_metrics');

    if (translated && (!this.oneWay || speaker === 'subscriber')) {
      await this.speakTranslation(translated, langCode, playData);
    }
  }

  private async commitTurn(original: string): Promise<void> {
    if (this.paused || this.saved) return;
    // Loop guard: if this matches something we just spoke, it's our own TTS that
    // slipped past the echo filter — never re-translate/re-speak it.
    if (this.speak) {
      const on = this.normalize(original);
      if (on && this.recentSpoken.some(s => s.includes(on) || on.includes(s))) return;
    }
    const dir = detectTranslationDirection(original, this.myLang, this.targetLang);
    const targetLangCode = dir.isMyLang ? this.targetLang : this.myLang;
    const targetLangName = LANG_NAMES[targetLangCode] || targetLangCode;
    const speaker = dir.isMyLang ? 'subscriber' : 'other';

    const translated = (await translateText(original, targetLangName, {
      apiKey: this.translateApiKey, baseUrl: TRANSLATE_BASE_URL, model: TRANSLATE_MODEL,
    })) || '';

    if (translated) this.resetIdleTimer(); // real translation → not idle

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
      speaker, input_chars: original.length, output_chars: translated.length, spoke: this.speak && !!translated,
    }, 'stealth_chunk_metrics');

    // Voice pipeline: speak the translation back into the call. In one-way mode
    // only the subscriber→other direction is spoken (the other side is text-only).
    // Awaited so the commit chain keeps playback serialized (no overlapping TTS).
    const shouldSpeak = this.speak && !!translated && (!this.oneWay || speaker === 'subscriber');
    if (shouldSpeak) {
      await this.speakTranslation(translated, targetLangCode);
    }
  }

  /** Speak translation into the call (µ-law 8kHz). When streaming data is provided
   *  (from pre-compute), plays buffered chunks immediately and streams the remainder
   *  as they arrive from the TTS API — no batch wait even for long translations. */
  private async speakTranslation(
    text: string, langCode: string, streaming?: StreamingPlayData,
  ): Promise<void> {
    if (this.saved || this.twilioSocket.readyState !== 1) return;
    try {
      const norm = this.normalize(text);
      this.currentSpokenNorm = norm;
      this.recentSpoken.push(norm);
      if (this.recentSpoken.length > 5) this.recentSpoken.shift();
      this.playing = true;
      this.playbackPaused = false;
      this.playbackBuffer = Buffer.alloc(0);
      this.playbackStartAt = 0;
      if (this.playbackTimer) clearTimeout(this.playbackTimer);

      // Accumulate the full clip (for pause/resume) while streaming it to Twilio
      // for low latency. Position is estimated from playbackStartAt (set on the
      // first byte actually sent).
      const appendAndSend = (buf: Buffer) => {
        this.playbackBuffer = Buffer.concat([this.playbackBuffer, buf]);
        if (this.playing && !this.playbackPaused) {
          if (this.playbackStartAt === 0) this.playbackStartAt = Date.now();
          this.sendToTwilio(buf);
        }
      };

      if (streaming) {
        // Snapshot the buffer accumulated during pre-compute, register for new
        // chunks, play snapshot. No race: JS is single-threaded — new chunks only
        // arrive at the await below, after the callback is registered.
        const snapshot = [...streaming.mulawChunks];
        streaming.setOnChunk((buf) => { if (this.playing) appendAndSend(buf); });
        for (const chunk of snapshot) appendAndSend(chunk);
        await streaming.ttsComplete;
      } else {
        // Fallback batch path (commitTurn or pre-compute unavailable).
        let mulaw: Buffer;
        if (TTS_PROVIDER === 'openai') {
          const pcm = await new OpenAITTS(this.ttsApiKey, TTS_VOICE).synthesize(text);
          const { pcmToMulaw } = await import('../routes/webhooks/media-stream.js');
          mulaw = pcmToMulaw(pcm);
        } else {
          mulaw = await new XaiTTS(this.ttsApiKey, TTS_VOICE.toLowerCase(), langCode || 'en').synthesize(text);
        }
        if (this.saved || mulaw.length === 0 || this.twilioSocket.readyState !== 1) {
          this.playing = false; this.currentSpokenNorm = ''; return;
        }
        appendAndSend(mulaw);
      }

      if (this.playbackBuffer.length === 0 || !this.playing) {
        this.playing = false; this.currentSpokenNorm = ''; return;
      }

      // Wait for the clip to finish + a tail guard. finishPlayback resolves this —
      // either from the timer below, or after a pause/resume cycle. While paused,
      // the timer is cleared and resumePlayback re-arms it for the remaining tail.
      await new Promise<void>(resolve => {
        this.playbackResolve = resolve;
        if (!this.playbackPaused) {
          const remainingMs = (this.playbackBuffer.length / 8) + 400;
          this.playbackTimer = setTimeout(() => this.finishPlayback(), remainingMs);
        }
      });
      this.currentSpokenNorm = '';
    } catch (err) {
      this.playing = false;
      this.currentSpokenNorm = '';
      log.warn({ err, callId: this.callId }, 'TTS playback failed');
    }
  }

  /** Send a µ-law buffer to Twilio in 640-byte (80ms) media frames. */
  private sendToTwilio(buf: Buffer): void {
    if (this.twilioSocket.readyState !== 1) return;
    for (let i = 0; i < buf.length; i += 640) {
      this.twilioSocket.send(JSON.stringify({
        event: 'media', streamSid: this.streamSid,
        media: { payload: buf.subarray(i, i + 640).toString('base64') },
      }));
    }
  }

  /** Short barge-in started: pause playback, flush Twilio's buffer, remember the
   *  byte position (estimated from elapsed time) so we can resume from there. */
  private pausePlayback(): void {
    if (!this.playing || this.playbackPaused || this.playbackStartAt === 0) return;
    this.playbackPaused = true;
    const elapsedMs = Date.now() - this.playbackStartAt;
    this.pausedAtByte = Math.min(this.playbackBuffer.length, Math.max(0, Math.floor(elapsedMs * 8)));
    if (this.twilioSocket.readyState === 1) {
      try { this.twilioSocket.send(JSON.stringify({ event: 'clear', streamSid: this.streamSid })); } catch { /* ignore */ }
    }
    if (this.playbackTimer) { clearTimeout(this.playbackTimer); this.playbackTimer = undefined; }
    // Do NOT resolve the playback promise — the clip is paused, not finished.
  }

  /** Short interjection ended (user went quiet): resume the paused clip from where
   *  we left off, rewound ~0.8s for continuity. The interjection is discarded. */
  private resumePlayback(): void {
    if (this.resumeTimer) { clearTimeout(this.resumeTimer); this.resumeTimer = undefined; }
    if (!this.playing || !this.playbackPaused) return;
    this.playbackPaused = false;
    this.bargeInStartAt = null;
    this.bargeCaptured = [];
    const startByte = Math.max(0, this.pausedAtByte - StealthTranslator.REWIND_BYTES);
    const tail = this.playbackBuffer.subarray(startByte);
    if (tail.length === 0 || this.twilioSocket.readyState !== 1) { this.finishPlayback(); return; }
    this.playbackStartAt = Date.now() - (startByte / 8);
    this.sendToTwilio(tail);
    const remainingMs = ((this.playbackBuffer.length - startByte) / 8) + 400;
    this.playbackTimer = setTimeout(() => this.finishPlayback(), remainingMs);
  }

  /** Clip finished (or stopped): clear state and resolve the speakTranslation wait. */
  private finishPlayback(): void {
    this.playing = false;
    this.playbackPaused = false;
    this.bargeInStartAt = null;
    if (this.playbackTimer) { clearTimeout(this.playbackTimer); this.playbackTimer = undefined; }
    if (this.resumeTimer) { clearTimeout(this.resumeTimer); this.resumeTimer = undefined; }
    if (this.playbackResolve) { this.playbackResolve(); this.playbackResolve = undefined; }
  }

  /** Full stop (sustained barge-in / teardown): discard the clip + flush Twilio. */
  private stopPlayback(): void {
    if (!this.playing) return;
    if (this.twilioSocket.readyState === 1) {
      try { this.twilioSocket.send(JSON.stringify({ event: 'clear', streamSid: this.streamSid })); } catch { /* ignore */ }
    }
    this.playbackBuffer = Buffer.alloc(0);
    this.currentSpokenNorm = '';
    this.finishPlayback();
  }

  private normalize(s: string): string {
    return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  }

  /** True if transcribed text is (part of) what we're currently/recently speaking. */
  private isEcho(text: string): boolean {
    const t = this.normalize(text);
    if (!t) return true;
    if (this.currentSpokenNorm && (this.currentSpokenNorm.includes(t) || t.includes(this.currentSpokenNorm))) return true;
    return this.recentSpoken.some(s => s.includes(t) || t.includes(s));
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

  // 1-way/2-way toggle (voice pipeline). 'text'/'unidirectional' → one-way.
  // No-op for silent stealth. Page pushes this on connect too — safe to accept.
  updateMode(mode: string): void { this.oneWay = (mode === 'text' || mode === 'unidirectional'); }
  updateVoice(_voice: string): void { /* TTS voice fixed via VOICE_TTS_VOICE env */ }
  updateTone(_tone: string): void { /* tone only affects spoken output */ }

  /** (Re)arm the idle-hangup timer — called on each successful translation. */
  private resetIdleTimer(): void {
    if (this.saved) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => { void this.hangupOnIdle(); }, StealthTranslator.IDLE_TIMEOUT_MS);
  }

  /** No translation/silence for IDLE_TIMEOUT_MS → end the Twilio call. */
  private async hangupOnIdle(): Promise<void> {
    if (this.saved) return;
    log.warn({ callId: this.callId, idleMs: StealthTranslator.IDLE_TIMEOUT_MS }, 'Translator idle — hanging up call');
    try {
      const [row] = await db.select({ sid: callsTable.twilio_call_sid })
        .from(callsTable).where(eq(callsTable.id, this.callId)).limit(1);
      if (row?.sid) {
        const { hangupCall } = await import('./telephony.service.js');
        await hangupCall(this.workspaceId, row.sid);
      }
    } catch (err) {
      log.error({ err, callId: this.callId }, 'Idle hangup failed');
    }
    // Twilio ending the call closes the media stream → cleanup → finalize.
    this.finalize().catch(() => {});
  }

  stop(): void {
    this.finalize().catch(err => log.error({ err, callId: this.callId }, 'Finalize error on stop'));
  }

  /**
   * Tear down for a mid-call engine swap WITHOUT finalizing/billing. `saved`
   * blocks any stray STT event from emitting and makes finalize() a no-op.
   */
  detach(): TranslatorCarryover {
    this.saved = true;
    this.precomputeState?.abort.abort();
    this.precomputeState = null;
    if (this.safetyTimer) { clearTimeout(this.safetyTimer); this.safetyTimer = undefined; }
    if (this.statsTimer) { clearInterval(this.statsTimer); this.statsTimer = undefined; }
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = undefined; }
    if (this.playbackTimer) { clearTimeout(this.playbackTimer); this.playbackTimer = undefined; }
    if (this.resumeTimer) { clearTimeout(this.resumeTimer); this.resumeTimer = undefined; }
    this.playing = false;
    try { this.stt?.close(); } catch { /* ignore */ }
    return { sessionId: this.sessionId, startTime: this.startTime, transcript: this.transcript };
  }

  async finalize(): Promise<void> {
    if (this.saved) return;
    this.saved = true;
    this.precomputeState?.abort.abort();
    this.precomputeState = null;

    if (this.safetyTimer) { clearTimeout(this.safetyTimer); this.safetyTimer = undefined; }
    if (this.statsTimer) { clearInterval(this.statsTimer); this.statsTimer = undefined; }
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = undefined; }
    if (this.playbackTimer) { clearTimeout(this.playbackTimer); this.playbackTimer = undefined; }
    if (this.resumeTimer) { clearTimeout(this.resumeTimer); this.resumeTimer = undefined; }
    this.playing = false;
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
