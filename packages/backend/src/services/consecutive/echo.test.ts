import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbfs, FRAME_BYTES, FRAME_SAMPLES } from './audio.js';
import { EchoMeter } from './echo.js';

// Echo measurement: the echo filter is needed only where the line really repeats our voice.
// Port of aidispatch tests/test_consecutive_echo.py: frames are 20 ms of PCM16 at 8 kHz (160 samples),
// 50 per second as there; levels are in dBFS, delays in frames. Seeds keep aidispatch's numbers on another
// generator, so the scenes are new draws of the same scenarios.

type Level = number | null;
const SILENCE = null;   // digital silence: a line without a single rustle, as in the rehearsal scene
const NONE = -200;      // the level of "nothing" for adding powers

/** The numpy Generator calls the tests use, on a seeded mulberry32: deterministic, though not numpy's draws. */
function makeRng(seed: number) {
  let a = seed | 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    integers: (low: number, high: number) => low + Math.floor(next() * (high - low)),   // [low, high) like numpy
    uniform: (low: number, high: number) => low + next() * (high - low),
    normal: (mean: number, sd: number) =>                                                 // Box-Muller
      mean + sd * Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next()),
  };
}
type Rng = ReturnType<typeof makeRng>;

/** 20 ms of equal samples: their level is db dBFS (up to the rounding of a sample). */
function level(db: Level): Buffer {
  const frame = Buffer.alloc(FRAME_BYTES);
  if (db === null || db <= -110) return frame;
  const value = Math.max(1, Math.round(32768 * 10 ** (db / 20)));
  for (let i = 0; i < FRAME_SAMPLES; i++) frame.writeInt16LE(value, i * 2);
  return frame;
}

/** Our translation per frame: replies of words (−20…−35 dBFS) with pauses inside (−70); silent between replies. */
function oursSpeech(rng: Rng, seconds: number): Level[] {
  const out: Level[] = [];
  while (out.length < seconds * 50) {
    for (let words = rng.integers(4, 9); words > 0; words--) {       // a reply of several words
      const word = rng.uniform(-35, -20);
      out.push(...new Array<Level>(rng.integers(10, 25)).fill(word));
      out.push(...new Array<Level>(rng.integers(3, 10)).fill(-70));
    }
    out.push(...new Array<Level>(rng.integers(40, 80)).fill(null));  // between replies we are silent
  }
  return out.slice(0, seconds * 50);
}

const add = (...levels: number[]) => 10 * Math.log10(levels.reduce((sum, x) => sum + 10 ** (x / 10), 0));

function feed(meter: EchoMeter, ours: Level[], line: Level[]): void {
  for (let k = 0; k < Math.min(ours.length, line.length); k++) {
    const our = ours[k];
    if (our !== null) meter.ours(level(our));
    meter.line(level(line[k]));
  }
}

const noise = (rng: Rng, n: number, db: number): number[] => Array.from({ length: n }, () => db + rng.normal(0, 1.5));

function echoOf(ours: Level[], { gain, delay }: { gain: number; delay: number }): number[] {
  return ours.map((_, k) => {
    const said = k < delay ? null : ours[k - delay];
    return said === null ? NONE : said + gain;
  });
}

test('levels are measured in dBFS', () => {
  assert.ok(Math.abs(dbfs(level(-25)) - -25) <= 0.1);
  assert.equal(dbfs(Buffer.alloc(FRAME_BYTES)), -120);
});

test('no verdict before a second and a half of our speech', () => {
  const rng = makeRng(1);
  const meter = new EchoMeter();
  feed(meter, [...new Array<Level>(50).fill(-25), ...new Array<Level>(100).fill(null)], noise(rng, 150, -90));
  assert.equal(meter.present, null);
});

test('a line that stays at its noise while we speak has no echo', () => {
  // What live calls look like: while our translation plays, the line carries only its own noise.
  const rng = makeRng(2);
  const ours = oursSpeech(rng, 20);
  const meter = new EchoMeter();
  feed(meter, ours, noise(rng, ours.length, -90));
  assert.equal(meter.present, false);
  assert.ok(meter.correlation !== null && meter.correlation < 0.3, `correlation ${meter.correlation}`);
});

test('our voice coming back 30 dB down is echo', () => {
  const rng = makeRng(3);
  const ours = oursSpeech(rng, 20);
  const echo = echoOf(ours, { gain: -30, delay: 15 });
  const line = noise(rng, ours.length, -90).map((n, k) => add(echo[k], n));
  const meter = new EchoMeter();
  feed(meter, ours, line);
  assert.equal(meter.present, true);
  assert.ok(meter.correlation !== null && meter.correlation > 0.8, `correlation ${meter.correlation}`);
  assert.ok(meter.returnDb !== null && -33 < meter.returnDb && meter.returnDb < -27, `return ${meter.returnDb} dB`);
});

test('even a quiet echo counts on a line without noise', () => {
  // The rehearsal scene: no noise, and the transcriber heard an echo 50 dB below us word for word.
  const rng = makeRng(4);
  const ours = oursSpeech(rng, 20);
  const line = echoOf(ours, { gain: -50, delay: 13 }).map(e => (e === NONE ? SILENCE : e));
  const meter = new EchoMeter();
  feed(meter, ours, line);
  assert.equal(meter.present, true);
});

test('an echo buried in the line noise does not count', () => {
  // An echo below the line noise does not repeat our envelope: the transcriber does not hear it either.
  const rng = makeRng(5);
  const ours = oursSpeech(rng, 20);
  const echo = echoOf(ours, { gain: -65, delay: 15 });
  const line = noise(rng, ours.length, -60).map((n, k) => add(echo[k], n));
  const meter = new EchoMeter();
  feed(meter, ours, line);
  assert.equal(meter.present, false);
});

test('a person answering right after us is not echo', () => {
  // A level-based meter took this for echo: the other side answers as soon as we stop.
  const rng = makeRng(6);
  const ours = oursSpeech(rng, 30);
  const line = noise(rng, ours.length, -90);
  for (let k = 1; k < ours.length; k++) {
    if (ours[k - 1] !== null && ours[k] === null) {                 // we stopped: the person starts talking
      for (let j = k + 5; j < Math.min(k + 60, ours.length); j++) line[j] = add(line[j], rng.uniform(-35, -18));
    }
  }
  const meter = new EchoMeter();
  feed(meter, ours, line);
  assert.equal(meter.present, false);
});

test('a person talking over our translation is not echo', () => {
  const rng = makeRng(7);
  const ours = oursSpeech(rng, 30);
  const line = noise(rng, ours.length, -90);
  for (let start = 100; start < ours.length; start += 400) {        // "uh-huh, yeah-yeah" over our translation
    for (let j = start; j < Math.min(start + 50, ours.length); j++) line[j] = add(line[j], rng.uniform(-35, -18));
  }
  const meter = new EchoMeter();
  feed(meter, ours, line);
  assert.equal(meter.present, false);
});

test('a distorted echo still counts', () => {
  // A live echo is not a copy: the phone and the network distort it. A correlation around 0.8 is still echo.
  const rng = makeRng(10);
  const ours = oursSpeech(rng, 20);
  const echo = echoOf(ours, { gain: -30, delay: 15 }).map(e => (e === NONE ? e : e + rng.normal(0, 3)));
  const meter = new EchoMeter();
  feed(meter, ours, noise(rng, ours.length, -90).map((n, k) => add(echo[k], n)));
  assert.equal(meter.present, true);
  assert.ok(meter.correlation !== null && meter.correlation < 0.9, `correlation ${meter.correlation}`);
});

test('our audio handed out ahead of playout is timed as it sounds', () => {
  // The output holds 0.4 s of our audio ahead of playout (at the start of a reply it takes all of it at once).
  // The envelope still follows playout: an echo 0.8 s after playout is found although 1.2 s have passed since
  // hand-out, more than MAX_LAG.
  const rng = makeRng(8);
  const ours = oursSpeech(rng, 20);
  const echo = echoOf(ours, { gain: -30, delay: 40 });
  const line = noise(rng, ours.length, -90).map((n, k) => add(echo[k], n));
  const meter = new EchoMeter();
  let handed = 0;
  line.forEach((heard, k) => {
    if (ours[k] === null) handed = Math.max(handed, k + 1);          // between replies nothing goes out
    while (handed <= k + 19 && handed < ours.length && ours[handed] !== null) {
      meter.ours(level(ours[handed]));                                // the output takes frames 0.4 s ahead of playout
      handed++;
    }
    meter.line(level(heard));
  });
  assert.equal(meter.present, true);
});

test('echo once found stays for the rest of the call', () => {
  // Echo is a property of the line: windows where people talk over the translation must not switch the
  // filter off mid-call.
  const rng = makeRng(9);
  const ours = oursSpeech(rng, 20);
  const echo = echoOf(ours, { gain: -30, delay: 15 });
  const meter = new EchoMeter();
  feed(meter, ours, noise(rng, ours.length, -90).map((n, k) => add(echo[k], n)));
  assert.equal(meter.present, true);
  const later = oursSpeech(rng, 20);
  feed(meter, later, noise(rng, later.length, -90));
  assert.equal(meter.present, true);
});
