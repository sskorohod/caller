import { EventEmitter } from 'node:events';
import pino from 'pino';
import { WebSocket } from 'ws';
import { eq, and } from 'drizzle-orm';
import { db } from '../config/db.js';
import { translatorSessions, calls as callsTable, workspaces as workspacesSchema } from '../db/schema.js';
import { getIo } from '../realtime/io.js';
import * as callService from './call.service.js';
import { calculateTelephonyCost } from '../config/pricing.js';
import { sendTranslatorSessionStart, sendTranslatorSessionEnd, sendAdminTranslatorStart, sendAdminTranslatorEnd } from './telegram.service.js';
import { decrypt } from '../lib/crypto.js';
import { providerCredentials } from '../db/schema.js';
import { env } from '../config/env.js';
import { detectTranslationDirection, languagesUseDifferentScripts as langsDifferentScripts, CYRILLIC_LANGS } from '../lib/lang-direction.js';
import { translateText } from './translate-text.js';

const log = pino({ name: 'conference-translator' });

interface ConferenceTranslatorOptions {
  callId: string;
  workspaceId: string;
  subscriberId: string;
  myLanguage: string;       // subscriber's language (e.g. 'ru')
  targetLanguage: string;   // other party's language (e.g. 'en')
  mode: 'voice' | 'text' | 'both' | 'unidirectional';
  whoHears: 'subscriber' | 'both';
  ttsProvider: string;
  ttsVoiceId?: string;
  tone?: string;
  personalContext?: string;
  greetingText?: string;
  /** Seconds to wait after connecting before speaking the greeting (default 5). */
  greetingDelaySeconds?: number;
  socket: WebSocket;        // Twilio media stream WebSocket
  streamSid: string;        // Twilio stream SID
  /** Mid-call engine swap: reuse the existing session instead of starting fresh. */
  carryover?: TranslatorCarryover;
}

/** State handed off when swapping translator engines mid-call (Grok ↔ Deepgram). */
export interface TranslatorCarryover {
  sessionId: string | null;
  startTime: number;
  transcript: Array<{ speaker: string; text: string; lang: string; translated: string; timestamp: string; untranslated?: boolean }>;
}

import { LANG_NAMES, TONE_INSTRUCTIONS } from '../config/languages.js';

// Last-resort fallback; the admin-configurable platform default lives in
// platform_settings.default_greeting (resolved at the media-stream
// construction site).
export const DEFAULT_GREETING = `Hi, I'm your AI interpreter. Please go ahead.`;

// Grok Voice Agent realtime model. We were passing the undocumented slug
// "grok-3-mini-fast", which xAI silently mapped to a default model. Around
// 2026-06 that default drifted to the "think" flagship — a REASONING model
// that reasons about being helpful and therefore ANSWERS utterances and
// appends helper phrases ("How can I help you?", "I'm ready to translate")
// instead of translating verbatim. Regression confirmed with zero code
// changes: a clean 90-turn call on 2026-05-27 vs additions on every turn by
// 2026-06-02; pinning the "think" flagship (grok-voice-think-fast-1.0) did
// NOT fix it, but the NON-thinking model below does — output_chars ≈
// input_chars, no additions, and lower latency.
//
// Pin: grok-voice-fast-1.0 (non-think) translates verbatim. Version-pinned so
// xAI churn can't silently change behavior again. Overridable via env.
const GROK_VOICE_MODEL = process.env.GROK_VOICE_MODEL || 'grok-voice-fast-1.0';

/**
 * Conference Translator — uses xAI Grok Voice Agent API for speech-to-speech
 * translation with minimal latency. Single WebSocket replaces STT+LLM+TTS pipeline.
 *
 * Audio flow:
 *   mixed audio (mulaw 8kHz) → Grok Voice Agent → translated audio (mulaw 8kHz) → inject
 */
export class ConferenceTranslator extends EventEmitter {
  readonly engine = 'voice' as const;
  private carryover?: TranslatorCarryover;
  private callId: string;
  private workspaceId: string;
  private subscriberId: string;
  private myLang: string;
  private targetLang: string;
  private mode: 'voice' | 'text' | 'both' | 'unidirectional';
  private whoHears: 'subscriber' | 'both';

  private grokWs: WebSocket | null = null;
  private twilioSocket: WebSocket;
  private streamSid: string;
  private ttsVoiceId?: string;
  private tone: string;
  private personalContext: string;
  private greetingText: string;
  private greetingDelaySeconds: number;

  private transcript: Array<{ speaker: string; text: string; lang: string; translated: string; timestamp: string; untranslated?: boolean }> = [];
  private sessionId: string | null = null;
  private startTime: number = Date.now();
  private saved: boolean = false;
  private safetyTimer?: ReturnType<typeof setTimeout>;
  private statsTimer?: ReturnType<typeof setInterval>;
  // Idle hangup: no successful translation (silence / no-translation) for this
  // long → end the call so an off-hook line isn't billed indefinitely.
  private idleTimer?: ReturnType<typeof setTimeout>;
  private static readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000;
  private xaiApiKey: string = '';
  private greetingSent: boolean = false;
  private greetingPlayed: boolean = false; // true once greeting response.done fires (or no greeting configured)

  // Accumulate transcript text from Grok responses
  private currentInputTranscript: string = '';
  private currentOutputTranscript: string = '';
  private currentResponseAudio: Buffer[] = []; // buffer audio until language verified
  private retranslationPending: boolean = false;
  private retranslationTimer: ReturnType<typeof setTimeout> | null = null;
  // Token makes the retranslation fallback idempotent: the timer-driven fallback
  // and a late Grok retry response.done race to resolve the same turn — whichever
  // resolves first bumps the token, invalidating the other.
  private retranslationToken: number = 0;
  // One-shot guard: after a fallback has already spoken a turn, drop the next
  // "system" (no-input) Grok response so a late retry can't double-speak.
  private suppressNextSystemResponse: boolean = false;
  private reconnectAttempts: number = 0;
  private intentionalReconnect: boolean = false; // true when reconnecting for settings change

  // Streaming TTS state — once approved, response.output_audio.delta is forwarded
  // to Twilio immediately instead of waiting for response.done.
  private streamingApproved: boolean = false;
  private streamedAlready: boolean = false;
  private currentInputDirectionKnown: boolean = false;
  private currentIsMyLang: boolean = false;

  // Playback protection — while a translation is being played to the caller,
  // ignore VAD speech_started events and drop incoming audio (up to MAX_UNINTERRUPTIBLE_PLAYBACK_MS).
  private playbackState: 'idle' | 'playing' = 'idle';
  private playbackStartedAt: number | null = null;
  private playbackBytesSent: number = 0;
  private chunksSinceMark: number = 0;
  private markCounter: number = 0;
  private markAcknowledged: number = 0;
  private playbackSafetyTimer: ReturnType<typeof setTimeout> | null = null;

  // Deferred barge-in — only interrupt the translation if speech is sustained for ≥4 seconds.
  // Short utterances (acknowledgements, fillers) must not cut off the translator mid-sentence.
  private speechStartedAt: number | null = null;

  // Per-turn timing instrumentation. Logged on response.done as a single
  // structured 'translator_turn_metrics' line so you can grep timings and
  // build dashboards later without a DB migration.
  private turnSpeechStoppedAt: number | null = null;
  private turnFirstInterimAt: number | null = null;
  private turnInterimCount: number = 0;
  private bargeInTimer: ReturnType<typeof setTimeout> | null = null;

  private static readonly MAX_UNINTERRUPTIBLE_PLAYBACK_MS = 6000;
  private static readonly MARK_CHUNK_INTERVAL = 25; // ~200ms of mulaw 8kHz audio
  // Was 4000. Lowered to 2000 because 4 s of "uninterruptible" translation
  // feels broken when the user actively wants to stop the bot. The timer is
  // also now only armed when something is actually being translated/played
  // (see speech_started handler) — so casual long-form speech with nothing
  // to interrupt no longer triggers a useless cancel.
  private static readonly BARGE_IN_THRESHOLD_MS = 2000;

  constructor(options: ConferenceTranslatorOptions) {
    super();
    this.callId = options.callId;
    this.workspaceId = options.workspaceId;
    this.subscriberId = options.subscriberId;
    this.myLang = options.myLanguage;
    this.targetLang = options.targetLanguage;
    this.mode = options.mode;
    this.whoHears = options.whoHears;
    this.twilioSocket = options.socket;
    this.streamSid = options.streamSid;
    this.ttsVoiceId = options.ttsVoiceId;
    this.tone = options.tone || 'business';
    this.personalContext = options.personalContext || '';
    this.greetingText = options.greetingText || DEFAULT_GREETING;
    const delay = options.greetingDelaySeconds;
    this.greetingDelaySeconds = Number.isFinite(delay) ? Math.min(30, Math.max(0, delay as number)) : 5;
    this.carryover = options.carryover;
  }

  async start(): Promise<void> {
    // Get xAI API key — global fallback (translator works for all plans)
    const { resolveCredentialsWithGlobalFallback } = await import('./credential-resolver.service.js');
    const creds = await resolveCredentialsWithGlobalFallback<{ api_key: string }>(this.workspaceId, 'xai');
    this.xaiApiKey = creds.api_key;

    if (this.carryover) {
      // Mid-call engine swap — reuse the existing session & accumulated state.
      // Copy the transcript so a stray event on the detached engine can't mutate ours.
      this.sessionId = this.carryover.sessionId;
      this.startTime = this.carryover.startTime;
      this.transcript = this.carryover.transcript.slice();
      this.greetingSent = true; // no greeting on swap-in — call is already in progress
    } else {
      // Create translator session record
      const [session] = await db
        .insert(translatorSessions)
        .values({
          subscriber_id: null as any,
          call_id: this.callId,
          workspace_id: this.workspaceId,
        })
        .returning();
      this.sessionId = session.id;
    }

    // Connect to Grok Voice Agent API
    this.connectGrok();

    // Safety timer (4 hours max)
    this.safetyTimer = setTimeout(() => {
      log.warn({ callId: this.callId }, 'Translator safety timer fired');
      this.finalize().catch(() => {});
    }, 4 * 60 * 60 * 1000);

    // Stats emitter — send duration + cost every 5 seconds
    this.statsTimer = setInterval(() => {
      const io = getIo();
      if (io) {
        const secs = Math.floor((Date.now() - this.startTime) / 1000);
        io.to(`call:${this.callId}`).emit('translator:stats', {
          call_id: this.callId,
          duration_seconds: secs,
          cost_usd: (secs / 60) * 0.05,
        });
      }
    }, 5000);

    // Arm idle-hangup (reset on each successful translation).
    this.resetIdleTimer();

    log.info({
      callId: this.callId,
      subscriber: this.subscriberId,
      myLang: this.myLang,
      targetLang: this.targetLang,
      mode: this.mode,
    }, 'Conference translator started (Grok Voice Agent)');

    // Telegram start notification is sent earlier (in twilio.ts inbound handler)
    // Only end notification is sent from here
  }

  private buildInstructions(): string {
    const myLangName = LANG_NAMES[this.myLang] || this.myLang;
    const targetLangName = LANG_NAMES[this.targetLang] || this.targetLang;
    const isOneWay = this.mode === 'text' || this.mode === 'unidirectional';

    const commonRules = `
- ALWAYS wait for the speaker to finish their complete thought before translating. A brief pause (1-2 seconds) does NOT mean the speaker is done — they may be thinking or breathing.
- NEVER output a partial or incomplete translation. If you only received a fragment (e.g. ending with "and", "but", "that", "to"), wait for more input and combine it into one complete translation.
- When translating numbers, be EXTREMELY precise. For numbers above 99, spell them out clearly (e.g. "one hundred thirty-eight dollars", NOT "three hundred thirty-eight"). Double-check that the number in your translation matches exactly what was spoken.
- If someone interrupts while you are translating, finish your current translation first, then translate the new speech. Do NOT drop incomplete translations.
- VERBATIM ONLY — THIS IS THE MOST IMPORTANT RULE: Your output must convey ONLY the meaning of the words that were actually spoken — nothing more, nothing less. NEVER add a single word the speaker did not say.
  · NEVER add helper/assistant phrases such as "I'm ready to translate", "I'm listening", "Please go ahead", "I'm ready", "Готов переводить", "Слушаю".
  · NEVER add follow-up questions the speaker did not ask, e.g. do NOT append "Which customer do you mean?", "Можете уточнить?", "Please tell me who you are", "If you have any questions, feel free to ask", "Если есть информация, поделитесь."
  · NEVER add closing pleasantries, offers of help, or any sentence beyond the literal translation.
  · If the speaker said one sentence, you output exactly one sentence's worth of meaning. The translation should be roughly the SAME length as the original — if your output is noticeably longer, you have added something forbidden. Remove it.
- ONLY output the translation. Do NOT add any commentary, greetings, or explanations.
- If you hear ONLY filler sounds (um, uh, er, hmm, М, Э, А, мм, ммм, угу) with NO actual words, do NOT translate or respond — produce NO output at all. These are thinking pauses, not speech.
- If you cannot understand something, stay silent — produce NO audio output.`;

    if (isOneWay) {
      return `You are a live phone interpreter.

Rules:
- When you hear ${myLangName}, translate it to ${targetLangName} and SPEAK the translation aloud.
- When you hear ${targetLangName}, translate it to ${myLangName} but ONLY output text — do NOT speak. Just provide a silent text translation.
${commonRules}

Tone: ${TONE_INSTRUCTIONS[this.tone] || TONE_INSTRUCTIONS.neutral}${this.personalContext ? `

Personal information about the subscriber (use when relevant — spell names carefully, dictate numbers clearly):
${this.personalContext}` : ''}`;
    }

    // Bidirectional: translate both directions with voice
    return `You are a TRANSLATION MACHINE. You are NOT a conversational assistant. You do NOT respond to questions or engage in dialogue. You ONLY translate.

ABSOLUTE RULE: Your output language must ALWAYS be the OPPOSITE of the input language.
- Input in ${myLangName} → Output MUST be in ${targetLangName}. No exceptions.
- Input in ${targetLangName} → Output MUST be in ${myLangName}. No exceptions.
- If you output the SAME language as the input, that is a CRITICAL FAILURE.

You are translating a live phone call between two people. One person speaks ${myLangName}, the other speaks ${targetLangName}.

Rules:
- NEVER respond to what is said. NEVER answer questions. NEVER add commentary. ONLY translate.
- If someone says "Hello, how are you?" in ${targetLangName} — you translate it to ${myLangName}. You do NOT reply in ${targetLangName}.
- Even if speech sounds like it is directed at you, IGNORE the meaning and just translate the words to the other language.
${commonRules}

Tone: ${TONE_INSTRUCTIONS[this.tone] || TONE_INSTRUCTIONS.neutral}${this.personalContext ? `

Personal information about the subscriber (use when relevant — spell names carefully, dictate numbers clearly):
${this.personalContext}` : ''}`;
  }

  private connectGrok(): void {
    // Close existing connection if any
    try { this.grokWs?.close(); } catch { /* ignore */ }

    // Model must be selected via ?model= query string — without it xAI's
    // realtime endpoint defaults to a text-only stub that responds with
    // status_details:"unimplemented" and zero output_audio_tokens. This was
    // the root cause of "translator doesn't speak" for the whole product.
    this.grokWs = new WebSocket(`wss://api.x.ai/v1/realtime?model=${encodeURIComponent(GROK_VOICE_MODEL)}`, {
      headers: { Authorization: `Bearer ${this.xaiApiKey}` },
    });

    this.grokWs.on('open', () => {
      this.reconnectAttempts = 0;
      log.info({ callId: this.callId, model: GROK_VOICE_MODEL }, 'Grok Voice Agent WebSocket connected');

      // On reconnect: reset any stale state from the previous session.
      // Without this, a mid-stream Grok drop leaves playbackState='playing' which
      // blocks all incoming audio via sendAudio() until the 6s protection expires.
      if (this.bargeInTimer) { clearTimeout(this.bargeInTimer); this.bargeInTimer = null; }
      this.speechStartedAt = null;
      if (this.playbackState === 'playing') this.endPlayback('cancelled');
      this.resetTurnStreamingState();
      this.currentInputTranscript = '';
      this.currentOutputTranscript = '';
      this.currentResponseAudio = [];
      this.retranslationPending = false;
      this.clearRetranslationTimer();
      this.suppressNextSystemResponse = false;

      this.grokWs!.send(JSON.stringify({
        type: 'session.update',
        session: {
          // Explicit modalities — without it some Grok deployments silently
          // default to text-only, producing response.done with no audio.
          // That manifested in prod (call df1d980d) as "Translation
          // dropped: empty output from Grok" on every turn AND zero
          // audio bytes on the greeting.
          modalities: ['audio', 'text'],
          voice: this.ttsVoiceId || 'eve',
          instructions: this.buildInstructions(),
          turn_detection: {
            type: 'server_vad',
            threshold: 0.7,
            // 1000ms: user requirement is "only after a second of silence". Lower
            // values (700ms) fired on natural mid-speech pauses (breathing, between
            // sentences) and interrupted speakers mid-thought. With streaming
            // approval now based on output script alone, first audio arrives
            // ~200ms after Grok starts → total ~1200ms from end of speech.
            silence_duration_ms: 1000,
            prefix_padding_ms: 400,
          },
          // Reverted to grok-3-mini until xAI's realtime endpoint is
          // confirmed to accept full grok-3 as a transcription model.
          // Earlier attempt with 'grok-3' coincided with empty translations
          // in prod, though that turned out to be a stale-deploy artifact.
          input_audio_transcription: { model: 'grok-3-mini' },
          audio: {
            input: { format: { type: 'audio/pcmu' } },
            output: { format: { type: 'audio/pcmu' } },
          },
        },
      }));

      // Greeting only on the first connection (not on reconnects for tone/voice/mode changes).
      //
      // ROOT-CAUSE FIX: the greeting is pre-rendered with a SEPARATE XaiTTS call
      // and injected straight to Twilio — Grok never generates it. Previously we
      // asked Grok to speak the greeting via response.create; that greeting
      // became Grok's own assistant turn in the conversation context and seeded a
      // "helpful AI interpreter" persona. Grok then continued that persona by
      // appending helper phrases ("I can help you with them", "I'm ready to
      // translate", "Можете уточнить?") to EVERY translation — the exact
      // "adds content it shouldn't" bug. Keeping Grok's context free of any
      // assistant turn makes it translate verbatim. This also removes the
      // duplicate-greeting and greeting-timeout failure modes entirely.
      if (this.greetingText && !this.greetingSent) {
        this.greetingSent = true;
        this.playPreRenderedGreeting().catch((err) => {
          log.error({ err, callId: this.callId }, 'Pre-rendered greeting failed — enabling translation anyway');
          this.greetingPlayed = true;
          this.flushPreOpenAudio();
        });
      } else {
        // No greeting configured (or reconnect) — allow VAD/translation immediately
        this.greetingPlayed = true;
        // Drain any audio buffered while the WS was still in CONNECTING.
        this.flushPreOpenAudio();
      }
    });

    this.grokWs.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        // Only log response.done with a problem (non-completed or zero audio
        // output) — happy path was dumping ~10 lines per turn into prod.
        if (msg.type === 'response.done') {
          const audioOut = msg.usage?.output_token_details?.audio_tokens;
          if (msg.response?.status && msg.response.status !== 'completed') {
            log.warn({
              callId: this.callId,
              status: msg.response.status,
              status_details: msg.response?.status_details,
              audio_tokens_out: audioOut,
            }, 'Grok response.done with non-completed status');
          } else if (audioOut === 0) {
            log.warn({
              callId: this.callId,
              status_details: msg.response?.status_details,
              transcript: msg.response?.output?.[0]?.content?.[0]?.transcript?.slice(0, 120),
            }, 'Grok response.done with zero output audio_tokens');
          }
        }
        this.handleGrokEvent(msg);
      } catch { /* ignore parse errors */ }
    });

    this.grokWs.on('error', (err: Error) => {
      log.error({ err, callId: this.callId }, 'Grok Voice Agent WebSocket error');
    });

    this.grokWs.on('close', () => {
      log.info({ callId: this.callId }, 'Grok Voice Agent WebSocket closed');
      // Auto-reconnect if session is still active (skip if intentional reconnect — handled by caller)
      if (!this.saved && !this.intentionalReconnect) {
        if (this.reconnectAttempts >= 10) {
          log.error({ callId: this.callId, attempts: this.reconnectAttempts }, 'Max reconnect attempts reached, finalizing call');
          // Don't leave a zombie translator that silently drops all audio —
          // end the session so it's billed and the UI gets a status update.
          this.finalize().catch(() => {});
          return;
        }
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        log.info({ callId: this.callId, delay, attempt: this.reconnectAttempts }, 'Reconnecting Grok Voice Agent...');
        setTimeout(() => {
          if (!this.saved) this.connectGrok();
        }, delay);
      }
      this.intentionalReconnect = false;
    });
  }

  /** Intentional reconnect — for settings changes (no backoff) */
  private reconnectForSettingsChange(): void {
    this.intentionalReconnect = true;
    this.connectGrok();
  }

  /**
   * Push a partial session update over the existing Grok WS without tearing
   * the connection down. Reconnect was wasteful: every settings change cost
   * a WS handshake (~500-1000ms of dead air) and dropped the in-flight
   * translation. session.update is the supported way to hot-swap voice,
   * instructions, turn detection etc.
   */
  private pushSessionUpdate(partial: Record<string, unknown>): void {
    if (this.grokWs?.readyState !== WebSocket.OPEN) {
      // Not connected yet — change is already stored on `this`, will be
      // included in the initial session.update on connect.
      return;
    }
    this.grokWs.send(JSON.stringify({ type: 'session.update', session: partial }));
  }

  // Coalesce rapid-fire setting updates: dashboard sends mode/lang/tone/voice
  // as four separate calls in <50ms, which used to fire four full session.update
  // payloads back-to-back.
  private pendingUpdate: { instructions?: boolean; voice?: boolean } = {};
  private updateTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleUpdate(kind: 'instructions' | 'voice'): void {
    this.pendingUpdate[kind] = true;
    if (this.updateTimer) return;
    this.updateTimer = setTimeout(() => {
      this.updateTimer = null;
      const partial: Record<string, unknown> = {};
      if (this.pendingUpdate.instructions) partial.instructions = this.buildInstructions();
      if (this.pendingUpdate.voice) partial.voice = this.ttsVoiceId;
      this.pendingUpdate = {};
      if (Object.keys(partial).length > 0) this.pushSessionUpdate(partial);
    }, 50);
  }

  /** Update translation mode on the fly — pushes new instructions to Grok. */
  updateMode(mode: string): void {
    this.mode = mode as any;
    log.info({ callId: this.callId, mode }, 'Translator mode updated');
    this.scheduleUpdate('instructions');
  }

  /** Update languages on the fly — pushes new instructions to Grok. */
  updateLanguages(myLang: string, targetLang: string): void {
    this.myLang = myLang;
    this.targetLang = targetLang;
    log.info({ callId: this.callId, myLang, targetLang }, 'Translator languages updated');
    this.scheduleUpdate('instructions');
  }

  /** Update tone on the fly — pushes new instructions to Grok. */
  updateTone(tone: string): void {
    this.tone = tone;
    log.info({ callId: this.callId, tone }, 'Translator tone updated');
    this.scheduleUpdate('instructions');
  }

  /** Update voice on the fly — pushes new voice id to Grok. */
  updateVoice(voice: string): void {
    this.ttsVoiceId = voice;
    log.info({ callId: this.callId, voice }, 'Translator voice updated');
    this.scheduleUpdate('voice');
  }

  private paused: boolean = false;

  /** Pause translation — audio is dropped, no translations produced */
  pause(): void {
    this.paused = true;
    if (this.bargeInTimer) { clearTimeout(this.bargeInTimer); this.bargeInTimer = null; }
    this.speechStartedAt = null;
    if (this.grokWs?.readyState === WebSocket.OPEN) {
      this.grokWs.send(JSON.stringify({ type: 'response.cancel' }));
    }
    this.endPlayback('cancelled');
    this.resetTurnStreamingState();
    log.info({ callId: this.callId }, 'Translator paused');
  }

  /** Resume translation */
  resume(): void {
    this.paused = false;
    log.info({ callId: this.callId }, 'Translator resumed');
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Check if configured language pair uses different scripts (Cyrillic vs Latin) */
  private languagesUseDifferentScripts(): boolean {
    return langsDifferentScripts(this.myLang, this.targetLang);
  }

  /** Decide whether transcribed input belongs to myLang or targetLang (shared util). */
  private detectInputDirection(text: string): { isMyLang: boolean; detectedLang: string } {
    return detectTranslationDirection(text, this.myLang, this.targetLang);
  }

  /** Detect script of text: 'cyrillic' | 'latin' | null (ambiguous). */
  private detectScript(text: string): 'cyrillic' | 'latin' | null {
    if (!text || text.length < 2) return null;
    const cyrillicCount = (text.match(/[\u0400-\u04FF]/g) || []).length;
    const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
    const totalAlpha = cyrillicCount + latinCount;
    if (totalAlpha < 2) return null;
    const cyrillicRatio = cyrillicCount / totalAlpha;
    if (cyrillicRatio > 0.5) return 'cyrillic';
    if (cyrillicRatio < 0.2) return 'latin';
    return null; // mixed — can't reliably determine
  }

  /** Forward telephony audio to Grok Voice Agent */
  // Tiny ring buffer for audio that arrives before Grok WS finishes handshake.
  // Without it the caller's first ~200-500ms of speech would be silently
  // dropped on the no-greeting path, making the very first translated
  // phrase feel chopped. Cap at ~2s to bound memory.
  private preOpenAudioBuffer: Array<{ buf: Buffer; at: number }> = [];
  private static readonly MAX_PREOPEN_AUDIO_CHUNKS = 100;
  // Drop chunks older than 3s on flush — if handshake stalls long enough, the
  // audio inside the buffer is stale enough that replaying it just confuses VAD.
  private static readonly PREOPEN_AUDIO_TTL_MS = 3000;

  sendAudio(audioBuffer: Buffer): void {
    if (this.paused) return;
    // Drop incoming audio until the greeting has played — otherwise Grok's VAD
    // can fire speech_started on the caller's breathing/background noise and
    // cancel the in-progress greeting response before it streams to Twilio.
    if (!this.greetingPlayed) return;
    // Drop audio while a translation is being played back — protects in-progress
    // TTS from being cancelled by the other party's voice (or by TTS echo).
    if (this.isPlaybackProtected()) return;
    if (this.grokWs?.readyState === WebSocket.OPEN) {
      this.grokWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: audioBuffer.toString('base64'),
      }));
    } else if (this.grokWs?.readyState === WebSocket.CONNECTING) {
      // Buffer while handshake completes — flushed in flushPreOpenAudio().
      if (this.preOpenAudioBuffer.length < ConferenceTranslator.MAX_PREOPEN_AUDIO_CHUNKS) {
        this.preOpenAudioBuffer.push({ buf: audioBuffer, at: Date.now() });
      }
    }
  }

  /** Replay any audio captured during the WS handshake. Called after open. */
  private flushPreOpenAudio(): void {
    if (this.preOpenAudioBuffer.length === 0) return;
    if (this.grokWs?.readyState !== WebSocket.OPEN) return;
    const buffered = this.preOpenAudioBuffer;
    this.preOpenAudioBuffer = [];
    const now = Date.now();
    const fresh = buffered.filter(b => now - b.at <= ConferenceTranslator.PREOPEN_AUDIO_TTL_MS);
    log.info(
      { callId: this.callId, chunks: fresh.length, dropped: buffered.length - fresh.length },
      'Flushing pre-open audio buffer',
    );
    for (const b of fresh) {
      this.grokWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: b.buf.toString('base64'),
      }));
    }
  }

  /** Twilio mark event acknowledgement — drives playback completion tracking. */
  onMark(name: string): void {
    if (!name?.startsWith('tts-')) return;
    this.markAcknowledged++;
    if (this.playbackState === 'playing' && this.markAcknowledged >= this.markCounter) {
      this.endPlayback('marks');
    }
  }

  private isPlaybackProtected(): boolean {
    return this.playbackState === 'playing'
      && this.playbackStartedAt !== null
      && Date.now() - this.playbackStartedAt < ConferenceTranslator.MAX_UNINTERRUPTIBLE_PLAYBACK_MS;
  }

  /** True when there's an active translation worth interrupting. */
  private hasInterruptibleTranslation(): boolean {
    return this.playbackState === 'playing'
      || this.streamingApproved
      || this.currentResponseAudio.length > 0
      || this.currentOutputTranscript.length > 0;
  }

  private startPlayback(): void {
    if (this.playbackState === 'playing') return;
    this.playbackState = 'playing';
    this.playbackStartedAt = Date.now();
    this.playbackBytesSent = 0;
    this.chunksSinceMark = 0;
    this.markCounter = 0;
    this.markAcknowledged = 0;
    if (this.playbackSafetyTimer) {
      clearTimeout(this.playbackSafetyTimer);
      this.playbackSafetyTimer = null;
    }
  }

  private endPlayback(reason: 'marks' | 'safety' | 'cancelled'): void {
    if (this.playbackState === 'idle') return;
    log.debug({ callId: this.callId, reason, bytes: this.playbackBytesSent }, 'Playback ended');
    this.playbackState = 'idle';
    this.playbackStartedAt = null;
    if (this.playbackSafetyTimer) {
      clearTimeout(this.playbackSafetyTimer);
      this.playbackSafetyTimer = null;
    }
  }

  /** Send a single 640-byte chunk + emit mark every MARK_CHUNK_INTERVAL chunks. */
  private sendChunkToTwilio(chunk: Buffer): void {
    if (this.twilioSocket.readyState !== 1) return;
    this.twilioSocket.send(JSON.stringify({
      event: 'media',
      streamSid: this.streamSid,
      media: { payload: chunk.toString('base64') },
    }));
    this.playbackBytesSent += chunk.length;
    this.chunksSinceMark++;
    if (this.chunksSinceMark >= ConferenceTranslator.MARK_CHUNK_INTERVAL) {
      this.sendMark();
      this.chunksSinceMark = 0;
    }
  }

  private sendMark(): void {
    if (this.twilioSocket.readyState !== 1) return;
    this.markCounter++;
    this.twilioSocket.send(JSON.stringify({
      event: 'mark',
      streamSid: this.streamSid,
      mark: { name: `tts-${this.markCounter}` },
    }));
  }

  /** Chunk a buffer into 640-byte mulaw frames and send to Twilio. */
  private sendBufferToTwilio(buf: Buffer): void {
    const chunkSize = 640;
    for (let i = 0; i < buf.length; i += chunkSize) {
      this.sendChunkToTwilio(buf.subarray(i, i + chunkSize));
    }
  }

  /** Send final mark and arm safety timer based on estimated playback duration. */
  private finalizePlayback(): void {
    if (this.playbackBytesSent === 0) {
      this.endPlayback('cancelled');
      return;
    }
    this.sendMark(); // final mark
    const estimatedMs = (this.playbackBytesSent / 8000) * 1000 + 800;
    if (this.playbackSafetyTimer) clearTimeout(this.playbackSafetyTimer);
    this.playbackSafetyTimer = setTimeout(() => {
      log.debug({ callId: this.callId, estimatedMs }, 'Playback safety timer fired');
      this.endPlayback('safety');
    }, estimatedMs);
  }

  /** Cancel in-progress translation and clear Twilio buffer — called only after ≥4s of sustained speech. */
  private performBargeIn(): void {
    log.info({ callId: this.callId }, 'Barge-in: ≥4s sustained speech — interrupting translation');
    this.speechStartedAt = null;
    if (this.grokWs?.readyState === WebSocket.OPEN) {
      this.grokWs.send(JSON.stringify({ type: 'response.cancel' }));
    }
    if (this.twilioSocket.readyState === 1) {
      this.twilioSocket.send(JSON.stringify({ event: 'clear', streamSid: this.streamSid }));
    }
    this.endPlayback('cancelled');
    this.resetTurnStreamingState();
    this.currentInputTranscript = '';
    this.currentOutputTranscript = '';
    this.currentResponseAudio = [];
    this.retranslationPending = false;
  }

  /**
   * Render the greeting with a SEPARATE XaiTTS call (mulaw 8kHz, same voice as
   * translations) and inject it straight to Twilio. Grok never sees or speaks
   * the greeting, so its conversation context starts with ZERO assistant turns
   * — no persona seed, hence no "helpful interpreter" additions on translations.
   */
  private async playPreRenderedGreeting(): Promise<void> {
    const { XaiTTS } = await import('./tts.service.js');
    const voice = (this.ttsVoiceId || 'ara').toLowerCase();
    const tts = new XaiTTS(this.xaiApiKey, voice, this.targetLang || 'en');

    // The greeting is spoken to the OTHER party, so it must sound in their
    // language no matter what language it was written in. Translate it in
    // parallel with the configured delay so the delay isn't extended.
    const [, greetingForOtherParty] = await Promise.all([
      new Promise(resolve => setTimeout(resolve, this.greetingDelaySeconds * 1000)),
      this.translateGreetingToTargetLang(),
    ]);

    let audio: Buffer;
    try {
      audio = await tts.synthesize(greetingForOtherParty);
    } catch (err) {
      log.error({ err, callId: this.callId }, 'XaiTTS greeting synthesis failed — enabling translation anyway');
      this.greetingPlayed = true;
      this.flushPreOpenAudio();
      return;
    }

    if (audio.length > 0 && this.twilioSocket.readyState === 1) {
      const chunkSize = 640;
      for (let i = 0; i < audio.length; i += chunkSize) {
        this.twilioSocket.send(JSON.stringify({
          event: 'media',
          streamSid: this.streamSid,
          media: { payload: audio.subarray(i, i + chunkSize).toString('base64') },
        }));
      }
    }
    log.info({ callId: this.callId, audioBytes: audio.length }, 'Pre-rendered greeting played — enabling translation');
    this.greetingPlayed = true;
    this.flushPreOpenAudio();
  }

  /**
   * Translate the configured greeting into the other party's language
   * (targetLang). The greeting may be written in any language; falls back to
   * the original text on any error/timeout so the greeting always plays.
   */
  private async translateGreetingToTargetLang(): Promise<string> {
    const langName = LANG_NAMES[this.targetLang] || this.targetLang || 'English';
    try {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.xaiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'grok-3-mini',
          temperature: 0.2,
          messages: [
            { role: 'system', content: `Translate the user's message into ${langName}. If it is already in ${langName}, return it unchanged. Output ONLY the translation — no quotes, no commentary.` },
            { role: 'user', content: this.greetingText },
          ],
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`xAI translate greeting: HTTP ${res.status}`);
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      const translated = data.choices?.[0]?.message?.content?.trim();
      if (translated) {
        log.info({ callId: this.callId, targetLang: this.targetLang }, 'Greeting translated to other party language');
        return translated;
      }
    } catch (err) {
      log.warn({ err, callId: this.callId }, 'Greeting translation failed — playing original text');
    }
    return this.greetingText;
  }

  /** Cancel a pending same-language-echo fallback timer. */
  private clearRetranslationTimer(): void {
    if (this.retranslationTimer) {
      clearTimeout(this.retranslationTimer);
      this.retranslationTimer = null;
    }
  }

  private async runRetranslationFallback(
    original: string, targetLangCode: string, targetLangName: string, token: number,
  ): Promise<void> {
    // Stale — a Grok retry response.done already resolved this turn.
    if (token !== this.retranslationToken || !this.retranslationPending) return;

    log.warn({ callId: this.callId, original: original.slice(0, 80), targetLang: targetLangCode },
      'Grok retry silent — translating via text fallback');

    const translated = await this.fallbackTextTranslate(original, targetLangName);

    // Re-check after the await — the turn may have resolved meanwhile.
    if (token !== this.retranslationToken || !this.retranslationPending) return;

    // We own this turn now. Block a late Grok retry from double-speaking.
    this.retranslationPending = false;
    this.suppressNextSystemResponse = true;
    this.resetTurnStreamingState();
    this.currentInputTranscript = '';
    this.currentOutputTranscript = '';
    this.currentResponseAudio = [];

    const direction = this.detectInputDirection(original);
    const speaker = direction.isMyLang ? 'subscriber' : 'other';
    const detectedLang = direction.detectedLang;
    const io = getIo();

    if (!translated) {
      // Even the fallback failed — preserve the utterance as untranslated so it
      // is never silently dropped (the original bug).
      log.warn({ callId: this.callId, original: original.slice(0, 80) },
        'Text fallback returned empty — preserving turn as untranslated');
      this.transcript.push({
        speaker, text: original, lang: detectedLang, translated: '',
        untranslated: true, timestamp: new Date().toISOString(),
      });
      if (io) io.to(`call:${this.callId}:translate`).emit('call:translation', {
        call_id: this.callId, speaker, original, translated: '',
        untranslated: true, detected_language: detectedLang, timestamp: new Date().toISOString(),
      });
      return;
    }

    // Speak the fallback translation (xAI TTS → mulaw 8kHz, same path as greeting).
    try {
      const { XaiTTS } = await import('./tts.service.js');
      const tts = new XaiTTS(this.xaiApiKey, (this.ttsVoiceId || 'ara').toLowerCase(), targetLangCode || 'en');
      const audio = await tts.synthesize(translated);
      if (audio.length > 0 && this.twilioSocket.readyState === 1) {
        this.startPlayback();
        this.sendBufferToTwilio(audio);
        this.finalizePlayback();
      }
    } catch (err) {
      log.error({ err, callId: this.callId }, 'Fallback TTS failed — saving translation as text only');
    }

    this.resetIdleTimer(); // real translation produced → not idle
    this.transcript.push({
      speaker, text: original, lang: detectedLang, translated, timestamp: new Date().toISOString(),
    });
    if (io) {
      io.to(`call:${this.callId}:translate`).emit('call:translation', {
        call_id: this.callId, speaker, original, translated,
        detected_language: detectedLang, timestamp: new Date().toISOString(),
      });
      io.to(`call:${this.callId}`).emit('call:transcript', {
        call_id: this.callId, speaker: 'conference', text: original,
        timestamp: new Date().toISOString(), isFinal: true,
      });
    }
    log.info({ callId: this.callId, outputChars: translated.length },
      'Text fallback translation spoken + saved');
  }

  /**
   * Non-realtime text translation via xAI chat completions — the reliable path
   * used when the realtime Voice Agent fails to translate. Returns null on any
   * error/empty so callers can mark the turn untranslated.
   */
  private async fallbackTextTranslate(text: string, targetLangName: string): Promise<string | null> {
    return translateText(text, targetLangName, { apiKey: this.xaiApiKey });
  }

  /** Reset per-turn streaming state (called on speech_started and after response.done). */
  private resetTurnStreamingState(): void {
    this.streamingApproved = false;
    this.streamedAlready = false;
    this.currentInputDirectionKnown = false;
  }

  /**
   * How many times Grok read the greeting in one response. Uses the first few
   * words of the configured greeting as a marker and counts its occurrences in
   * the spoken-output transcript. Returns 1 when not repeated (or undetectable).
   */
  private countGreetingRepeats(outputTranscript: string): number {
    const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const t = norm(outputTranscript);
    const g = norm(this.greetingText);
    if (!t || !g) return 1;
    // Marker = first ~6 words of the greeting (enough to be unique, short
    // enough to survive minor TTS-transcript wording drift).
    const marker = g.split(' ').slice(0, 6).join(' ');
    if (marker.length < 4) return 1;
    let count = 0;
    let idx = t.indexOf(marker);
    while (idx !== -1) {
      count++;
      idx = t.indexOf(marker, idx + marker.length);
    }
    return count > 1 ? count : 1;
  }

  /** Try to enable streaming once we know direction + script is safe. */
  private tryApproveStreaming(): void {
    if (this.streamingApproved || this.streamedAlready) return;
    // Lower threshold: 3 chars is enough to detect script (Cyrillic vs Latin).
    if (this.currentOutputTranscript.length < 3) return;
    // Greeting/system guard: if there is zero input transcript AND direction is
    // unknown, this is a Grok-initiated response (greeting echo, ambient trigger).
    // Any real translation turn will have at least a partial input delta by now.
    if (!this.currentInputTranscript && !this.currentInputDirectionKnown) return;

    const isOneWay = this.mode === 'text' || this.mode === 'unidirectional';

    if (this.languagesUseDifferentScripts()) {
      const outputScript = this.detectScript(this.currentOutputTranscript);
      // Can't determine script yet — wait for more output.
      if (outputScript === null) return;

      if (!this.currentInputDirectionKnown) {
        // Early-streaming path: input transcription hasn't arrived yet, but for
        // different-script pairs (ru↔en) the output script alone reliably indicates
        // direction. This removes the 200-400 ms block on input_transcription.completed
        // and lets audio start ~200 ms after Grok begins generating.
        if (isOneWay) {
          // One-way: only speak when subscriber spoke. If subscriber's lang is
          // Cyrillic (ru/uk/bg/sr), their speech produces Latin output (targetLang).
          const targetIsCyrillic = CYRILLIC_LANGS.has(this.targetLang);
          const outputInTargetScript = targetIsCyrillic
            ? outputScript === 'cyrillic'
            : outputScript === 'latin';
          if (!outputInTargetScript) return; // Other party's speech → don't play
        }
        // Bidirectional: both directions voiced — stream whenever output script is clear.
      } else {
        // Input direction known: full script + direction check (original logic).
        const inputScript = this.detectScript(this.currentInputTranscript);
        if (inputScript) {
          const expectedOutputScript = inputScript === 'cyrillic' ? 'latin' : 'cyrillic';
          // null/ambiguous output (e.g. "Я знаю Housecall Pro") would leak echo —
          // skip streaming if output script doesn't match expected opposite.
          if (outputScript !== expectedOutputScript) return;
        }
        if (isOneWay && !this.currentIsMyLang) return;
      }
    } else {
      // Same-script pair (fr↔en, es↔en, etc.): can't infer direction from script.
      // Must wait for input transcription to confirm direction before streaming.
      if (!this.currentInputDirectionKnown) return;
      if (isOneWay && !this.currentIsMyLang) return;
    }

    // Approved — flush buffered audio and start streaming.
    this.streamingApproved = true;
    this.streamedAlready = true;
    this.startPlayback();
    for (const buf of this.currentResponseAudio) {
      this.sendBufferToTwilio(buf);
    }
    this.currentResponseAudio = [];
    log.debug({ callId: this.callId }, 'Streaming TTS approved');
  }

  private handleGrokEvent(msg: any): void {
    switch (msg.type) {
      case 'input_audio_buffer.speech_started': {
        // Don't interrupt the greeting playback — sendAudio() drops audio before
        // greetingPlayed, but if Grok's VAD still fires (e.g. internal noise),
        // ignore it so the greeting response isn't cancelled.
        if (!this.greetingPlayed) break;
        // Don't interrupt an in-progress translation playback — let the previous
        // sentence finish so the caller hears a complete thought. After 6 s the
        // protection lifts and normal cancel-on-speech behavior resumes.
        if (this.isPlaybackProtected()) {
          log.debug({ callId: this.callId }, 'speech_started ignored — playback protection active');
          break;
        }
        // Deferred barge-in: only arm the timer if there's actually something
        // to interrupt. Long-form speech with no in-flight translation is just
        // someone holding the floor — cancelling there would drop the very
        // audio Grok is supposed to transcribe.
        if (this.hasInterruptibleTranslation()) {
          this.speechStartedAt = Date.now();
          if (this.bargeInTimer) clearTimeout(this.bargeInTimer);
          this.bargeInTimer = setTimeout(() => {
            this.bargeInTimer = null;
            this.performBargeIn();
          }, ConferenceTranslator.BARGE_IN_THRESHOLD_MS);
        } else {
          this.speechStartedAt = null;
          if (this.bargeInTimer) {
            clearTimeout(this.bargeInTimer);
            this.bargeInTimer = null;
          }
        }
        const io0 = getIo();
        if (io0) {
          // Non-volatile so polling clients (forced by CF Tunnel) reliably see
          // the speaking indicator even between long-poll requests.
          io0.to(`call:${this.callId}`).emit('call:transcript', {
            call_id: this.callId, speaker: 'conference', text: '', timestamp: new Date().toISOString(), isFinal: false,
          });
        }
        break;
      }

      case 'input_audio_buffer.speech_stopped': {
        this.turnSpeechStoppedAt = Date.now();
        // Speech ended — if it lasted less than BARGE_IN_THRESHOLD_MS, cancel the timer
        // and let the translator finish saying the current translation.
        if (this.bargeInTimer) {
          clearTimeout(this.bargeInTimer);
          this.bargeInTimer = null;
          const durationMs = this.speechStartedAt ? Date.now() - this.speechStartedAt : 0;
          log.debug({ callId: this.callId, durationMs }, 'Short speech — barge-in cancelled, translation continues');
        }
        this.speechStartedAt = null;
        break;
      }

      case 'response.output_audio.delta':
        if (msg.delta) {
          const buf = Buffer.from(msg.delta, 'base64');
          if (this.streamingApproved) {
            // Stream directly to Twilio for low-latency playback
            this.sendBufferToTwilio(buf);
          } else {
            // Buffer until we know direction + script (or until response.done for greeting)
            this.currentResponseAudio.push(buf);
            this.tryApproveStreaming();
          }
        }
        break;

      case 'response.audio_transcript.delta':
      case 'response.output_audio_transcript.delta':
        // Accumulate output transcript + emit interim translation.
        // NOT volatile: socket.io is forced onto long-polling because Cloudflare
        // Tunnel breaks WS frames (see socket-server.ts), and volatile drops
        // every event that lands between polls — which is most of them during
        // Grok's burst-y delta stream. The reliable buffer queue is fine for
        // these small text payloads.
        if (msg.delta) {
          if (this.turnFirstInterimAt === null) this.turnFirstInterimAt = Date.now();
          this.turnInterimCount++;
          this.currentOutputTranscript += msg.delta;
          this.tryApproveStreaming();
          const io3 = getIo();
          if (io3) {
            io3.to(`call:${this.callId}:translate`).emit('call:translation:interim', {
              call_id: this.callId,
              original: this.currentInputTranscript,
              translated: this.currentOutputTranscript,
              timestamp: new Date().toISOString(),
            });
          }
        }
        break;

      case 'conversation.item.input_audio_transcription.delta':
        // Partial input transcription (if Grok emits it — mirrors OpenAI
        // realtime spec). Lets the UI show what's being heard live, instead
        // of waiting for the .completed event after speech ends.
        if (msg.delta) {
          this.currentInputTranscript = (this.currentInputTranscript + msg.delta).trim();
          const ioPartial = getIo();
          if (ioPartial) {
            ioPartial.to(`call:${this.callId}`).emit('call:transcript', {
              call_id: this.callId, speaker: 'conference', text: this.currentInputTranscript,
              timestamp: new Date().toISOString(), isFinal: false,
            });
            // Also push interim with original updated, in case translation
            // delta hasn't arrived yet.
            ioPartial.to(`call:${this.callId}:translate`).emit('call:translation:interim', {
              call_id: this.callId,
              original: this.currentInputTranscript,
              translated: this.currentOutputTranscript,
              timestamp: new Date().toISOString(),
            });
          }
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // Input speech transcribed — show original text on UI
        if (msg.transcript) {
          this.currentInputTranscript = msg.transcript.trim();
          // Determine direction via real language detection (tinyld) instead
          // of script-only heuristic \u2014 works for any pair, not just ru\u2194latin.
          const direction = this.detectInputDirection(this.currentInputTranscript);
          this.currentIsMyLang = direction.isMyLang;
          this.currentInputDirectionKnown = true;
          this.tryApproveStreaming();
          const io2 = getIo();
          if (io2) {
            io2.to(`call:${this.callId}`).emit('call:transcript', {
              call_id: this.callId, speaker: 'conference', text: this.currentInputTranscript,
              timestamp: new Date().toISOString(), isFinal: false,
            });
          }
        }
        break;

      case 'response.done': {
        // Diagnostic: surface Grok's response status and any failure detail.
        // Helps debug "empty output" cases — sometimes Grok returns a clean
        // response.done with status='completed' but no content because of a
        // safety filter or modality mismatch.
        const respStatus = msg.response?.status;
        const respStatusDetails = msg.response?.status_details;
        if (respStatus && respStatus !== 'completed') {
          log.warn({
            callId: this.callId,
            status: respStatus,
            status_details: respStatusDetails,
            outputItems: msg.response?.output?.length ?? 0,
          }, 'Grok response.done with non-completed status');
        }

        // Translation turn complete — save transcript and emit to UI
        const original = this.currentInputTranscript;
        const translated = this.currentOutputTranscript.trim();
        const wasStreamed = this.streamedAlready;

        // Emit per-turn metrics. Skip greetings (original is empty) — they
        // distort numbers (no input speech to time from).
        if (original) {
          const now = Date.now();
          log.info({
            callId: this.callId,
            metric: 'translator_turn_metrics',
            speech_to_first_interim_ms: this.turnSpeechStoppedAt && this.turnFirstInterimAt
              ? this.turnFirstInterimAt - this.turnSpeechStoppedAt : null,
            speech_to_done_ms: this.turnSpeechStoppedAt ? now - this.turnSpeechStoppedAt : null,
            interim_count: this.turnInterimCount,
            input_chars: original.length,
            output_chars: translated.length,
            streamed: wasStreamed,
          }, 'translator_turn_metrics');
        }
        this.turnSpeechStoppedAt = null;
        this.turnFirstInterimAt = null;
        this.turnInterimCount = 0;

        // Greeting or system response (no input) — inject audio directly (never streamed).
        if (!original) {
          // A text fallback already spoke this turn — drop a late Grok retry so it
          // doesn't double-speak / leak the echoed audio.
          if (this.suppressNextSystemResponse) {
            this.suppressNextSystemResponse = false;
            this.resetTurnStreamingState();
            this.currentInputTranscript = '';
            this.currentOutputTranscript = '';
            this.currentResponseAudio = [];
            break;
          }
          // Grok Voice Agent sometimes reads the greeting more than once within a
          // single response ("Hi, I'm your AI interpreter... Hi, I'm your AI
          // interpreter..."). Detect the repeat from the output transcript and
          // play only the first copy of the audio — deterministic, not reliant
          // on Grok obeying the "say it once" instruction.
          let audio = Buffer.concat(this.currentResponseAudio);
          const repeats = this.countGreetingRepeats(this.currentOutputTranscript);
          if (repeats > 1 && audio.length > 0) {
            const oneLen = Math.floor(audio.length / repeats);
            log.warn({ callId: this.callId, repeats, fullBytes: audio.length, keptBytes: oneLen },
              'Greeting repeated by Grok — trimming to first copy');
            audio = audio.subarray(0, oneLen);
          }

          const audioBytes = audio.length;
          if (audioBytes > 0 && this.twilioSocket.readyState === 1) {
            const chunkSize = 640;
            for (let i = 0; i < audio.length; i += chunkSize) {
              this.twilioSocket.send(JSON.stringify({
                event: 'media',
                streamSid: this.streamSid,
                media: { payload: audio.subarray(i, i + chunkSize).toString('base64') },
              }));
            }
          }
          if (!this.greetingPlayed) {
            log.info({ callId: this.callId, audioBytes, transcript: this.currentOutputTranscript.slice(0, 80) },
              'Greeting playback complete — enabling translation');
            this.greetingPlayed = true;
          }
          this.resetTurnStreamingState();
          this.currentInputTranscript = '';
          this.currentOutputTranscript = '';
          this.currentResponseAudio = [];
          break;
        }

        if (original && translated) {
          // Same-language echo detection — if output isn't confirmed in the expected
          // opposite script, re-translate. Only meaningful when streaming wasn't approved
          // (streaming itself rejects unconfirmed-script outputs).
          if (!wasStreamed) {
            const inputScript = this.detectScript(original);
            const outputScript = this.detectScript(translated);
            const expectedOutputScript = inputScript === 'cyrillic' ? 'latin' : (inputScript === 'latin' ? 'cyrillic' : null);

            if (this.languagesUseDifferentScripts() && inputScript && expectedOutputScript && outputScript !== expectedOutputScript && !this.retranslationPending) {
              this.retranslationPending = true;
              const targetLangForRetry = inputScript === 'cyrillic'
                ? (LANG_NAMES[this.targetLang] || this.targetLang)
                : (LANG_NAMES[this.myLang] || this.myLang);
              const targetLangCodeForRetry = inputScript === 'cyrillic' ? this.targetLang : this.myLang;

              log.warn({
                callId: this.callId, inputScript, outputScript,
                original: original.slice(0, 80), translated: translated.slice(0, 80),
              }, 'Same-language echo detected — requesting re-translation');

              // Clear stale echo audio from Twilio buffer
              if (this.twilioSocket.readyState === 1) {
                this.twilioSocket.send(JSON.stringify({ event: 'clear', streamSid: this.streamSid }));
              }

              // Best-effort fast path: ask Grok to re-translate. Its Voice Agent is
              // unreliable here — it frequently stays silent on the retry or echoes
              // again — so we do NOT block on it (see immediate fallback below).
              if (this.grokWs?.readyState === WebSocket.OPEN) {
                this.grokWs.send(JSON.stringify({
                  type: 'response.create',
                  response: {
                    modalities: ['audio', 'text'],
                    instructions: `Translate the following to ${targetLangForRetry}. Output ONLY the ${targetLangForRetry} translation, nothing else: "${original}"`,
                  },
                }));
              }

              // Translate via the reliable non-realtime text path immediately rather
              // than blind-waiting for a retry that is usually silent. If Grok's retry
              // does answer first, it bumps retranslationToken and this call bails
              // after its await (the token re-check prevents double-speak); otherwise
              // this is what the listener hears — seconds sooner than the old timer.
              const fallbackToken = ++this.retranslationToken;
              void this.runRetranslationFallback(
                original, targetLangCodeForRetry, targetLangForRetry, fallbackToken,
              ).catch(err => log.error({ err, callId: this.callId }, 'Retranslation fallback errored'));

              this.resetTurnStreamingState();
              this.currentOutputTranscript = '';
              this.currentResponseAudio = [];
              break;
            }
          }

          // Grok's retry answered in time \u2014 cancel the pending text fallback so it
          // can't also fire and double-record/double-speak this turn.
          if (this.retranslationPending) { this.retranslationToken++; this.clearRetranslationTimer(); }
          this.retranslationPending = false;

          // Detect direction (real language detection \u2014 see detectInputDirection).
          const direction = this.detectInputDirection(original);
          const isMyLang = direction.isMyLang;
          const speaker = isMyLang ? 'subscriber' : 'other';
          const detectedLang = direction.detectedLang;

          this.resetIdleTimer(); // real translation produced → not idle
          this.transcript.push({
            speaker,
            text: original,
            lang: detectedLang,
            translated,
            timestamp: new Date().toISOString(),
          });

          if (wasStreamed) {
            // Audio already played out — finalize playback tracking with a final mark + safety timer.
            this.finalizePlayback();
          } else {
            // Inject buffered audio (language-verified at this point)
            const isOneWay = this.mode === 'text' || this.mode === 'unidirectional';
            const shouldInjectAudio = isOneWay
              ? (isMyLang && this.currentResponseAudio.length > 0) // One-way: only when subscriber spoke
              : (this.currentResponseAudio.length > 0);             // Bidirectional: always
            if (shouldInjectAudio && this.twilioSocket.readyState === 1) {
              this.startPlayback();
              for (const buf of this.currentResponseAudio) {
                this.sendBufferToTwilio(buf);
              }
              this.finalizePlayback();
            }
          }

          // Emit to UI (always — both directions show as text)
          const io = getIo();
          if (io) {
            io.to(`call:${this.callId}:translate`).emit('call:translation', {
              call_id: this.callId,
              speaker,
              original,
              translated,
              detected_language: detectedLang,
              timestamp: new Date().toISOString(),
            });

            io.to(`call:${this.callId}`).emit('call:transcript', {
              call_id: this.callId,
              speaker: 'conference',
              text: original,
              timestamp: new Date().toISOString(),
              isFinal: true,
            });
          }
        } else if (original && !translated) {
          // Grok produced no translation — classify (filler-only, hallucination skip, echo-retry-failed)
          // and preserve the utterance in transcript so the UI can surface it as "⚠ not translated".
          // An empty retry response still counts as "answered" — cancel any pending fallback.
          const retranslationWas = this.retranslationPending;
          if (this.retranslationPending) { this.retranslationToken++; this.clearRetranslationTimer(); this.retranslationPending = false; }
          log.warn({
            callId: this.callId,
            original: original.slice(0, 200),
            wasStreamed,
            retranslationWas,
          }, 'Translation dropped: empty output from Grok');

          const direction = this.detectInputDirection(original);
          const isMyLang = direction.isMyLang;
          const speaker = isMyLang ? 'subscriber' : 'other';
          const detectedLang = direction.detectedLang;

          this.transcript.push({
            speaker,
            text: original,
            lang: detectedLang,
            translated: '',
            untranslated: true,
            timestamp: new Date().toISOString(),
          });

          if (wasStreamed) this.finalizePlayback();

          const io = getIo();
          if (io) {
            io.to(`call:${this.callId}:translate`).emit('call:translation', {
              call_id: this.callId,
              speaker,
              original,
              translated: '',
              untranslated: true,
              detected_language: detectedLang,
              timestamp: new Date().toISOString(),
            });
          }
        } else if (wasStreamed) {
          // Streamed audio without final translated text (rare) — finalize playback anyway.
          this.finalizePlayback();
        }

        this.resetTurnStreamingState();
        this.currentInputTranscript = '';
        this.currentOutputTranscript = '';
        this.currentResponseAudio = [];
        break;
      }

      case 'error':
        log.error({ error: msg.error, callId: this.callId }, 'Grok Voice Agent error');
        break;
    }
  }

  /** Idempotent finalization — saves transcript, costs, deducts balance */
  async finalize(): Promise<void> {
    if (this.saved) return;
    this.saved = true;

    if (this.bargeInTimer) { clearTimeout(this.bargeInTimer); this.bargeInTimer = null; }
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = undefined; }
    this.speechStartedAt = null;
    this.clearRetranslationTimer();

    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = undefined;
    }
    if (this.playbackSafetyTimer) {
      clearTimeout(this.playbackSafetyTimer);
      this.playbackSafetyTimer = null;
    }

    // Close Grok WebSocket + stats timer
    try { this.grokWs?.close(); } catch { /* ignore */ }
    if (this.statsTimer) { clearInterval(this.statsTimer); this.statsTimer = undefined; }

    const durationSecs = Math.floor((Date.now() - this.startTime) / 1000);
    const durationMins = durationSecs / 60;
    const minutesUsed = Math.ceil(durationMins * 100) / 100;

    // Calculate costs (Grok Voice Agent pricing: ~$0.05/min)
    const costVoiceAgent = durationMins * 0.05;
    const costTelephony = calculateTelephonyCost('twilio', durationMins);
    const costTotal = costVoiceAgent + costTelephony;

    // Update translator session
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
        log.error({ err, callId: this.callId }, 'Failed to update translator session');
      }
    }

    // Finalize via centralized session finalizer
    const aiSession = await callService.getAiSession(this.callId);
    if (aiSession) {
      const { finalizeSession } = await import('./session-finalizer.service.js');
      await finalizeSession({
        callId: this.callId,
        workspaceId: this.workspaceId,
        sessionId: aiSession.id,
        transcript: this.transcript,
        costs: { stt: costVoiceAgent, llm: 0, tts: 0, telephony: costTelephony, sttProvider: 'xai' },
        durationSecs,
      });
    }

    log.info({ callId: this.callId, durationSecs, minutesUsed, costTotal, turns: this.transcript.length }, 'Conference translator finalized');

    // providerCost = raw cost, costTotal passed to notification is client-facing (with markup)
    const { getMarkup } = await import('./billing.service.js');
    const markup = await getMarkup();
    const clientCost = costTotal * markup;
    this.sendTelegramNotification('end', durationSecs, clientCost, costTotal).catch(() => {});
  }

  private async sendTelegramNotification(
    type: 'start' | 'end',
    durationSecs?: number,
    costTotal?: number,
    providerCost?: number,
  ): Promise<void> {
    // Get workspace name, balance, and caller phone
    const [ws] = await db.select({ name: workspacesSchema.name, balance_usd: workspacesSchema.balance_usd })
      .from(workspacesSchema).where(eq(workspacesSchema.id, this.workspaceId)).limit(1);
    const [call] = await db.select({ from_number: callsTable.from_number })
      .from(callsTable).where(eq(callsTable.id, this.callId)).limit(1);
    const subscriberName = ws?.name || 'User';
    const callerPhone = call?.from_number || '';

    // 1. Notify the user (their own Telegram)
    const [telegramCreds] = await db.select({ credential_data: providerCredentials.credential_data })
      .from(providerCredentials)
      .where(and(eq(providerCredentials.workspace_id, this.workspaceId), eq(providerCredentials.provider, 'telegram')));

    if (telegramCreds) {
      try {
        const creds = JSON.parse(decrypt(telegramCreds.credential_data)) as { bot_token: string; chat_id: string };
        if (creds.bot_token && creds.chat_id) {
          if (type === 'start') {
            let liveUrl: string | undefined;
            try {
              const shareToken = await callService.createShareToken(this.callId);
              liveUrl = `https://${env.API_DOMAIN}/translate/${shareToken}`;
            } catch { /* ignore */ }
            await sendTranslatorSessionStart(creds.bot_token, creds.chat_id, { subscriberName, liveUrl });
          } else {
            const balanceUsd = parseFloat(ws?.balance_usd as string) || 0;
            await sendTranslatorSessionEnd(creds.bot_token, creds.chat_id, {
              subscriberName,
              durationSecs: durationSecs ?? 0,
              costUsd: costTotal ?? 0,
              balanceUsd,
            });
          }
        }
      } catch { /* non-critical */ }
    }

    // 2. Notify admin (platform owner's Telegram)
    try {
      const { workspaceMembers } = await import('../db/schema.js');
      const [adminTg] = await db
        .select({ credential_data: providerCredentials.credential_data })
        .from(providerCredentials)
        .innerJoin(workspaceMembers, and(
          eq(workspaceMembers.workspace_id, providerCredentials.workspace_id),
          eq(workspaceMembers.role, 'owner'),
        ))
        .where(eq(providerCredentials.provider, 'telegram'))
        .limit(1);

      if (adminTg) {
        const adminCreds = JSON.parse(decrypt(adminTg.credential_data)) as { bot_token: string; chat_id: string };
        if (adminCreds.bot_token && adminCreds.chat_id) {
          if (type === 'start') {
            let liveUrl: string | undefined;
            try {
              const shareToken = await callService.createShareToken(this.callId);
              liveUrl = `https://${env.API_DOMAIN}/translate/${shareToken}`;
            } catch { /* ignore */ }
            await sendAdminTranslatorStart(adminCreds.bot_token, adminCreds.chat_id, {
              subscriberName,
              callerPhone,
              liveUrl,
            });
          } else {
            const balanceUsd = parseFloat(ws?.balance_usd as string) || 0;
            const pCost = providerCost ?? 0;
            const cCost = costTotal ?? 0;
            await sendAdminTranslatorEnd(adminCreds.bot_token, adminCreds.chat_id, {
              subscriberName,
              callerPhone,
              durationSecs: durationSecs ?? 0,
              providerCostUsd: pCost,
              clientCostUsd: cCost,
              profitUsd: cCost - pCost,
              balanceAfterUsd: balanceUsd,
            });
          }
        }
      }
    } catch { /* non-critical */ }
  }

  /** (Re)arm the idle-hangup timer — called on each successful translation. */
  private resetIdleTimer(): void {
    if (this.saved) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => { void this.hangupOnIdle(); }, ConferenceTranslator.IDLE_TIMEOUT_MS);
  }

  /** No translation/silence for IDLE_TIMEOUT_MS → end the Twilio call. */
  private async hangupOnIdle(): Promise<void> {
    if (this.saved) return;
    log.warn({ callId: this.callId, idleMs: ConferenceTranslator.IDLE_TIMEOUT_MS }, 'Translator idle — hanging up call');
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
    this.finalize().catch(() => {});
  }

  stop(): void {
    this.finalize().catch(err => log.error({ err, callId: this.callId }, 'Finalize error on stop'));
  }

  /**
   * Tear down for a mid-call engine swap WITHOUT finalizing/billing. Setting
   * `saved` blocks both the close→reconnect path and any stray finalize().
   * Returns the session state for the incoming engine to continue.
   */
  detach(): TranslatorCarryover {
    this.saved = true;
    if (this.safetyTimer) { clearTimeout(this.safetyTimer); this.safetyTimer = undefined; }
    if (this.statsTimer) { clearInterval(this.statsTimer); this.statsTimer = undefined; }
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = undefined; }
    if (this.playbackSafetyTimer) { clearTimeout(this.playbackSafetyTimer); this.playbackSafetyTimer = null; }
    if (this.bargeInTimer) { clearTimeout(this.bargeInTimer); this.bargeInTimer = null; }
    if (this.updateTimer) { clearTimeout(this.updateTimer); this.updateTimer = null; }
    this.clearRetranslationTimer();
    try { this.grokWs?.close(); } catch { /* ignore */ }
    return { sessionId: this.sessionId, startTime: this.startTime, transcript: this.transcript };
  }
}
