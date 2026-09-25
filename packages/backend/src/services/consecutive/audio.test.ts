import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbfs, Downsampler3, FRAME_BYTES, meanAbs, mulawToPcm, pcmToMulaw, SILENT_DBFS, Upsampler2, Upsampler3 } from './audio.js';

const pcm = (samples: number[]) => { const b = Buffer.alloc(samples.length * 2); samples.forEach((s, i) => b.writeInt16LE(s, i * 2)); return b; };
const samples = (b: Buffer) => Array.from({ length: b.length >> 1 }, (_, i) => b.readInt16LE(i * 2));
const sine = (freq: number, rate: number, n: number, amp = 10000) => pcm(Array.from({ length: n }, (_, i) => Math.round(amp * Math.sin((2 * Math.PI * freq * i) / rate))));
const rms = (x: number[]) => Math.sqrt(x.reduce((a, s) => a + s * s, 0) / x.length);

test('mu-law decodes the reference points of G.711', () => {
  assert.deepEqual(samples(mulawToPcm(Buffer.from([0xff, 0x7f, 0x80, 0x00]))), [0, 0, 32124, -32124]);
  assert.equal(pcmToMulaw(pcm([0]))[0], 0xff);
});

test('mu-law round trip stays within the quantisation step', () => {
  for (let x = -32000; x <= 32000; x += 777) {
    const back = samples(mulawToPcm(pcmToMulaw(pcm([x]))))[0];
    assert.ok(Math.abs(back - x) <= Math.abs(x) / 16 + 8, `${x} → ${back}`);
  }
});

test('mu-law survives the extremes of int16', () => {
  assert.deepEqual(samples(mulawToPcm(pcmToMulaw(pcm([-32768, 32767])))), [-32124, 32124]);
});

test('a frame is 20 ms of PCM16 at 8 kHz', () => {
  assert.equal(FRAME_BYTES, 320);
});

test('upsampling doubles and triples the length and keeps a constant constant', () => {
  const up2 = new Upsampler2();
  up2.push(pcm([1000, 1000]));
  const out2 = up2.push(pcm(new Array(80).fill(1000)));
  assert.equal(out2.length, 160);
  assert.ok(out2.every(v => Math.abs(v - 1000 / 32768) < 1e-9));
  const up3 = new Upsampler3();
  up3.push(pcm([1000]));
  const out3 = samples(up3.push(pcm(new Array(80).fill(1000))));
  assert.equal(out3.length, 240);
  assert.ok(out3.every(v => v === 1000));
});

test('downsampling 24 to 8 kHz keeps speech band and removes what would alias', () => {
  const low = new Downsampler3();
  const pass = samples(low.push(sine(1000, 24000, 24000))).slice(200);
  assert.ok(Math.abs(rms(pass) / (10000 / Math.SQRT2) - 1) < 0.1, `1 kHz rms ${rms(pass)}`);
  const high = new Downsampler3();
  const stop = samples(high.push(sine(7000, 24000, 24000))).slice(200);
  assert.ok(rms(stop) < 0.01 * (10000 / Math.SQRT2), `7 kHz rms ${rms(stop)}`);
});

test('downsampling a stream cut into odd chunks equals downsampling it whole', () => {
  const whole = sine(700, 24000, 3001);
  const a = samples(new Downsampler3().push(whole));
  const d = new Downsampler3();
  const parts = [whole.subarray(0, 1001), whole.subarray(1001, 4000), whole.subarray(4000)];
  const b = parts.flatMap(p => samples(d.push(Buffer.from(p))));
  assert.deepEqual(b, a);
});

test('levels: silence is the floor, a half-scale constant is -6 dBFS', () => {
  assert.equal(dbfs(Buffer.alloc(320)), SILENT_DBFS);
  assert.ok(Math.abs(dbfs(pcm(new Array(160).fill(16384))) - -6.02) < 0.01);
  assert.equal(meanAbs(pcm([100, -300])), 200);
});
