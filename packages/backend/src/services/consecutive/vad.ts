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

let modelBytes: Promise<Uint8Array> | null = null;

export async function loadSilero(path: URL | string = MODEL_PATH): Promise<VadModel> {
  ort.env.wasm.numThreads = 1;
  modelBytes ??= readFile(path).then(b => new Uint8Array(b));
  let bytes: Uint8Array;
  try {
    bytes = await modelBytes;
  } catch (err) {
    modelBytes = null;   // a failed read must not stick for the next call
    throw err;
  }
  const session = await ort.InferenceSession.create(bytes);
  let state: ort.Tensor = new ort.Tensor('float32', new Float32Array(2 * 128), [2, 1, 128]);
  const sr = new ort.Tensor('int64', BigInt64Array.from([BigInt(MODEL_RATE)]), []);
  let context = new Float32Array(CONTEXT);
  return {
    async predict(window: Float32Array): Promise<number> {
      const input = new Float32Array(CONTEXT + WINDOW);
      input.set(context, 0);
      input.set(window, CONTEXT);
      const out = await session.run({ input: new ort.Tensor('float32', input, [1, CONTEXT + WINDOW]), state, sr });
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
    this.pending8 = Buffer.concat([this.pending8, pcm8k]);
    this.pending16 = concat(this.pending16, this.up.push(pcm8k));
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
