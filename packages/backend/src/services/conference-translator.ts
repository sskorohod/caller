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
  socket: WebSocket;        // Twilio media stream WebSocket
  streamSid: string;        // Twilio stream SID
}

import { LANG_NAMES, TONE_INSTRUCTIONS } from '../config/languages.js';

const DEFAULT_GREETING = `A live interpreter has joined this call. I will translate between your languages. Please speak naturally, then pause briefly after finishing your thought so I can translate. Let's begin.`;

/**
 * Conference Translator — uses xAI Grok Voice Agent API for speech-to-speech
 * translation with minimal latency. Single WebSocket replaces STT+LLM+TTS pipeline.
 *
 * Audio flow:
 *   mixed audio (mulaw 8kHz) → Grok Voice Agent → translated audio (mulaw 8kHz) → inject
 */
export class ConferenceTranslator extends EventEmitter {
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

  private transcript: Array<{ speaker: string; text: string; lang: string; translated: string; timestamp: string; untranslated?: boolean }> = [];
  private sessionId: string | null = null;
  private startTime: number = Date.now();
  private saved: boolean = false;
  private safetyTimer?: ReturnType<typeof setTimeout>;
  private statsTimer?: ReturnType<typeof setInterval>;
  private xaiApiKey: string = '';
  private greetingSent: boolean = false;
  private greetingPlayed: boolean = false; // true once greeting response.done fires (or no greeting configured)

  // Accumulate transcript text from Grok responses
  private currentInputTranscript: string = '';
  private currentOutputTranscript: string = '';
  private currentResponseAudio: Buffer[] = []; // buffer audio until language verified
  private retranslationPending: boolean = false;
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
  private bargeInTimer: ReturnType<typeof setTimeout> | null = null;

  private static readonly MAX_UNINTERRUPTIBLE_PLAYBACK_MS = 6000;
  private static readonly MARK_CHUNK_INTERVAL = 25; // ~200ms of mulaw 8kHz audio
  private static readonly BARGE_IN_THRESHOLD_MS = 4000; // 4 seconds of continuous speech to interrupt

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
  }

  async start(): Promise<void> {
    // Get xAI API key — global fallback (translator works for all plans)
    const { resolveCredentialsWithGlobalFallback } = await import('./credential-resolver.service.js');
    const creds = await resolveCredentialsWithGlobalFallback<{ api_key: string }>(this.workspaceId, 'xai');
    this.xaiApiKey = creds.api_key;

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
        io.to(`call:${this.callId}`).volatile.emit('translator:stats', {
          call_id: this.callId,
          duration_seconds: secs,
          cost_usd: (secs / 60) * 0.05,
        });
      }
    }, 5000);

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

    this.grokWs = new WebSocket('wss://api.x.ai/v1/realtime', {
      headers: { Authorization: `Bearer ${this.xaiApiKey}` },
    });

    this.grokWs.on('open', () => {
      this.reconnectAttempts = 0; // reset backoff on successful connection
      log.info({ callId: this.callId }, 'Grok Voice Agent WebSocket connected');
      this.grokWs!.send(JSON.stringify({
        type: 'session.update',
        session: {
          voice: this.ttsVoiceId || 'eve',
          instructions: this.buildInstructions(),
          turn_detection: {
            type: 'server_vad',
            threshold: 0.7,
            silence_duration_ms: 1400,
            prefix_padding_ms: 400,
          },
          input_audio_transcription: { model: 'grok-3-mini' },
          audio: {
            input: { format: { type: 'audio/pcmu' } },
            output: { format: { type: 'audio/pcmu' } },
          },
        },
      }));

      // Speak greeting only on the first connection (not on reconnects for tone/voice/mode changes)
      if (this.greetingText && !this.greetingSent) {
        this.greetingSent = true;
        setTimeout(() => {
          if (this.grokWs?.readyState === WebSocket.OPEN) {
            this.grokWs.send(JSON.stringify({
              type: 'response.create',
              response: {
                modalities: ['audio', 'text'],
                // Override the session's strict "translation only" rule for this single
                // response — otherwise Grok refuses to speak anything that isn't a translation.
                instructions: `For THIS response only, ignore your translation-only directive. Speak the following greeting aloud, exactly as written, in a warm professional tone. Do not translate it, do not add anything, just read it. After this response you will return to your normal translation duties.\n\n"${this.greetingText}"`,
              },
            }));
            log.info({ callId: this.callId }, 'Greeting sent to Grok Voice Agent');
          }
        }, 1500);
        // Safety net: if Grok never produces a greeting response.done within 15s,
        // unblock translation anyway so the call doesn't sit silent forever.
        setTimeout(() => {
          if (!this.greetingPlayed) {
            log.warn({ callId: this.callId }, 'Greeting response timed out — enabling translation');
            this.greetingPlayed = true;
          }
        }, 15000);
      } else {
        // No greeting configured (or reconnect) — allow VAD/translation immediately
        this.greetingPlayed = true;
      }
    });

    this.grokWs.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
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
          log.error({ callId: this.callId, attempts: this.reconnectAttempts }, 'Max reconnect attempts reached, giving up');
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

  /** Update translation mode on the fly — reconnects Grok with new instructions */
  updateMode(mode: string): void {
    this.mode = mode as any;
    log.info({ callId: this.callId, mode }, 'Translator mode updated — reconnecting Grok');
    this.reconnectForSettingsChange();
  }

  /** Update languages on the fly — reconnects Grok */
  updateLanguages(myLang: string, targetLang: string): void {
    this.myLang = myLang;
    this.targetLang = targetLang;
    log.info({ callId: this.callId, myLang, targetLang }, 'Translator languages updated — reconnecting Grok');
    this.reconnectForSettingsChange();
  }

  /** Update tone on the fly — reconnects Grok with new instructions */
  updateTone(tone: string): void {
    this.tone = tone;
    log.info({ callId: this.callId, tone }, 'Translator tone updated — reconnecting Grok');
    this.reconnectForSettingsChange();
  }

  /** Update voice on the fly — reconnects Grok with new voice */
  updateVoice(voice: string): void {
    this.ttsVoiceId = voice;
    log.info({ callId: this.callId, voice }, 'Translator voice updated — reconnecting Grok');
    this.reconnectForSettingsChange();
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

  private static readonly CYRILLIC_LANGS = new Set(['ru', 'uk', 'bg', 'sr']);

  /** Check if configured language pair uses different scripts (Cyrillic vs Latin) */
  private languagesUseDifferentScripts(): boolean {
    const myIsCyrillic = ConferenceTranslator.CYRILLIC_LANGS.has(this.myLang);
    const targetIsCyrillic = ConferenceTranslator.CYRILLIC_LANGS.has(this.targetLang);
    return myIsCyrillic !== targetIsCyrillic;
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

  /** Reset per-turn streaming state (called on speech_started and after response.done). */
  private resetTurnStreamingState(): void {
    this.streamingApproved = false;
    this.streamedAlready = false;
    this.currentInputDirectionKnown = false;
  }

  /** Try to enable streaming once we know direction + script is safe. */
  private tryApproveStreaming(): void {
    if (this.streamingApproved || this.streamedAlready) return;
    if (!this.currentInputDirectionKnown) return;
    if (this.currentOutputTranscript.length < 6) return;
    if (!this.currentInputTranscript) return; // greeting/system response — not streamed

    const isOneWay = this.mode === 'text' || this.mode === 'unidirectional';
    if (isOneWay && !this.currentIsMyLang) return; // other party's audio shouldn't play

    if (this.languagesUseDifferentScripts()) {
      const inputScript = this.detectScript(this.currentInputTranscript);
      const outputScript = this.detectScript(this.currentOutputTranscript);
      if (inputScript && outputScript && inputScript === outputScript) {
        // Likely same-language echo — keep buffering, response.done will re-translate.
        return;
      }
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
        // Deferred barge-in: start a 4-second timer. Only interrupt the translation
        // if speech is sustained for ≥4 seconds. Short utterances (acknowledgements,
        // fillers, brief replies) must not cut off the translator mid-sentence.
        this.speechStartedAt = Date.now();
        if (this.bargeInTimer) clearTimeout(this.bargeInTimer);
        this.bargeInTimer = setTimeout(() => {
          this.bargeInTimer = null;
          this.performBargeIn();
        }, ConferenceTranslator.BARGE_IN_THRESHOLD_MS);
        const io0 = getIo();
        if (io0) {
          io0.to(`call:${this.callId}`).volatile.emit('call:transcript', {
            call_id: this.callId, speaker: 'conference', text: '', timestamp: new Date().toISOString(), isFinal: false,
          });
        }
        break;
      }

      case 'input_audio_buffer.speech_stopped': {
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
        // Accumulate output transcript + emit interim translation
        if (msg.delta) {
          this.currentOutputTranscript += msg.delta;
          this.tryApproveStreaming();
          const io3 = getIo();
          if (io3) {
            io3.to(`call:${this.callId}:translate`).volatile.emit('call:translation:interim', {
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
          // Determine direction now (mirrors logic in response.done's transcript push).
          const cyrillicRatio = (this.currentInputTranscript.match(/[\u0400-\u04FF]/g) || []).length
            / Math.max(this.currentInputTranscript.length, 1);
          this.currentIsMyLang = cyrillicRatio > 0.3 ? this.myLang === 'ru' : this.myLang !== 'ru';
          this.currentInputDirectionKnown = true;
          this.tryApproveStreaming();
          const io2 = getIo();
          if (io2) {
            io2.to(`call:${this.callId}`).volatile.emit('call:transcript', {
              call_id: this.callId, speaker: 'conference', text: this.currentInputTranscript,
              timestamp: new Date().toISOString(), isFinal: false,
            });
          }
        }
        break;

      case 'response.done': {
        // Translation turn complete — save transcript and emit to UI
        const original = this.currentInputTranscript;
        const translated = this.currentOutputTranscript.trim();
        const wasStreamed = this.streamedAlready;

        // Greeting or system response (no input) — inject audio directly (never streamed)
        if (!original) {
          const audioBytes = this.currentResponseAudio.reduce((s, b) => s + b.length, 0);
          if (this.currentResponseAudio.length > 0 && this.twilioSocket.readyState === 1) {
            const chunkSize = 640;
            for (const buf of this.currentResponseAudio) {
              for (let i = 0; i < buf.length; i += chunkSize) {
                this.twilioSocket.send(JSON.stringify({
                  event: 'media',
                  streamSid: this.streamSid,
                  media: { payload: buf.subarray(i, i + chunkSize).toString('base64') },
                }));
              }
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
          // Same-language echo detection — if output matches input script, re-translate.
          // Only meaningful when streaming wasn't approved (streaming itself rejects same-script outputs).
          if (!wasStreamed) {
            const inputScript = this.detectScript(original);
            const outputScript = this.detectScript(translated);

            if (this.languagesUseDifferentScripts() && inputScript && outputScript && inputScript === outputScript && !this.retranslationPending) {
              this.retranslationPending = true;
              const targetLangForRetry = inputScript === 'cyrillic'
                ? (LANG_NAMES[this.targetLang] || this.targetLang)
                : (LANG_NAMES[this.myLang] || this.myLang);

              log.warn({
                callId: this.callId, inputScript, outputScript,
                original: original.slice(0, 80), translated: translated.slice(0, 80),
              }, 'Same-language echo detected — requesting re-translation');

              // Clear stale echo audio from Twilio buffer
              if (this.twilioSocket.readyState === 1) {
                this.twilioSocket.send(JSON.stringify({ event: 'clear', streamSid: this.streamSid }));
              }

              // Request explicit re-translation
              if (this.grokWs?.readyState === WebSocket.OPEN) {
                this.grokWs.send(JSON.stringify({
                  type: 'response.create',
                  response: {
                    modalities: ['audio', 'text'],
                    instructions: `Translate the following to ${targetLangForRetry}. Output ONLY the ${targetLangForRetry} translation, nothing else: "${original}"`,
                  },
                }));
              }

              this.resetTurnStreamingState();
              this.currentOutputTranscript = '';
              this.currentResponseAudio = [];
              break;
            }
          }

          this.retranslationPending = false;

          // Detect direction
          const cyrillicRatio = (original.match(/[\u0400-\u04FF]/g) || []).length / Math.max(original.length, 1);
          const isMyLang = cyrillicRatio > 0.3 ? this.myLang === 'ru' : this.myLang !== 'ru';
          const speaker = isMyLang ? 'subscriber' : 'other';
          const detectedLang = isMyLang ? this.myLang : this.targetLang;

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
          log.warn({
            callId: this.callId,
            original: original.slice(0, 200),
            wasStreamed,
            retranslationWas: this.retranslationPending,
          }, 'Translation dropped: empty output from Grok');

          const cyrillicRatio = (original.match(/[Ѐ-ӿ]/g) || []).length / Math.max(original.length, 1);
          const isMyLang = cyrillicRatio > 0.3 ? this.myLang === 'ru' : this.myLang !== 'ru';
          const speaker = isMyLang ? 'subscriber' : 'other';
          const detectedLang = isMyLang ? this.myLang : this.targetLang;

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
    this.speechStartedAt = null;

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

  stop(): void {
    this.finalize().catch(err => log.error({ err, callId: this.callId }, 'Finalize error on stop'));
  }
}
