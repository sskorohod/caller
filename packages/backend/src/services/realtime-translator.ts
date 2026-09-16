/**
 * Voice translator backed by a single OpenAI Realtime Translation session.
 *
 * Replaces the Deepgram → gpt-4o-mini → TTS cascade for the voice path. The
 * cascade's floor was structural: Deepgram's utterance_end cannot go below
 * 1000 ms, so nothing could start translating until a second of silence had
 * been counted out. gpt-realtime-translate decides a speaker has finished by
 * meaning, and streams translated audio while the source is still arriving.
 *
 * ONE session, not two. The product is a single-leg speakerphone — both people
 * share one microphone, so the stream carries both languages mixed. The obvious
 * design is one session per direction, both fed the mixed stream, relying on the
 * model to stay quiet on speech already in its output language. That was
 * measured and rejected: 27% (ru↔en) to 41% (de↔ru) of same-language utterances
 * came back as verbatim echo, and it cannot be filtered downstream because a
 * leaked English sentence is English exactly like a correct English translation.
 *
 * Instead the single session is re-pointed per utterance: output.language is
 * always set to the OPPOSITE of what is being spoken, which makes the echo
 * impossible by construction — there is nowhere for it to go. The signal comes
 * from the session itself (see onInputTranscript), so there is no second service
 * and no second socket. Full workings in
 * docs/superpowers/specs/2026-09-16-openai-realtime-translation-design.md.
 */
import { EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import pino from 'pino';
import { eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import { translatorSessions } from '../db/schema.js';
import { getIo } from '../realtime/io.js';
import { resolveCredentials } from './credential-resolver.service.js';
import { calculateTelephonyCost } from '../config/pricing.js';
import * as callService from './call.service.js';
import { CYRILLIC_LANGS, LANG_FAMILIES } from '../lib/lang-direction.js';
import type { TranslatorCarryover } from '../models/types.js';
import { detect as detectLang } from 'tinyld';

const log = pino({ name: 'realtime-translator' });

const MODEL = process.env.REALTIME_TRANSLATE_MODEL || 'gpt-realtime-translate';
const ENDPOINT = 'wss://api.openai.com/v1/realtime/translations';
/** Duration-priced, not per token: $0.034/min at the time of writing. */
const COST_PER_MIN = Number(process.env.REALTIME_TRANSLATE_COST_PER_MIN || 0.034);

/**
 * Letters of fresh transcript needed before the direction is called. Two is
 * enough for a cross-script pair and the latency matters: measured median
 * switch lag was 1627 ms when waiting for tinyld's ~8 characters versus
 * ~1350 ms on two, and the session only tolerates roughly 1.2 s of lateness.
 */
const MIN_DETECT_LETTERS = Number(process.env.REALTIME_TRANSLATE_MIN_LETTERS || 2);
/** A gap this long in the transcript stream ends the current utterance. */
const UTTERANCE_GAP_MS = Number(process.env.REALTIME_TRANSLATE_GAP_MS || 1200);

export interface RealtimeTranslatorOptions {
  callId: string;
  workspaceId: string;
  /** Subscriber's language, e.g. 'ru'. */
  myLanguage: string;
  /** Other party's language, e.g. 'en'. */
  targetLanguage: string;
  /** Twilio media stream — audio source and sink. */
  socket: WebSocket;
  streamSid: string;
  /** One-way: only the subscriber→other direction is spoken. */
  oneWay?: boolean;
  greetingText?: string;
  greetingDelaySeconds?: number;
  /** Mid-call engine swap: reuse the existing session instead of starting fresh. */
  carryover?: TranslatorCarryover;
}

type TranscriptTurn = {
  speaker: string; text: string; lang: string; translated: string; timestamp: string;
};

export class RealtimeTranslator extends EventEmitter {
  readonly engine = 'voice';

  readonly workspaceId: string;
  private readonly callId: string;
  private readonly twilioSocket: WebSocket;
  private readonly streamSid: string;

  private myLang: string;
  private targetLang: string;
  private oneWay: boolean;
  private greetingText: string;
  private greetingDelaySeconds: number;

  private ws: WebSocket | null = null;
  private apiKey = '';
  /** What output.language is currently set to; null until the first update lands. */
  private outLang: string | null = null;
  /** Suppress audio into the line without tearing the session down. */
  private paused = false;

  private sessionId: string | null = null;
  private startTime = Date.now();
  private transcript: TranscriptTurn[] = [];
  private saved = false;
  private carryover?: TranslatorCarryover;

  // Utterance assembly. The session streams input and output transcripts as
  // deltas with no turn boundaries of its own, so a gap in the stream is what
  // ends a turn.
  private heardText = '';
  private saidText = '';
  private heardLang: string | null = null;
  private lastDeltaAt = 0;
  private turnTimer?: ReturnType<typeof setTimeout>;

  /** media-stream owns the PCM→µ-law converter; imported dynamically to dodge
   *  the cycle (it imports this module to build the engine), then cached because
   *  playAudio runs per audio delta. */
  private pcmToMulaw!: (pcm: Buffer) => Buffer;

  private safetyTimer?: ReturnType<typeof setTimeout>;
  private statsTimer?: ReturnType<typeof setInterval>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private greetingTimer?: ReturnType<typeof setTimeout>;

  private static readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000;
  private static readonly SAFETY_TIMEOUT_MS = 4 * 60 * 60 * 1000;

  constructor(options: RealtimeTranslatorOptions) {
    super();
    this.callId = options.callId;
    this.workspaceId = options.workspaceId;
    this.myLang = options.myLanguage;
    this.targetLang = options.targetLanguage;
    this.twilioSocket = options.socket;
    this.streamSid = options.streamSid;
    this.oneWay = options.oneWay ?? false;
    this.greetingText = options.greetingText || '';
    this.greetingDelaySeconds = Math.min(30, Math.max(0, options.greetingDelaySeconds ?? 5));
    this.carryover = options.carryover;
  }

  // ------------------------------------------------------------------ lifecycle

  async start(): Promise<void> {
    const creds = await resolveCredentials<{ api_key: string }>(this.workspaceId, 'openai');
    this.apiKey = creds.api_key;
    ({ pcmToMulaw: this.pcmToMulaw } = await import('../routes/webhooks/media-stream.js'));

    if (this.carryover) {
      this.sessionId = this.carryover.sessionId;
      this.startTime = this.carryover.startTime;
      this.transcript = this.carryover.transcript.slice();
    } else {
      const [session] = await db.insert(translatorSessions).values({
        subscriber_id: null as any,
        call_id: this.callId,
        workspace_id: this.workspaceId,
      }).returning();
      this.sessionId = session.id;
    }

    await this.openSession();

    this.safetyTimer = setTimeout(() => {
      log.warn({ callId: this.callId }, 'Realtime translator safety timer fired');
      this.finalize().catch(() => {});
    }, RealtimeTranslator.SAFETY_TIMEOUT_MS);

    this.statsTimer = setInterval(() => {
      const io = getIo();
      if (!io) return;
      const secs = Math.floor((Date.now() - this.startTime) / 1000);
      io.to(`call:${this.callId}`).emit('translator:stats', {
        call_id: this.callId,
        duration_seconds: secs,
        cost_usd: (secs / 60) * COST_PER_MIN,
      });
    }, 5000);

    this.resetIdleTimer();

    // The greeting is spoken by us, not by the model: gpt-realtime-translate
    // takes no instructions, and a greeting is not a translation of anything.
    if (this.greetingText && !this.carryover) {
      this.greetingTimer = setTimeout(() => {
        this.speakGreeting().catch(err => log.warn({ err, callId: this.callId }, 'Greeting failed'));
      }, this.greetingDelaySeconds * 1000);
    }
  }

  private async openSession(): Promise<void> {
    const ws = new WebSocket(`${ENDPOINT}?model=${MODEL}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      const onErr = (err: Error) => reject(err);
      ws.once('open', () => { ws.off('error', onErr); resolve(); });
      ws.once('error', onErr);
    });

    // Input transcription is what lets the session steer itself — it is emitted
    // regardless of which way output.language currently points.
    this.send({
      type: 'session.update',
      session: {
        audio: {
          input: {
            transcription: { model: 'gpt-realtime-whisper' },
            noise_reduction: { type: 'far_field' },
          },
          output: { language: this.targetLang },
        },
      },
    });
    this.outLang = this.targetLang;

    ws.on('message', (raw: Buffer) => {
      let ev: any;
      try { ev = JSON.parse(raw.toString()); } catch { return; }
      this.onEvent(ev);
    });
    ws.on('error', (err) => log.error({ err, callId: this.callId }, 'Realtime translate socket error'));
    ws.on('close', () => { if (!this.saved) log.warn({ callId: this.callId }, 'Realtime translate socket closed mid-call'); });
  }

  private send(msg: unknown): void {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  // ------------------------------------------------------------------ events

  private onEvent(ev: any): void {
    switch (ev.type) {
      case 'session.input_transcript.delta':
        this.onInputTranscript(String(ev.delta ?? ''));
        break;
      case 'session.output_transcript.delta':
        this.saidText += String(ev.delta ?? '');
        this.armTurnFlush();
        break;
      case 'session.output_audio.delta':
        this.playAudio(String(ev.delta ?? ''));
        break;
      default:
        if (/error/i.test(ev.type ?? '')) {
          log.error({ callId: this.callId, ev }, 'Realtime translate error event');
        }
    }
  }

  /**
   * Steering. Whatever language is being spoken, point the output at the other
   * one — that is what makes an echo impossible rather than merely unlikely.
   */
  private onInputTranscript(delta: string): void {
    const now = Date.now();
    // A gap means a new utterance: the previous speaker's words must not decide
    // this one's direction.
    if (this.lastDeltaAt && now - this.lastDeltaAt > UTTERANCE_GAP_MS) this.flushTurn();
    this.lastDeltaAt = now;
    this.heardText += delta;
    this.armTurnFlush();

    if (this.heardLang) return; // direction already called for this utterance
    const heard = this.detectDirection(this.heardText);
    if (!heard) return;

    this.heardLang = heard;
    const want = heard === this.myLang ? this.targetLang : this.myLang;
    if (want !== this.outLang) {
      this.outLang = want;
      this.send({ type: 'session.update', session: { audio: { output: { language: want } } } });
    }
  }

  /**
   * For a cross-script pair the language is legible from the first letters, with
   * no statistics and no waiting — and waiting is what costs us, since the switch
   * has to land before the model commits to an output language. tinyld is the
   * fallback for same-script pairs, where there is no shortcut.
   */
  private detectDirection(text: string): string | null {
    const letters = text.replace(/[^\p{L}]/gu, '');
    if (letters.length < MIN_DETECT_LETTERS) return null;

    const myCyr = CYRILLIC_LANGS.has(this.myLang);
    const targetCyr = CYRILLIC_LANGS.has(this.targetLang);
    if (myCyr !== targetCyr) {
      const ratio = (letters.match(/[Ѐ-ӿ]/g) || []).length / letters.length;
      if (ratio > 0.6) return myCyr ? this.myLang : this.targetLang;
      if (ratio < 0.4) return myCyr ? this.targetLang : this.myLang;
      return null; // genuinely mixed — wait for more
    }

    if (letters.length < 8) return null; // tinyld is unreliable below this
    const d = detectLang(text);
    if (!d) return null;
    if (d === this.myLang) return this.myLang;
    if (d === this.targetLang) return this.targetLang;
    if ((LANG_FAMILIES[this.myLang] ?? []).includes(d)) return this.myLang;
    if ((LANG_FAMILIES[this.targetLang] ?? []).includes(d)) return this.targetLang;
    return null;
  }

  private armTurnFlush(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = setTimeout(() => this.flushTurn(), UTTERANCE_GAP_MS);
  }

  /** Commit one utterance to the transcript and push it to the frontend. */
  private flushTurn(): void {
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = undefined; }
    const heard = this.heardText.trim();
    const said = this.saidText.trim();
    this.heardText = '';
    this.saidText = '';
    const lang = this.heardLang;
    this.heardLang = null;
    if (!heard) return;

    // Direction is known from steering, so speaker needs no second guess.
    const isMyLang = lang ? lang === this.myLang : true;
    const speaker = isMyLang ? 'subscriber' : 'other';
    const detected = lang ?? this.myLang;

    if (said) this.resetIdleTimer();
    this.transcript.push({ speaker, text: heard, lang: detected, translated: said, timestamp: new Date().toISOString() });
    this.emitTurn(speaker, heard, said, detected);

    log.info({
      callId: this.callId, metric: 'realtime_turn',
      speaker, detected, input_chars: heard.length, output_chars: said.length,
    }, 'realtime_turn');
  }

  /**
   * The only place a finished turn reaches the frontend. Field-for-field
   * identical to StealthTranslator.emitTurn — the /translate page and the
   * dashboard must not be able to tell which engine produced a call.
   */
  private emitTurn(speaker: string, original: string, translated: string, detectedLang: string): void {
    const io = getIo();
    if (!io) return;
    io.to(`call:${this.callId}:translate`).emit('call:translation', {
      call_id: this.callId, speaker, original, translated,
      detected_language: detectedLang, timestamp: new Date().toISOString(),
    });
    io.to(`call:${this.callId}`).emit('call:transcript', {
      call_id: this.callId, speaker: 'conference', text: original,
      timestamp: new Date().toISOString(), isFinal: true,
    });
  }

  // ------------------------------------------------------------------ audio

  /** Twilio µ-law 8 kHz in; the endpoint wants PCM16 24 kHz. */
  sendAudio(audioBuffer: Buffer): void {
    if (this.paused || this.saved || this.ws?.readyState !== 1) return;
    const pcm = mulawToPcm24k(audioBuffer);
    this.send({ type: 'session.input_audio_buffer.append', audio: pcm.toString('base64') });
  }

  /** Translated audio back out: PCM16 24 kHz → µ-law 8 kHz → Twilio frames. */
  private playAudio(b64: string): void {
    if (this.paused || !b64) return;
    if (this.oneWay && this.heardLang && this.heardLang !== this.myLang) return;
    let mulaw: Buffer;
    try {
      mulaw = this.pcmToMulaw(Buffer.from(b64, 'base64'));
    } catch (err) {
      log.warn({ err, callId: this.callId }, 'Failed to convert translated audio');
      return;
    }
    this.sendToTwilio(mulaw);
  }

  private sendToTwilio(buf: Buffer): void {
    if (this.twilioSocket.readyState !== 1) return;
    for (let i = 0; i < buf.length; i += 640) {
      this.twilioSocket.send(JSON.stringify({
        event: 'media', streamSid: this.streamSid,
        media: { payload: buf.subarray(i, i + 640).toString('base64') },
      }));
    }
  }

  /**
   * Spoken by us through the ordinary TTS service. The model cannot do it: it
   * takes no instructions and only ever translates what it hears, so asking it
   * to greet is not a thing that exists on this endpoint.
   */
  private async speakGreeting(): Promise<void> {
    if (this.saved) return;
    const { OpenAITTS } = await import('./tts.service.js');
    const pcm = await new OpenAITTS(this.apiKey, process.env.VOICE_TTS_VOICE || 'alloy').synthesize(this.greetingText);
    if (this.saved) return;
    this.sendToTwilio(this.pcmToMulaw(pcm));
    log.info({ callId: this.callId, chars: this.greetingText.length }, 'Realtime translator greeting spoken');
  }

  // ------------------------------------------------------------------ controls

  updateLanguages(myLang: string, targetLang: string): void {
    this.myLang = myLang;
    this.targetLang = targetLang;
    // Next utterance re-points the session; no need to force it now.
    log.info({ callId: this.callId, myLang, targetLang }, 'Realtime translator languages updated');
  }

  /**
   * Voice is not selectable on this endpoint — it uses dynamic voice adaptation,
   * following the source speaker's tone and pitch instead of a fixed voice. Kept
   * so the socket handler and Telegram commands can call it blindly.
   */
  updateVoice(voice: string): void {
    log.info({ callId: this.callId, voice }, 'Voice ignored: realtime translation adapts to the speaker');
  }

  /** Tone is not selectable either — the model takes no instructions. */
  updateTone(tone: string): void {
    log.info({ callId: this.callId, tone }, 'Tone ignored: realtime translation takes no instructions');
  }

  /**
   * Only the voice sub-modes reach here. Switching to stealth swaps the engine
   * outright (setTranslatorMode compares engine tags and hands off via detach),
   * so there is no silent mode to implement on this side.
   */
  updateMode(mode: string): void {
    this.oneWay = mode === 'text' || mode === 'unidirectional';
    log.info({ callId: this.callId, mode, oneWay: this.oneWay }, 'Realtime translator mode updated');
  }

  pause(): void { this.paused = true; log.info({ callId: this.callId }, 'Realtime translator paused'); }
  resume(): void { this.paused = false; log.info({ callId: this.callId }, 'Realtime translator resumed'); }
  isPaused(): boolean { return this.paused; }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.hangupOnIdle().catch(() => {}), RealtimeTranslator.IDLE_TIMEOUT_MS);
  }

  private async hangupOnIdle(): Promise<void> {
    if (this.saved) return;
    log.info({ callId: this.callId }, 'Realtime translator idle timeout — hanging up');
    try {
      const call = await callService.getCall(this.workspaceId, this.callId);
      const sid = (call as any)?.twilio_call_sid;
      if (sid) {
        const telephony = await import('./telephony.service.js');
        await telephony.hangupCall(this.workspaceId, sid);
      }
    } catch (err) {
      log.warn({ err, callId: this.callId }, 'Idle hangup failed');
    }
    await this.finalize();
  }

  // ------------------------------------------------------------------ teardown

  stop(): void {
    this.flushTurn();
    this.closeSession();
    this.finalize().catch(err => log.error({ err, callId: this.callId }, 'Finalize failed'));
  }

  /** Hand session state to another engine without billing this one. */
  detach(): TranslatorCarryover {
    this.saved = true;
    this.clearTimers();
    this.closeSession();
    return { sessionId: this.sessionId, startTime: this.startTime, transcript: this.transcript.slice() };
  }

  /**
   * The endpoint asks for session.close before the socket goes, or translated
   * audio still draining is dropped. The close is best-effort and deliberately
   * not awaited — teardown must not hang on a provider that has gone quiet.
   */
  private closeSession(): void {
    if (!this.ws) return;
    const ws = this.ws;
    this.ws = null;
    try { ws.send(JSON.stringify({ type: 'session.close' })); } catch { /* going away regardless */ }
    setTimeout(() => { try { ws.close(); } catch { /* already gone */ } }, 500);
  }

  private clearTimers(): void {
    for (const t of [this.safetyTimer, this.idleTimer, this.greetingTimer, this.turnTimer]) if (t) clearTimeout(t);
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.safetyTimer = this.idleTimer = this.greetingTimer = this.turnTimer = undefined;
    this.statsTimer = undefined;
  }

  async finalize(): Promise<void> {
    if (this.saved) return;
    this.saved = true;
    this.clearTimers();

    const durationSecs = Math.floor((Date.now() - this.startTime) / 1000);
    const durationMins = durationSecs / 60;
    const minutesUsed = Math.ceil(durationMins * 100) / 100;

    // One duration-priced session, so there is no stt/llm/tts split to make.
    // It goes in the stt bucket because that is where the dashboard's breakdown
    // looks for compute cost (billing.service.ts matches ILIKE '%stt%').
    const costTranslate = durationMins * COST_PER_MIN;
    const costTelephony = calculateTelephonyCost('twilio', durationMins);
    const costTotal = costTranslate + costTelephony;

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
        log.error({ err, callId: this.callId }, 'Failed to update realtime translator session');
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
        costs: {
          stt: costTranslate, llm: 0, tts: 0, telephony: costTelephony,
          sttProvider: 'openai', llmProvider: 'openai', ttsProvider: 'openai',
        },
        durationSecs,
      });
    }

    log.info({ callId: this.callId, durationSecs, minutesUsed, costTotal, turns: this.transcript.length },
      'Realtime translator finalized');
  }
}

// ---------------------------------------------------------------- audio helpers

/** µ-law byte → signed 16-bit sample. */
function mulawDecode(u: number): number {
  u = ~u & 0xFF;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0F;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  return sign ? -sample : sample;
}

/**
 * Twilio µ-law 8 kHz → PCM16 24 kHz, the format the translations endpoint wants.
 * Sample-and-hold ×3 rather than interpolation: the source is band-limited to
 * 4 kHz by the phone line anyway, so interpolating invents nothing the model can
 * use, and this runs on every inbound frame.
 */
export function mulawToPcm24k(mulaw: Buffer): Buffer {
  const out = Buffer.alloc(mulaw.length * 3 * 2);
  let o = 0;
  for (let i = 0; i < mulaw.length; i++) {
    const s = mulawDecode(mulaw[i]);
    out.writeInt16LE(s, o); o += 2;
    out.writeInt16LE(s, o); o += 2;
    out.writeInt16LE(s, o); o += 2;
  }
  return out;
}

