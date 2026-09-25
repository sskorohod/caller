/**
 * Playing the translation: one utterance at a time, a short queue downstream, a quick stop.
 *
 * An utterance's audio collects here from the first seconds of its speech (the engine voices
 * finished sentences ahead), but plays only when the turn-taking core says so. Downstream
 * (TwilioOut) gets no more than 400 ms ahead of real time: everything else stays here,
 * otherwise an interruption would take seconds to fall silent.
 *
 * Port of aidispatch agent/consecutive/playback.py at 9e4b1eb; frames are 20 ms of PCM16 at
 * 8 kHz (320 bytes) instead of 24 kHz.
 */
import pino from 'pino';
import { FRAME_BYTES, meanAbs, SILENCE_LEVEL } from './audio.js';

const log = pino({ name: 'consecutive' });

export const FRAME_S = 0.02;
export const GAP_FRAMES = 12;           // 0.24 s of silence in our audio ends a phrase: after a pause we resume from its start
export const LEAD_FRAMES = 5;           // 0.1 s of silence is kept before a phrase, so the sound does not start abruptly
export const PHRASE_MAX_FRAMES = 500;   // 10 s: no phrase runs longer without a pause, no point repeating more

const EMPTY = Buffer.alloc(0);

export interface PlaybackOut { write(frame: Buffer): Promise<void>; clear(): void }

export class Playback {
  playedSeconds = 0;
  private readonly onFinished: (utt: number) => void;
  private readonly onFrame: (frame: Buffer) => void;
  private readonly buffers = new Map<number, Buffer>();
  private readonly doneUtts = new Set<number>();
  private readonly gone = new Set<number>();   // discarded and interrupted: their audio is no longer accepted
  private current: number | null = null;
  private generation = 0;
  private wakeUp: (() => void) | null = null;
  private closed = false;
  private failures = 0;
  // The utterance's current phrase: played since the last pause, with what went downstream but may not have been heard.
  private phrase: Buffer[] = [];
  private phraseUtt: number | null = null;
  private quietFrames = 0;

  constructor(
    private readonly out: PlaybackOut,
    opts: { onFinished: (utt: number) => void; onFrame?: (frame: Buffer) => void },
  ) {
    this.onFinished = opts.onFinished;
    this.onFrame = opts.onFrame ?? (() => {});
  }

  // --- core commands and engine audio ----------------------------------------------------------------
  append(utt: number, pcm: Buffer): void {
    if (this.gone.has(utt) || !pcm.length) return;
    const buffer = this.buffers.get(utt);
    this.buffers.set(utt, Buffer.concat(buffer ? [buffer, pcm] : [pcm]));
    this.wake();
  }

  /** The engine has said everything: once the rest has played, the utterance is finished. */
  done(utt: number): void {
    if (!this.gone.has(utt)) {
      this.doneUtts.add(utt);
      this.wake();
    }
  }

  play(utt: number): void {
    if (!this.gone.has(utt)) {
      this.current = utt;
      this.generation += 1;
      this.wake();
    }
  }

  /** Interrupted: throw the rest away, clear the queue downstream. */
  stop(utt: number): void {
    this.gone.add(utt);
    this.buffers.delete(utt);
    this.doneUtts.delete(utt);
    if (this.current === utt) {
      this.current = null;
      this.generation += 1;
      this.safeClear();
    }
  }

  /** A discarded utterance is the same as a stopped one, only it usually has not played yet. */
  discard(utt: number): void {
    this.stop(utt);
  }

  /**
   * The speaker went on over the translation of their own words: pause the translation, and later
   * play on from the start of the interrupted phrase. Going on from the middle of a word leaves the
   * listener with a fragment (calls of 24.09), and repeating the phrase also brings back what went
   * downstream but may not have been heard.
   */
  pause(utt: number): void {
    if (this.current !== utt) return;
    this.current = null;
    this.generation += 1;
    this.safeClear();
    if (this.phraseUtt === utt && this.phrase.length) {
      this.buffers.set(utt, Buffer.concat([...this.phrase, this.buffers.get(utt) ?? EMPTY]));
    }
    this.phrase = [];
    this.quietFrames = 0;
  }

  /** The utterance's translation starts over: drop its audio and clear downstream, but keep accepting new audio for it. */
  restart(utt: number): void {
    this.buffers.delete(utt);
    this.doneUtts.delete(utt);
    if (this.current === utt) {
      this.current = null;
      this.generation += 1;
      this.safeClear();
    }
    if (this.phraseUtt === utt) {
      this.phrase = [];
      this.quietFrames = 0;
    }
  }

  /** The utterance went on after the engine's "done": wait for a new "done" from it. */
  undone(utt: number): void {
    this.doneUtts.delete(utt);
  }

  // --- the loop ----------------------------------------------------------------------------------------
  /** Plays until close(). */
  async run(): Promise<void> {
    while (!this.closed) {
      const utt = this.current;
      const buffer = utt === null ? EMPTY : this.buffers.get(utt) ?? EMPTY;
      const finished = utt !== null && this.doneUtts.has(utt);
      if (utt === null || (!buffer.length && !finished) || (buffer.length > 0 && buffer.length < FRAME_BYTES && !finished)) {
        await this.sleep();   // nothing to play: the utterance is not released or the engine has not caught up
        continue;
      }
      if (!buffer.length) {
        this.current = null;
        this.buffers.delete(utt);
        this.doneUtts.delete(utt);
        this.notify(utt);
        continue;
      }
      const chunk = Buffer.alloc(FRAME_BYTES);   // zero-filled: a short last frame is padded with silence
      buffer.copy(chunk, 0, 0, FRAME_BYTES);
      this.buffers.set(utt, buffer.subarray(FRAME_BYTES));
      this.remember(utt, chunk);   // before sending: a frame in flight at a pause must come back too
      const generation = this.generation;
      try {
        await this.out.write(chunk);   // waits while more than 400 ms is queued downstream: that is the pace
      } catch (err) {
        if (this.closed) return;
        // One lost frame is better than a translator gone silent.
        this.failures += 1;
        if (this.failures <= 3 || this.failures % 100 === 0) {
          log.warn({ failures: this.failures, err: (err as Error)?.name }, 'playback frame failed');
        }
        continue;
      }
      if (this.closed) return;
      if (generation !== this.generation) {
        this.safeClear();   // the frame was already in flight when we were interrupted: it landed after the clear
        continue;
      }
      // Rounded to ms as in aidispatch; steps are whole 20 ms, so there is never a tie for half-even rounding.
      this.playedSeconds = Math.round((this.playedSeconds + FRAME_S) * 1000) / 1000;
      try {
        this.onFrame(chunk);
      } catch {
        // the recording must not stop the playback
      }
    }
  }

  /** Ends run(); aidispatch cancelled the task instead. */
  close(): void {
    this.closed = true;
    this.wake();
  }

  /** Keep the current phrase: after a pause in our audio a new one begins, and the old one can be forgotten. */
  private remember(utt: number, chunk: Buffer): void {
    if (this.phraseUtt !== utt) {
      this.phrase = [];
      this.phraseUtt = utt;
      this.quietFrames = 0;
    }
    if (voiced(chunk)) {
      if (this.quietFrames >= GAP_FRAMES) this.phrase = this.phrase.slice(-LEAD_FRAMES);
      this.quietFrames = 0;
    } else {
      this.quietFrames += 1;
    }
    this.phrase.push(chunk);
    if (this.phrase.length > PHRASE_MAX_FRAMES) this.phrase.shift();
  }

  private notify(utt: number): void {
    try {
      this.onFinished(utt);
    } catch (err) {
      log.warn({ err: (err as Error)?.name }, 'playback finish callback failed');
    }
  }

  private safeClear(): void {
    try {
      this.out.clear();
    } catch {
      // a failing clear must not break a stop
    }
  }

  // asyncio.Event as the loop uses it: wake() is set(), sleep() is clear() + wait(). A wake() while the
  // loop is busy is dropped, as in aidispatch: the loop re-reads the state before it sleeps again.
  private wake(): void {
    const wakeUp = this.wakeUp;
    this.wakeUp = null;
    wakeUp?.();
  }

  private sleep(): Promise<void> {
    return new Promise(resolve => { this.wakeUp = resolve; });
  }
}

/** Speech or silence in a frame: mean |sample| above SILENCE_LEVEL, aidispatch's measure. */
function voiced(chunk: Buffer): boolean {
  return meanAbs(chunk) > SILENCE_LEVEL;
}
