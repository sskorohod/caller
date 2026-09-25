/**
 * Voice activity on the line: Silero VAD v5, run the way aidispatch runs it.
 *
 * aidispatch uses livekit.agents.inference.VAD — Silero at 16 kHz, 32 ms windows — with
 * activation 0.7, min speech 0.2 s, min silence 0.35 s and LiveKit's default
 * deactivation (activation − 0.15). The turn-taking core and the commit gating were tuned
 * against exactly that, so the events repeat LiveKit's: one `inference` per window,
 * emitted BEFORE the window updates the counters (raw accumulated silence is the value
 * before it), then `start` / `end` when a threshold is crossed.
 *
 * Model: snakers4/silero-vad v5 (MIT), assets/silero_vad_v5.onnx, 2 327 524 bytes,
 * sha256 2623a2953f6ff3d2c1e61740c6cdb7168133479b267dfef114a4a3cc5bdd788f.
 * Runtime: onnxruntime-web, WASM on one thread — no native code, so it runs on alpine.
 */
import { readFile } from 'node:fs/promises';
import pino from 'pino';
import * as ort from 'onnxruntime-web';
import { Upsampler2 } from './audio.js';

const log = pino({ name: 'consecutive' });

const MODEL_RATE = 16000;
const WINDOW = 512;                        // 32 ms at 16 kHz
const CONTEXT = 64;                        // v5 wants the previous 64 samples in front of each window
const WINDOW_S = WINDOW / MODEL_RATE;
const LINE_WINDOW_BYTES = (WINDOW / 2) * 2;   // the same 32 ms of the 8 kHz line: 256 samples of PCM16
export const MODEL_PATH = new URL('../../../assets/silero_vad_v5.onnx', import.meta.url);

export interface VadOptions { activation: number; deactivation: number; minSpeechS: number; minSilenceS: number }
export const DEFAULT_VAD: VadOptions = { activation: 0.7, deactivation: 0.55, minSpeechS: 0.2, minSilenceS: 0.35 };

export type VadEvent =
  | { type: 'inference'; probability: number; rawAccumulatedSilence: number; frame: Buffer }
  | { type: 'start' }
  | { type: 'end'; silenceS: number };

/** One forward pass: a 32 ms window at 16 kHz → probability of speech. */
export interface VadModel { predict(window: Float32Array): Promise<number> }

// One InferenceSession per resolved model path for the whole process. The WASM backend's
// linear memory never shrinks back to the OS once grown; a session per phone call leaked
// ~tens of MB each time (reviewer measured +256 MB RSS over 12 sessions against a 1 GB
// container cap). Keyed by path so a second, different path isn't served the first path's
// cached session; a failed create must not stick for the next call, so it's evicted below.
const sessions = new Map<string, Promise<ort.InferenceSession>>();

// The WASM backend executes on the event loop, one run at a time — it has no real
// concurrency to give two overlapping session.run() calls, and interleaving them against
// the same shared session risks one call's in-flight graph execution clobbering another's.
// Every run(), from every loadSilero() closure, across every call, funnels through this
// single module-level chain so they never overlap.
let runQueue: Promise<unknown> = Promise.resolve();

function runSerialized(
  session: ort.InferenceSession,
  feeds: ort.InferenceSession.FeedsType,
): Promise<ort.InferenceSession.ReturnType> {
  const result = runQueue.then(() => session.run(feeds));
  runQueue = result.then(() => undefined, () => undefined);   // keep the chain alive past a rejection
  return result;
}

export async function loadSilero(path: URL | string = MODEL_PATH): Promise<VadModel> {
  ort.env.wasm.numThreads = 1;
  const key = String(path);
  let sessionPromise = sessions.get(key);
  if (!sessionPromise) {
    sessionPromise = readFile(path)
      .then(b => new Uint8Array(b))
      .then(bytes => ort.InferenceSession.create(bytes));
    sessions.set(key, sessionPromise);
    sessionPromise.catch(() => sessions.delete(key));
  }
  const session = await sessionPromise;

  // Per-call recurrent state: each loadSilero() caller gets its own state/context over the
  // ONE shared session above, so concurrent calls never see each other's history.
  let state: ort.Tensor = new ort.Tensor('float32', new Float32Array(2 * 128), [2, 1, 128]);
  const sr = new ort.Tensor('int64', BigInt64Array.from([BigInt(MODEL_RATE)]), []);
  let context = new Float32Array(CONTEXT);
  return {
    async predict(window: Float32Array): Promise<number> {
      const input = new Float32Array(CONTEXT + WINDOW);
      input.set(context, 0);
      input.set(window, CONTEXT);
      const out = await runSerialized(session, { input: new ort.Tensor('float32', input, [1, CONTEXT + WINDOW]), state, sr });
      state = out.stateN as ort.Tensor;
      context = window.slice(WINDOW - CONTEXT);
      return (out.output.data as Float32Array)[0];
    },
  };
}

function concat(a: Float32Array, b: Float32Array): Float32Array<ArrayBuffer> {
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export class VadStream {
  alive = true;
  private readonly up = new Upsampler2();
  private pending16 = new Float32Array(0);
  private pending8 = Buffer.alloc(0);
  private oddByte: Buffer | null = null;   // a lone trailing byte, held until its other half arrives
  private queue: Promise<void> = Promise.resolve();
  private speaking = false;
  private speechS = 0;
  private silenceS = 0;
  private closed = false;

  constructor(
    private readonly model: VadModel,
    private readonly onEvent: (ev: VadEvent) => void,
    private readonly opts: VadOptions = DEFAULT_VAD,
    private readonly onError?: (err: unknown) => void,
  ) {}

  push(pcm8k: Buffer): void {
    if (!this.alive || this.closed) return;
    let buf = pcm8k;
    if (this.oddByte) {
      buf = Buffer.concat([this.oddByte, buf]);
      this.oddByte = null;
    }
    if (buf.length % 2) {
      this.oddByte = buf.subarray(buf.length - 1);   // keep it for the next push rather than let pending8/16 drift apart
      buf = buf.subarray(0, buf.length - 1);
    }
    // pending16 and pending8 must advance in lockstep: Upsampler2 turns each 8 kHz PCM16
    // sample (2 bytes) into 2 upsampled 16 kHz floats, so pending16.length (in floats) stays
    // numerically equal to pending8.length (in bytes) after every push, as long as what we
    // feed both of them below is always a whole number of 2-byte samples (hence the odd-byte
    // handling above) — that equality is what lets the loop below slice matching spans off
    // both buffers for the same window.
    this.pending8 = Buffer.concat([this.pending8, buf]);
    this.pending16 = concat(this.pending16, this.up.push(buf));
    while (this.pending16.length >= WINDOW && this.pending8.length >= LINE_WINDOW_BYTES) {
      const window = this.pending16.slice(0, WINDOW);
      const frame = Buffer.from(this.pending8.subarray(0, LINE_WINDOW_BYTES));
      this.pending16 = this.pending16.slice(WINDOW);
      this.pending8 = this.pending8.subarray(LINE_WINDOW_BYTES);
      this.queue = this.queue.then(() => this.run(window, frame));   // windows strictly in order
    }
  }

  close(): void {
    this.closed = true;
  }

  private async run(window: Float32Array, frame: Buffer): Promise<void> {
    if (!this.alive || this.closed) return;
    let p: number;
    try {
      p = await this.model.predict(window);
    } catch (err) {
      this.alive = false;
      this.onError?.(err);
      return;
    }
    // Yield once per window: a deep backlog would otherwise drain as one uninterrupted
    // microtask burst and starve the rest of the process — every other call, HTTP,
    // Socket.IO — for however long that takes. One setImmediate hop per 32 ms window is
    // negligible next to that.
    await new Promise<void>(resolve => setImmediate(resolve));
    if (this.closed) return;
    const o = this.opts;
    this.emit({ type: 'inference', probability: p, rawAccumulatedSilence: this.silenceS, frame });
    if (p >= o.activation || (this.speaking && p > o.deactivation)) {
      this.speechS += WINDOW_S;
      this.silenceS = 0;
      if (!this.speaking && this.speechS >= o.minSpeechS) {
        this.speaking = true;
        this.emit({ type: 'start' });
      }
    } else {
      this.silenceS += WINDOW_S;
      this.speechS = 0;
      if (this.speaking && this.silenceS >= o.minSilenceS) {
        this.speaking = false;
        this.emit({ type: 'end', silenceS: this.silenceS });
      }
    }
  }

  private emit(ev: VadEvent): void {
    try {
      this.onEvent(ev);
    } catch (err) {
      log.warn({ err: (err as Error)?.name }, 'consecutive: VAD listener failed');   // detection goes on
    }
  }
}
