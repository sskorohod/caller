/**
 * Audio plumbing between Twilio and the consecutive translator.
 *
 * Twilio speaks µ-law 8 kHz in 20 ms frames. Inside the translator everything is
 * PCM16 little-endian at 8 kHz — the line's own rate: the echo meter, playback and
 * the voice detector's bookkeeping all work on it. Three places leave it: Silero
 * runs at 16 kHz, the transcriber may take PCM at 24 kHz, and speech synthesis
 * arrives at 24 kHz.
 */
export const LINE_RATE = 8000;
export const FRAME_MS = 20;
export const FRAME_SAMPLES = (LINE_RATE * FRAME_MS) / 1000;   // 160
export const FRAME_BYTES = FRAME_SAMPLES * 2;                 // 320 bytes of PCM16
export const TTS_RATE = 24000;
export const SILENCE_LEVEL = 200;   // mean |sample| below this is silence (aidispatch's measure)
export const SILENT_DBFS = -120;

const MULAW_BIAS = 0x84;
const MULAW_CLIP = 32635;
const MULAW_DECODE = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  const u = ~i & 0xff;
  const magnitude = ((((u & 0x0f) << 3) + MULAW_BIAS) << ((u >> 4) & 0x07)) - MULAW_BIAS;
  MULAW_DECODE[i] = u & 0x80 ? -magnitude : magnitude;
}

export function mulawToPcm(mulaw: Buffer): Buffer {
  const out = Buffer.alloc(mulaw.length * 2);
  for (let i = 0; i < mulaw.length; i++) out.writeInt16LE(MULAW_DECODE[mulaw[i]], i * 2);
  return out;
}

export function pcmToMulaw(pcm: Buffer): Buffer {
  const n = pcm.length >> 1;
  const out = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    let sample = pcm.readInt16LE(i * 2);
    const sign = sample < 0 ? 0x80 : 0;
    if (sample < 0) sample = -sample;
    if (sample > MULAW_CLIP) sample = MULAW_CLIP;
    sample += MULAW_BIAS;
    let exponent = 7;
    for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; exponent--, mask >>= 1) { /* find the segment */ }
    out[i] = ~(sign | (exponent << 4) | ((sample >> (exponent + 3)) & 0x0f)) & 0xff;
  }
  return out;
}

/** 8 → 16 kHz floats for Silero: each sample preceded by the midpoint from the previous one. */
export class Upsampler2 {
  private prev = 0;

  push(pcm8k: Buffer): Float32Array {
    const n = pcm8k.length >> 1;
    const out = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const s = pcm8k.readInt16LE(i * 2) / 32768;
      out[2 * i] = (this.prev + s) / 2;
      out[2 * i + 1] = s;
      this.prev = s;
    }
    return out;
  }
}

/** 8 → 24 kHz PCM16 for the transcriber, linear between neighbours. */
export class Upsampler3 {
  private prev = 0;

  push(pcm8k: Buffer): Buffer {
    const n = pcm8k.length >> 1;
    const out = Buffer.alloc(n * 6);
    for (let i = 0; i < n; i++) {
      const s = pcm8k.readInt16LE(i * 2);
      const p = this.prev;
      out.writeInt16LE(Math.round(p + (s - p) / 3), i * 6);
      out.writeInt16LE(Math.round(p + (2 * (s - p)) / 3), i * 6 + 2);
      out.writeInt16LE(s, i * 6 + 4);
      this.prev = s;
    }
    return out;
  }
}

// Windowed-sinc low-pass at 3.4 kHz for 24 kHz input (Blackman, 63 taps): what is left
// above 4 kHz would fold back into the band after keeping every third sample.
const DOWN_TAPS: Float64Array = (() => {
  const n = 63;
  const fc = 3400 / TTS_RATE;
  const mid = (n - 1) / 2;
  const taps = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x = i - mid;
    const sinc = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (n - 1));
    taps[i] = sinc * w;
    sum += taps[i];
  }
  for (let i = 0; i < n; i++) taps[i] /= sum;   // unity gain at DC
  return taps;
})();

/** 24 → 8 kHz for the line. Stateful: a stream cut into any chunks resamples as one piece. */
export class Downsampler3 {
  private readonly ring = new Float64Array(DOWN_TAPS.length);
  private pos = 0;
  private phase = 0;
  private odd: number | null = null;

  push(pcm24: Buffer): Buffer {
    let buf = pcm24;
    if (this.odd !== null) {
      buf = Buffer.concat([Buffer.from([this.odd]), pcm24]);
      this.odd = null;
    }
    if (buf.length % 2) {
      this.odd = buf[buf.length - 1];
      buf = buf.subarray(0, buf.length - 1);
    }
    const n = buf.length >> 1;
    const size = DOWN_TAPS.length;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      this.ring[this.pos] = buf.readInt16LE(i * 2);
      this.pos = (this.pos + 1) % size;
      if (++this.phase < 3) continue;
      this.phase = 0;
      let acc = 0;
      for (let k = 0; k < size; k++) acc += DOWN_TAPS[k] * this.ring[(this.pos - 1 - k + size) % size];
      out.push(Math.max(-32768, Math.min(32767, Math.round(acc))));
    }
    const res = Buffer.alloc(out.length * 2);
    for (let j = 0; j < out.length; j++) res.writeInt16LE(out[j], j * 2);
    return res;
  }
}

export function meanAbs(pcm: Buffer): number {
  const n = pcm.length >> 1;
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(pcm.readInt16LE(i * 2));
  return sum / n;
}

export function dbfs(pcm: Buffer): number {
  const n = pcm.length >> 1;
  if (!n) return SILENT_DBFS;
  let sum = 0;
  for (let i = 0; i < n; i++) { const s = pcm.readInt16LE(i * 2); sum += s * s; }
  const rms = Math.sqrt(sum / n);
  return rms > 0 ? 20 * Math.log10(rms / 32768) : SILENT_DBFS;
}
