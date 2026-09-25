/**
 * The consecutive interpreter on a Twilio call — aidispatch's agent/consecutive/call.py
 * brought to LingoLine.
 *
 * Twilio line → voice detector and echo meter → transcriber (gpt-live-transcribe) →
 * turn-taking core (floor) → translation and speech prepared ahead (engine) → playback,
 * one utterance at a time → Twilio. A translation plays when the person has finished the
 * thought, not over them.
 *
 * It keeps the duck-typed interface media-stream expects from every translator (sendAudio,
 * stop, detach, update*, pause/resume) and StealthTranslator's Socket.IO payloads byte for
 * byte, so the /translate page cannot tell the engines apart.
 *
 * Parts are replaceable (clock, output, transcriber, detector, judge, engine, client): the
 * tests and the smoke scene run this same code without a call.
 */
import { EventEmitter } from 'node:events';
import https from 'node:https';
import pino from 'pino';
import OpenAI from 'openai';
import { getIo } from '../../realtime/io.js';
import { getLangName } from '../../config/languages.js';
import { calculateLLMCost, calculateSTTCost, calculateTelephonyCost } from '../../config/pricing.js';
import type { TranslatorCarryover } from '../../models/types.js';
import { Downsampler3, mulawToPcm, pcmToMulaw, Upsampler3 } from './audio.js';
import { EchoMeter } from './echo.js';
import { FloorManager, type Command } from './floor.js';
import { Judge, JUDGE_MODEL, type IntentLabel } from './judge.js';
import { CascadeEngine, resolveVoice, TTS_MODEL, type EngineCallbacks, type OpenAILike } from './engine.js';
import { Playback, type PlaybackOut } from './playback.js';
import { TwilioOut, type TwilioSocketLike } from './twilio-out.js';
import { TranscribeLeg, TRANSCRIBE_FORMAT, type TranscribeFormat } from './transcribe.js';
import { loadSilero, VadStream, type VadEvent, type VadModel } from './vad.js';
import { DEFAULT_CONSECUTIVE_SETTINGS, loadConsecutiveSettings, type ConsecutiveSettings } from './settings.js';
import { isCrossScriptPair } from './policy.js';

const log = pino({ name: 'consecutive' });

const TICK_MS = 50;
const COMMIT_QUIET_S = 0.35;     // a transcription segment closes only after this much line silence...
const COMMIT_QUIET_PROB = 0.5;   // ...and with no speech in the detector's last window (its start threshold is 0.7)
export const COMMIT_FORCE_S = 10;   // no silence at all — close anyway: the transcriber buffer must not grow forever
export const CLOSE_TIMEOUT_MS = 1800;
const INTERIM_EVERY_S = 0.25;
const STATS_EVERY_MS = 5000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const SAFETY_TIMEOUT_MS = 4 * 60 * 60 * 1000;
const STT_PRICE_KEY = 'openai-live-transcribe';
// Connections to OpenAI. The SDK's default agent drops an idle socket after 4 s, and the pause
// between replies is usually longer: every reply reopened them (+0.1–0.2 s to speech and to
// translation). OpenAI keeps an idle connection at least 4 minutes (aidispatch, 25.09).
export const KEEPALIVE_MS = 300_000;
export const WARM_CONNECTIONS = 4;   // judge, translation and two syntheses at once

export function httpAgent(): https.Agent {
  return new https.Agent({ keepAlive: true, timeout: KEEPALIVE_MS, maxFreeSockets: 20 });
}

export interface TranscriberLike {
  audioSeconds: number;
  start(): Promise<boolean>;
  push(audio: Buffer): void;
  commit(): boolean;
  setLanguages?(languages: string[]): void;
  aclose(): Promise<void>;
}

export interface JudgeLike {
  usage: { in: number; out: number };
  semanticEnd(text: string): Promise<[boolean, number] | null>;
  intent(text: string, playing: string): Promise<[IntentLabel, number] | null>;
  setLanguages?(names: [string, string]): void;
}

export interface EngineLike {
  usage: Record<string, number>;
  start(): Promise<boolean>;
  opened(utt: number, lang: string | null, candidate: boolean): void;
  updated(utt: number, text: string): void;
  released(utt: number, text: string): void;
  prepare(utt: number, text: string): void;
  reopened(utt: number): void;
  restart(utt: number): boolean;
  dropped(utt: number): void;
  stopped(utt: number): void;
  setVoice?(voice: string): void;
  setTone?(tone: string): void;
  setLanguages?(langA: string, langB: string): void;
  setSilentLangs?(langs: Iterable<string>): void;
  synthesize?(text: string): Promise<Buffer>;
  costs(): { text: number; tts: number };
  aclose(): Promise<void>;
}

export interface ConsecutiveParts {
  apiKey?: string;
  client?: OpenAILike;
  settings?: ConsecutiveSettings;
  /** null: run without a voice detector (tests). Omitted: load Silero. */
  vadModel?: VadModel | null;
  /** Tests and the smoke scene: build the transcriber around our delta handler. */
  transcriberFactory?: (onDelta: (itemId: string, text: string) => void) => TranscriberLike;
  judge?: JudgeLike;
  engineFactory?: (callbacks: EngineCallbacks) => EngineLike;
  out?: PlaybackOut;
  /** Monotonic seconds. */
  clock?: () => number;
  /** false: no database, Socket.IO or billing — the smoke scene and tests. */
  persist?: boolean;
  transcribeFormat?: TranscribeFormat;
}

export interface ConsecutiveTranslatorOptions {
  callId: string;
  workspaceId: string;
  /** Subscriber's language, e.g. 'ru'. */
  myLanguage: string;
  /** Other party's language, e.g. 'en'. */
  targetLanguage: string;
  socket: TwilioSocketLike;
  streamSid: string;
  /** One-way: only the subscriber's side is spoken; the other side is translated as text. */
  oneWay?: boolean;
  ttsVoiceId?: string;
  tone?: string;
  personalContext?: string;
  greetingText?: string;
  greetingDelaySeconds?: number;
  carryover?: TranslatorCarryover;
  parts?: ConsecutiveParts;
}

type Turn = {
  speaker: string; text: string; lang: string; translated: string; timestamp: string;
  untranslated?: boolean; interrupted?: boolean; skipped?: string;
};

function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** Linear-interpolated percentile, as aidispatch's agent.store.percentile. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  if (ordered.length === 1) return ordered[0];
  const rank = (p / 100) * (ordered.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return ordered[lo];
  return roundHalfEven(ordered[lo] + (ordered[hi] - ordered[lo]) * (rank - lo));
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** The error's class for the log, never its message (it can carry the key): its name ('TimeoutError' of a
 *  DOMException), unless that is the generic 'Error' the OpenAI SDK's classes leave — then the class's own. */
function errorName(err: unknown): string | undefined {
  const e = err as { name?: string; constructor?: { name?: string } } | null | undefined;
  return e?.name && e.name !== 'Error' ? e.name : e?.constructor?.name || e?.name;
}

export class ConsecutiveTranslator extends EventEmitter {
  readonly engine = 'voice';          // media-stream's mode toggle treats us as a voice engine
  readonly impl = 'consecutive';      // media-stream falls back to the cascade when we fail to start
  readonly workspaceId: string;
  readonly callId: string;

  /** Public: the smoke scene watches it. */
  floor!: FloorManager;

  private myLang: string;
  private targetLang: string;
  private oneWay: boolean;
  private voice: string;
  private tone: string;
  private personalContext: string;
  private readonly greetingText: string;
  private readonly greetingDelaySeconds: number;
  private readonly parts: ConsecutiveParts;
  private readonly persist: boolean;
  private readonly clock: () => number;
  private readonly transcribeFormat: TranscribeFormat;
  private carryover?: TranslatorCarryover;

  private settings: ConsecutiveSettings = DEFAULT_CONSECUTIVE_SETTINGS;
  private agent: https.Agent | null = null;   // this call's connections to OpenAI, destroyed with it
  private client!: OpenAILike;
  private out!: PlaybackOut;
  private player!: Playback;
  private transcriber!: TranscriberLike;
  private judge!: JudgeLike;
  private engineImpl!: EngineLike;
  private vad: VadStream | null = null;
  private fedByVad = false;          // the transcriber hears the line through the frames the detector checked
  private commitDue: number | null = null;   // the core asked to close a segment; closed in the next silence
  private readonly echo = new EchoMeter();    // is our echo on the line at all: without it the echo filter only harms
  private readonly up3 = new Upsampler3();
  private readonly down = new Map<number, Downsampler3>();

  private readonly translations = new Map<number, string>();
  private readonly hasAudio = new Set<number>();
  private readonly engineDone = new Set<number>();   // the engine said "no more audio", and nothing reopened it since
  private readonly logged = new Set<number>();
  private readonly interimAt = new Map<number, number>();

  private sessionId: string | null = null;
  private startTime = Date.now();
  private transcript: Turn[] = [];
  private paused = false;
  private closed = false;
  private saved = false;

  private ticker?: ReturnType<typeof setInterval>;
  private statsTimer?: ReturnType<typeof setInterval>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private safetyTimer?: ReturnType<typeof setTimeout>;
  private greetingTimer?: ReturnType<typeof setTimeout>;
  private tickFailures = 0;
  private readonly side = new Set<Promise<unknown>>();
  private booting: Promise<void> | null = null;
  private closing: Promise<unknown> | null = null;   // the sockets, closing since shutdown(); awaited last

  constructor(private readonly opts: ConsecutiveTranslatorOptions) {
    super();
    this.callId = opts.callId;
    this.workspaceId = opts.workspaceId;
    this.myLang = opts.myLanguage;
    this.targetLang = opts.targetLanguage;
    this.oneWay = opts.oneWay ?? false;
    this.voice = resolveVoice(opts.ttsVoiceId);
    this.tone = opts.tone || '';
    this.personalContext = (opts.personalContext || '').trim();
    this.greetingText = (opts.greetingText || '').trim();
    // a garbage stored setting arrives as NaN, and setTimeout(NaN) would fire at once
    const delay = opts.greetingDelaySeconds;
    this.greetingDelaySeconds = Math.min(30, Math.max(0, typeof delay === 'number' && Number.isFinite(delay) ? delay : 5));
    this.carryover = opts.carryover;
    this.parts = opts.parts ?? {};
    this.persist = this.parts.persist ?? true;
    this.clock = this.parts.clock ?? (() => performance.now() / 1000);
    this.transcribeFormat = this.parts.transcribeFormat ?? TRANSCRIBE_FORMAT;
  }

  // ------------------------------------------------------------------ lifecycle

  /** Throws when the detector or the transcriber cannot come up: media-stream then runs the cascade. */
  async start(): Promise<void> {
    this.booting = this.boot();
    try {
      await this.booting;
    } catch (err) {
      await this.close();   // nothing may stay open when the call falls back
      throw err;
    }
  }

  /** A close() that lands during an await stops the start there: what exists by then close() has
   *  released, and nothing more is created. Such a start resolves: a stopped call is not a failed one. */
  private async boot(): Promise<void> {
    const p = this.parts;
    const apiKey = p.apiKey ?? await this.resolveApiKey();
    if (this.closed) return;
    this.settings = p.settings ?? await loadConsecutiveSettings();
    if (this.closed) return;
    const s = this.settings;
    if (p.client) {
      this.client = p.client;
    } else {
      this.agent = httpAgent();
      this.client = new OpenAI({ apiKey, httpAgent: this.agent }) as unknown as OpenAILike;
    }
    this.floor = new FloorManager({
      langA: this.myLang, langB: this.targetLang,
      endSilenceS: s.endSilenceMs / 1000, hardEndS: s.hardEndMs / 1000,
      threshold: s.semanticThreshold, bargeInWords: s.bargeInWords,
      silentLangs: this.silentLangs(),
    }, this.clock);
    this.out = p.out ?? new TwilioOut(this.opts.socket, this.opts.streamSid);
    this.player = new Playback(this.out, { onFinished: u => this.onFinished(u), onFrame: f => this.echo.ours(f) });
    this.judge = p.judge ?? new Judge(this.client, { languages: [getLangName(this.myLang), getLangName(this.targetLang)] });
    // While paused, text still arriving for audio sent before the pause must not start new replies.
    const onDelta = (_item: string, text: string) => { if (!this.paused && !this.closed) this.apply(this.floor.text(text)); };
    this.transcriber = p.transcriberFactory ? p.transcriberFactory(onDelta) : new TranscribeLeg({
      languages: [this.myLang, this.targetLang], apiKey, format: this.transcribeFormat, onDelta,
    });
    const callbacks: EngineCallbacks = {
      onAudio: (u, pcm) => this.onAudio(u, pcm), onText: (u, t) => this.onText(u, t), onDone: u => this.onDone(u),
    };
    this.engineImpl = p.engineFactory ? p.engineFactory(callbacks) : new CascadeEngine({
      client: this.client, langA: this.myLang, langB: this.targetLang, model: s.model, voice: this.voice,
      tone: this.tone, personalContext: this.personalContext, ...callbacks,
    });
    this.engineImpl.setSilentLangs?.(this.silentLangs());   // one place for the real engine and the fakes
    // The detector is a condition of work: without it pauses cannot be counted, and the
    // cascade is a better call than a translation that plays over the speaker. It loads while
    // the transcription session comes up; a failure of either closes both (start()).
    const [model, up] = await Promise.all([
      p.vadModel === undefined ? loadSilero() : Promise.resolve(p.vadModel),
      this.transcriber.start(),
    ]);
    if (this.closed) return;   // close() has shut the transcriber (its start then says false) and the engine
    if (!up) throw new Error('transcriber did not start');
    const engineUp = await this.engineImpl.start();
    if (this.closed) return;
    if (!engineUp) throw new Error('engine did not start');
    if (model) {
      this.vad = new VadStream(model, ev => this.onVad(ev), undefined, err => this.onVadDead(err));
      this.fedByVad = true;
    }
    this.player.run().catch(err => log.warn({ callId: this.callId, err: errorName(err) }, 'Consecutive playback stopped'));
    this.ticker = setInterval(() => this.tick(), TICK_MS);
    await this.openSession();
    if (this.closed) return;   // close() stopped the ticker, detector and playback; finalize() waits for us for the session row
    this.startTimers();
    this.spawn(this.warmUp());
    if (this.greetingText && !this.carryover) this.scheduleGreeting();
    log.info({ callId: this.callId, langs: [this.myLang, this.targetLang], model: s.model, voice: this.voice, vad: !!model },
      'Consecutive translator started');
  }

  private async resolveApiKey(): Promise<string> {
    const { resolveCredentials } = await import('../credential-resolver.service.js');
    return (await resolveCredentials<{ api_key: string }>(this.workspaceId, 'openai')).api_key;
  }

  /** Connections for the first reply open while the greeting plays; a failure costs nothing but the warm-up. */
  private async warmUp(): Promise<void> {
    if (this.closed) return;
    const retrieve = this.client.models?.retrieve;
    if (!retrieve) return;
    await Promise.allSettled(Array.from({ length: WARM_CONNECTIONS }, () => this.client.models!.retrieve(TTS_MODEL)));
  }

  private async openSession(): Promise<void> {
    if (this.carryover) {
      this.sessionId = this.carryover.sessionId;
      this.startTime = this.carryover.startTime;
      this.transcript = this.carryover.transcript.slice() as Turn[];
      return;
    }
    if (!this.persist) return;
    const { db } = await import('../../config/db.js');
    const { translatorSessions } = await import('../../db/schema.js');
    const [session] = await db.insert(translatorSessions).values({
      subscriber_id: null as any, call_id: this.callId, workspace_id: this.workspaceId,
    }).returning();
    this.sessionId = session.id;
  }

  private startTimers(): void {
    if (this.closed) return;
    this.safetyTimer = setTimeout(() => {
      log.warn({ callId: this.callId }, 'Consecutive translator safety timer fired');
      this.finalize().catch(() => {});
    }, SAFETY_TIMEOUT_MS);
    if (this.persist) {
      this.statsTimer = setInterval(() => {
        try {   // what a timer throws is uncaught: it would take the whole process down
          const secs = Math.floor((Date.now() - this.startTime) / 1000);
          const c = this.costParts();
          getIo()?.to(`call:${this.callId}`).emit('translator:stats', {
            call_id: this.callId, duration_seconds: secs, cost_usd: c.stt + c.text + c.judge + c.tts,
          });
        } catch (err) {
          log.warn({ callId: this.callId, err: errorName(err) }, 'Consecutive stats failed');
        }
      }, STATS_EVERY_MS);
    }
    this.resetIdleTimer();
  }

  /** The core's clock. What a timer throws is uncaught and would take the whole process down, every call with it. */
  private tick(): void {
    try {
      this.apply(this.floor.tick());
    } catch (err) {
      this.tickFailures += 1;
      if (this.tickFailures <= 3 || this.tickFailures % 100 === 0) {   // 20 ticks a second: no flood
        log.warn({ callId: this.callId, failures: this.tickFailures, err: errorName(err) }, 'Consecutive tick failed');
      }
    }
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (!this.persist || this.closed) return;
    this.idleTimer = setTimeout(() => this.hangupOnIdle().catch(() => {}), IDLE_TIMEOUT_MS);
  }

  private async hangupOnIdle(): Promise<void> {
    if (this.saved) return;
    log.info({ callId: this.callId }, 'Consecutive translator idle timeout — hanging up');
    try {
      // By the call id alone, as StealthTranslator: workspaceId is the subscriber's, and a call on a
      // shared platform number belongs to the number's workspace — getCall(workspaceId) misses it.
      const { db } = await import('../../config/db.js');
      const { calls } = await import('../../db/schema.js');
      const { eq } = await import('drizzle-orm');
      const [row] = await db.select({ sid: calls.twilio_call_sid }).from(calls).where(eq(calls.id, this.callId)).limit(1);
      if (row?.sid) {
        const telephony = await import('../telephony.service.js');
        await telephony.hangupCall(this.workspaceId, row.sid);
      }
    } catch (err) {
      log.warn({ callId: this.callId, err: errorName(err) }, 'Idle hangup failed');
    }
    await this.finalize();
  }

  // ------------------------------------------------------------------ the line

  /** µ-law 8 kHz from Twilio, 20 ms per frame. */
  sendAudio(mulaw: Buffer): void {
    if (this.paused || this.closed || !this.floor) return;
    const pcm = mulawToPcm(mulaw);
    this.echo.line(pcm);
    if (this.echo.present !== null) this.floor.setEcho(this.echo.present);
    if (this.vad?.alive) this.vad.push(pcm);
    if (!this.fedByVad) this.transcriber.push(this.forTranscriber(pcm));
  }

  private forTranscriber(pcm8k: Buffer): Buffer {
    return this.transcribeFormat === 'pcmu' ? pcmToMulaw(pcm8k) : this.up3.push(pcm8k);
  }

  private onVad(ev: VadEvent): void {
    if (this.closed || this.paused) return;   // windows queued before a pause are not transcribed either
    if (ev.type === 'inference') {
      // The transcriber hears the line through the detector, in the frames it already judged:
      // the end of its buffer is always where speech/silence is known, so a segment closes in
      // silence. Fed directly, commit overtook the detector and cut a word in half ("Я п" +
      // "He puttle"). Costs one detector window (32 ms) of text latency.
      this.transcriber.push(this.forTranscriber(ev.frame));
      const due = this.commitDue;
      if (due === null) return;
      const quiet = ev.rawAccumulatedSilence >= COMMIT_QUIET_S && ev.probability < COMMIT_QUIET_PROB;
      if (quiet || this.clock() - due >= COMMIT_FORCE_S) {
        this.commitDue = null;
        this.transcriber.commit();
      }
    } else if (ev.type === 'start') {
      this.apply(this.floor.vadStart());
    } else {
      this.apply(this.floor.vadEnd(ev.silenceS));
    }
  }

  private onVadDead(err: unknown): void {
    log.warn({ callId: this.callId, err: errorName(err) }, 'Consecutive: voice detector stopped');
    // No detector any more: the line goes to the transcriber directly, a pending commit now.
    this.fedByVad = false;
    if (this.commitDue !== null) {
      this.commitDue = null;
      this.transcriber.commit();
    }
  }

  // ------------------------------------------------------------------ core commands

  private apply(cmds: Command[]): void {
    for (const cmd of cmds) {
      try {
        this.do(cmd);
      } catch (err) {   // one broken command must not take the call down
        log.warn({ callId: this.callId, cmd: cmd.kind, err: errorName(err) }, 'Consecutive command failed');
      }
    }
  }

  private do(cmd: Command): void {
    const u = 'utt' in cmd ? this.floor.utterances.get(cmd.utt) : undefined;
    switch (cmd.kind) {
      case 'opened':
        this.engineImpl.opened(cmd.utt, cmd.lang, cmd.candidate);
        break;
      case 'updated':
        if (u && (u.state === 'open' || u.state === 'released' || u.state === 'playing')) {
          this.engineImpl.updated(cmd.utt, u.text);
          this.emitInterim(u.id, u.text);
        }
        break;
      case 'judge':
        this.spawn(this.askJudge(cmd.utt, cmd.text));
        break;
      case 'intent':
        this.spawn(this.askIntent(cmd.utt, cmd.text, cmd.playing));
        break;
      case 'release':
        this.engineImpl.released(cmd.utt, u ? u.text : '');
        break;
      case 'prepare':
        if (u && u.state === 'open') this.engineImpl.prepare(cmd.utt, u.text);
        break;
      case 'reopened':
        // the speaker went on before this reply played: the engine's "done" no longer stands
        this.engineImpl.reopened(cmd.utt);
        this.player.undone(cmd.utt);
        this.engineDone.delete(cmd.utt);
        break;
      case 'play':
        this.player.play(cmd.utt);
        break;
      case 'restart':
        // went on in the first seconds of our translation: old audio and text go, the engine
        // translates the whole thought again; new audio tells the core "has audio" again
        this.player.restart(cmd.utt);
        this.hasAudio.delete(cmd.utt);
        this.translations.delete(cmd.utt);
        this.down.delete(cmd.utt);
        this.engineDone.delete(cmd.utt);
        this.engineImpl.restart(cmd.utt);
        break;
      case 'pause':
        this.player.pause(cmd.utt);
        break;
      case 'stop':
        this.player.stop(cmd.utt);
        this.engineImpl.stopped(cmd.utt);
        this.logTurn(cmd.utt, true);
        break;
      case 'drop':
        this.player.discard(cmd.utt);
        if (u && !u.greeting) {
          this.engineImpl.dropped(cmd.utt);
          if (cmd.reason === 'no translation') this.logTurn(cmd.utt, false);
          else if (cmd.reason === 'backchannel' || cmd.reason === 'ack' || cmd.reason === 'stale') this.logSkipped(cmd.utt, cmd.reason);
        }
        break;
      case 'commit':
        if (!this.fedByVad) this.transcriber.commit();
        else if (this.commitDue === null) this.commitDue = this.clock();   // onVad closes it in the next silence
        break;
    }
  }

  // The floor must always hear back, a failure as null ("no answer"): a question left open
  // keeps its text in `judging` and is never asked again.
  private async askJudge(utt: number, text: string): Promise<void> {
    let verdict: [boolean, number] | null = null;
    try {
      verdict = await this.judge.semanticEnd(text);
    } catch (err) {
      log.warn({ callId: this.callId, err: errorName(err) }, 'Consecutive judge failed');
    }
    if (!this.closed) this.apply(this.floor.judged(utt, text, verdict));
  }

  private async askIntent(utt: number, text: string, playing: string): Promise<void> {
    let verdict: [IntentLabel, number] | null = null;
    try {
      verdict = await this.judge.intent(text, playing);
    } catch (err) {
      log.warn({ callId: this.callId, err: errorName(err) }, 'Consecutive intent judge failed');
    }
    if (!this.closed) this.apply(this.floor.intent(utt, verdict));
  }

  private spawn(task: Promise<unknown>): void {
    const tracked = task.catch(err => log.warn({ callId: this.callId, err: errorName(err) }, 'Consecutive task failed'));
    this.side.add(tracked);
    void tracked.finally(() => this.side.delete(tracked));
  }

  // ------------------------------------------------------------------ engine and playback events

  private onAudio(utt: number, pcm24: Buffer): void {
    let d = this.down.get(utt);
    if (!d) {
      d = new Downsampler3();
      this.down.set(utt, d);
    }
    const pcm = d.push(pcm24);
    if (pcm.length) this.player.append(utt, pcm);
    if (!this.hasAudio.has(utt)) {
      this.hasAudio.add(utt);
      this.apply(this.floor.audio(utt));
    }
  }

  private onText(utt: number, text: string): void {
    this.floor.translation(utt, text);
    this.translations.set(utt, (this.translations.get(utt) ?? '') + text);
  }

  private onDone(utt: number): void {
    if (this.closed) return;
    this.engineDone.add(utt);
    const u = this.floor.utterances.get(utt);
    // One-way mode: the other side is shown as text only — done once translated. Checked before
    // the audio: a reply voiced before a switch to one-way would wait for a playback that never comes.
    if (u && u.state === 'released' && u.lang !== null && this.silentLangs().has(u.lang)) {
      this.settleText(utt);
      return;
    }
    if (this.hasAudio.has(utt)) {
      this.player.done(utt);
      return;
    }
    if (!u || u.state !== 'released') return;
    // the engine finished with nothing to say: holding the head of the queue for it only
    // makes everything behind it wait ten seconds
    this.apply(this.floor.discard(utt, 'no translation'));
  }

  /** A translated reply of a side that is not voiced: it is over. Audio voiced for it before a switch to one-way goes. */
  private settleText(utt: number): void {
    this.player.discard(utt);
    this.apply(this.floor.textDone(utt));
    this.logTurn(utt, false);
    this.resetIdleTimer();   // a turn went through, as for a played one: the line is not idle
  }

  private onFinished(utt: number): void {
    this.apply(this.floor.finished(utt));
    this.logTurn(utt, false);
    this.resetIdleTimer();
  }

  // ------------------------------------------------------------------ transcript and Socket.IO

  /** One entry per reply, written when its translation is over (played, cut off, or text-only
   *  and ready): until then the speaker could still extend it — merge, restart. */
  private logTurn(utt: number, interrupted: boolean): void {
    const u = this.floor?.utterances.get(utt);
    if (!u || u.greeting || this.logged.has(utt) || !u.text) return;
    this.logged.add(utt);
    const translated = (this.translations.get(utt) ?? '').trim();
    const lang = u.lang ?? this.myLang;
    const speaker = lang === this.myLang ? 'subscriber' : 'other';
    const turn: Turn = { speaker, text: u.text, lang, translated, timestamp: new Date().toISOString() };
    if (!translated) turn.untranslated = true;
    if (interrupted) turn.interrupted = true;
    this.transcript.push(turn);
    this.emitTurn(speaker, u.text, translated, lang);
    // after a pause the latency counts from the resumed playback, as floor.latenciesMs does
    const sound = u.resumedAt || u.playAt;
    const latencyMs = sound && u.ended !== null ? Math.trunc((sound - u.ended) * 1000) : null;
    log.info({
      callId: this.callId, metric: 'consecutive_turn', utt, speaker, lang, release: u.releaseReason,
      latency_ms: latencyMs, interrupted, input_chars: u.text.length, output_chars: translated.length,
    }, 'consecutive_turn');
  }

  /** Said but not translated ("uh-huh", a stale reply, words right before hang-up): kept in the record, not shown. */
  private logSkipped(utt: number, reason: string): void {
    const u = this.floor?.utterances.get(utt);
    if (!u || u.greeting || this.logged.has(utt) || !u.text) return;
    this.logged.add(utt);
    const lang = u.lang ?? this.myLang;
    this.transcript.push({
      speaker: lang === this.myLang ? 'subscriber' : 'other', text: u.text, lang, translated: '',
      timestamp: new Date().toISOString(), skipped: reason,
    });
  }

  /** Field for field what StealthTranslator.emitTurn sends: /translate must not tell engines apart. */
  private emitTurn(speaker: string, original: string, translated: string, detectedLang: string): void {
    if (!this.persist) return;
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

  private emitInterim(utt: number, text: string): void {
    if (!this.persist || !text) return;
    const now = this.clock();
    if (now - (this.interimAt.get(utt) ?? -Infinity) < INTERIM_EVERY_S) return;
    this.interimAt.set(utt, now);
    getIo()?.to(`call:${this.callId}`).emit('call:transcript', {
      call_id: this.callId, text, isFinal: false, timestamp: new Date().toISOString(),
    });
  }

  /** Translation text of a reply so far — the smoke scene reports it. */
  translationOf(utt: number): string {
    return this.translations.get(utt) ?? '';
  }

  // ------------------------------------------------------------------ greeting

  /** Synthesised now, in the voice of the translations; queued at the head of the core after
   *  the configured delay and played in the first quiet (at most 6 s later). It translates
   *  nothing, so it never becomes a transcript turn. */
  private scheduleGreeting(): void {
    if (this.closed) return;   // nothing synthesised, nothing billed
    const text = this.greetingText;
    const audio = (this.engineImpl.synthesize ? this.engineImpl.synthesize(text) : Promise.resolve(Buffer.alloc(0)))
      .catch(() => Buffer.alloc(0));
    this.greetingTimer = setTimeout(() => {
      this.greetingTimer = undefined;
      this.spawn(this.queueGreeting(text, audio));
    }, this.greetingDelaySeconds * 1000);
  }

  private async queueGreeting(text: string, audio: Promise<Buffer>): Promise<void> {
    if (this.closed || this.paused) return;
    const [gid, cmds] = this.floor.greeting(text);
    this.apply(cmds);
    const pcm24 = await audio;
    if (this.closed) return;
    if (this.paused || !pcm24.length) {
      this.apply(this.floor.discard(gid, 'no audio'));
      return;
    }
    this.player.append(gid, new Downsampler3().push(pcm24));
    this.player.done(gid);
    this.apply(this.floor.audio(gid));
  }

  // ------------------------------------------------------------------ controls

  updateLanguages(myLang: string, targetLang: string): void {
    if (!isCrossScriptPair(myLang, targetLang)) {
      // media-stream swaps to the cascade for such a pair before it gets here
      log.warn({ callId: this.callId, myLang, targetLang }, 'Consecutive translator refused a same-script pair');
      return;
    }
    this.myLang = myLang;
    this.targetLang = targetLang;
    this.floor.setLanguages(myLang, targetLang);
    this.floor.setSilentLangs(this.silentLangs());
    this.engineImpl.setLanguages?.(myLang, targetLang);
    this.engineImpl.setSilentLangs?.(this.silentLangs());
    this.transcriber.setLanguages?.([myLang, targetLang]);
    this.judge.setLanguages?.([getLangName(myLang), getLangName(targetLang)]);
    log.info({ callId: this.callId, myLang, targetLang }, 'Consecutive translator languages updated');
  }

  updateVoice(voice: string): void {
    this.voice = resolveVoice(voice);
    this.engineImpl.setVoice?.(this.voice);
    log.info({ callId: this.callId, voice: this.voice }, 'Consecutive translator voice updated');
  }

  updateTone(tone: string): void {
    this.tone = tone;
    this.engineImpl.setTone?.(tone);
    log.info({ callId: this.callId, tone }, 'Consecutive translator tone updated');
  }

  updateMode(mode: string): void {
    this.oneWay = mode === 'text' || mode === 'unidirectional';
    const silent = this.silentLangs();
    this.floor.setSilentLangs(silent);
    this.engineImpl.setSilentLangs?.(silent);
    // A reply of the side that just went silent, translated and waiting for its turn to sound, never gets
    // one now: it is over as text. One still being translated is settled when the engine is done (onDone).
    for (const u of [...this.floor.utterances.values()]) {
      if (u.state === 'released' && u.lang !== null && silent.has(u.lang) && this.engineDone.has(u.id)) this.settleText(u.id);
    }
    log.info({ callId: this.callId, mode, oneWay: this.oneWay }, 'Consecutive translator mode updated');
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    if (this.floor) this.apply(this.floor.pauseAll('paused'));
    log.info({ callId: this.callId }, 'Consecutive translator paused');
  }

  resume(): void {
    this.paused = false;
    log.info({ callId: this.callId }, 'Consecutive translator resumed');
  }

  isPaused(): boolean {
    return this.paused;
  }

  private silentLangs(): Set<string> {
    return this.oneWay ? new Set([this.targetLang]) : new Set();
  }

  // ------------------------------------------------------------------ summary and cost

  private costParts(): { stt: number; text: number; judge: number; tts: number } {
    const e = this.engineImpl?.costs() ?? { text: 0, tts: 0 };
    return {
      stt: calculateSTTCost(STT_PRICE_KEY, (this.transcriber?.audioSeconds ?? 0) / 60),
      text: e.text,
      judge: this.judge ? calculateLLMCost(JUDGE_MODEL, this.judge.usage.in, this.judge.usage.out) : 0,
      tts: e.tts,
    };
  }

  summary(): Record<string, any> {
    const f = this.floor;
    const spoken = [...f.utterances.values()].filter(u => !u.greeting);
    const latencies = f.latenciesMs();
    const releases = spoken.filter(u => u.releasedAt !== null && u.ended !== null)
      .map(u => Math.trunc((u.releasedAt! - u.ended!) * 1000));
    const c = this.costParts();
    const s = this.settings;
    return {
      engine: 'consecutive',
      languages: [this.myLang, this.targetLang],
      model: s.model,
      voice: this.voice,
      settings: { end_silence_ms: s.endSilenceMs, hard_end_ms: s.hardEndMs, threshold: s.semanticThreshold, barge_in_words: s.bargeInWords },
      utterances: spoken.length,
      counts: { ...f.counts },
      latency_ms: { p50: percentile(latencies, 50), p90: percentile(latencies, 90), n: latencies.length },
      release_ms: { p50: percentile(releases, 50), p90: percentile(releases, 90) },
      judge_ms: { p50: percentile(f.judgeMs, 50), p90: percentile(f.judgeMs, 90), n: f.judgeMs.length },
      barge_ms: f.bargeMs.map(([first]) => first),
      played_s: this.player?.playedSeconds ?? 0,
      echo: { present: f.echo, correlation: this.echo.correlation, return_db: this.echo.returnDb },
      engine_usage: { ...(this.engineImpl?.usage ?? {}) },
      events: f.events.map(e => [...e]),
      costs: { transcribe: round6(c.stt), text: round6(c.text), judge: round6(c.judge), tts: round6(c.tts) },
      cost_usd: round6(c.stt + c.text + c.judge + c.tts),
    };
  }

  // ------------------------------------------------------------------ teardown

  stop(): void {
    this.finalize().catch(err => log.error({ callId: this.callId, err: errorName(err) }, 'Consecutive finalize failed'));
  }

  /** The call's metrics for its record, or null: a failure in these diagnostics must never block closing or billing. */
  private metricsOrNull(): Record<string, any> | null {
    if (!this.floor) return null;
    try {
      return this.summary();
    } catch (err) {
      log.warn({ callId: this.callId, err: errorName(err) }, 'Consecutive metrics failed');
      return null;
    }
  }

  /** Mid-call engine swap: hand the session on without finalizing it. */
  detach(): TranslatorCarryover {
    this.saved = true;   // the next engine finalizes the session
    const metrics = this.metricsOrNull();
    void this.close();   // its synchronous part logs a translation cut off by the swap
    if (this.persist && this.sessionId && metrics) void this.writeMetrics(metrics);
    return { sessionId: this.sessionId, startTime: this.startTime, transcript: this.transcript.slice() };
  }

  private async close(): Promise<void> {
    if (this.shutdown()) await this.closeSockets();
  }

  /**
   * What must not be lost first, sockets last: closing them can eat the whole budget (aidispatch). This
   * synchronous part stops the timers and the sound, logs the turns the call leaves unfinished, and sets
   * the sockets closing; finalize() does its accounting before it waits for them. False: it ran already.
   */
  private shutdown(): boolean {
    if (this.closed) return false;
    this.closed = true;
    for (const t of [this.ticker, this.statsTimer]) if (t) clearInterval(t);
    for (const t of [this.idleTimer, this.safetyTimer, this.greetingTimer]) if (t) clearTimeout(t);
    if (this.floor) {
      for (const u of this.floor.utterances.values()) {
        if (u.state === 'playing') this.logTurn(u.id, true);   // the call ended mid-translation
        // said right before the hang-up, still waiting for silence or speech: nobody is left
        // to hear the translation, but the record keeps it
        else if (u.state === 'open' || u.state === 'released' || u.state === 'candidate') this.logSkipped(u.id, 'call_ended');
      }
    }
    this.vad?.close();
    this.player?.close();
    try {
      this.out?.clear();   // a swapped-out engine falls silent at once, not after the audio queued at Twilio
    } catch {
      // the line is gone anyway
    }
    // a transcription socket still coming up is cut short too: a start waiting for it goes on at once
    this.closing = Promise.allSettled([this.transcriber?.aclose(), this.engineImpl?.aclose()]);
    return true;
  }

  /** The sockets: at most CLOSE_TIMEOUT_MS, then this call's connections to OpenAI go. */
  private async closeSockets(): Promise<void> {
    let budget: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      this.closing,
      // unref'd: the budget must not keep a finished process (the smoke scene) alive
      new Promise<void>(resolve => { budget = setTimeout(resolve, CLOSE_TIMEOUT_MS).unref(); }),
    ]);
    clearTimeout(budget);
    this.agent?.destroy();
  }

  /** Turns and accounting first, sockets last: on shutdown the database may be gone after a second or two. */
  async finalize(): Promise<void> {
    if (this.saved) return;
    this.saved = true;
    const first = this.shutdown();
    try {
      // a start this cut short stops at its next await; the session row it may have created is closed too
      await this.booting?.catch(() => {});
      await this.account();
    } finally {
      if (first) await this.closeSockets();
    }
  }

  /** The session row, the call's billing and the settled log line. */
  private async account(): Promise<void> {
    const durationSecs = Math.floor((Date.now() - this.startTime) / 1000);
    const durationMins = durationSecs / 60;
    const minutesUsed = Math.ceil(durationMins * 100) / 100;
    const c = this.costParts();
    const costTelephony = calculateTelephonyCost('twilio', durationMins);
    const costTotal = c.stt + c.text + c.judge + c.tts + costTelephony;
    const metrics = this.metricsOrNull();

    if (this.persist) {
      if (this.sessionId) {
        try {
          const { db } = await import('../../config/db.js');
          const { translatorSessions } = await import('../../db/schema.js');
          const { eq } = await import('drizzle-orm');
          await db.update(translatorSessions).set({
            duration_seconds: durationSecs,
            minutes_used: String(minutesUsed),
            cost_usd: String(costTotal),
            transcript: this.transcript as any,
            status: 'completed',
            metrics: metrics as any,
          }).where(eq(translatorSessions.id, this.sessionId));
        } catch (err) {
          log.error({ callId: this.callId, err: errorName(err) }, 'Failed to update consecutive translator session');
        }
      }
      const callService = await import('../call.service.js');
      const aiSession = await callService.getAiSession(this.callId);
      if (aiSession) {
        const { finalizeSession } = await import('../session-finalizer.service.js');
        await finalizeSession({
          callId: this.callId,
          workspaceId: this.workspaceId,
          sessionId: aiSession.id,
          transcript: this.transcript,
          costs: {
            stt: c.stt, llm: c.text + c.judge, tts: c.tts, telephony: costTelephony,
            sttProvider: 'openai', llmProvider: 'openai', ttsProvider: 'openai',
          },
          durationSecs,
        });
      }
    }

    log.info({
      callId: this.callId, metric: 'consecutive_settled', durationSecs, minutesUsed, costTotal,
      turns: this.transcript.length, utterances: metrics?.utterances, latency_ms: metrics?.latency_ms,
      counts: metrics?.counts, echo: metrics?.echo,
    }, 'Consecutive translator finalized');
  }

  private async writeMetrics(metrics: Record<string, any>): Promise<void> {
    try {
      const { db } = await import('../../config/db.js');
      const { translatorSessions } = await import('../../db/schema.js');
      const { eq } = await import('drizzle-orm');
      await db.update(translatorSessions).set({ metrics: metrics as any }).where(eq(translatorSessions.id, this.sessionId!));
    } catch (err) {
      log.warn({ callId: this.callId, err: errorName(err) }, 'Consecutive metrics not written on swap');
    }
  }
}
