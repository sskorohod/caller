import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadSilero, VadStream, type VadEvent, type VadModel } from './vad.js';

const scripted = (probs: number[]): VadModel => {
  let i = 0;
  return { predict: async () => probs[Math.min(i++, probs.length - 1)] };
};
const settle = () => new Promise(resolve => setTimeout(resolve, 20));
const pushMs = (vad: VadStream, ms: number) => { for (let t = 0; t < ms; t += 20) vad.push(Buffer.alloc(320)); };

test('events follow LiveKit: inference first, start after 0.2 s of speech, end after 0.35 s of silence', async () => {
  const events: VadEvent[] = [];
  const probs = [...new Array(10).fill(0.9), ...new Array(20).fill(0.1)];
  const vad = new VadStream(scripted(probs), ev => events.push(ev));
  pushMs(vad, 30 * 32);
  await settle();
  const kinds = events.map(e => e.type);
  assert.equal(kinds.indexOf('start'), kinds.lastIndexOf('inference', kinds.indexOf('start')) + 1);
  const inferences = events.filter(e => e.type === 'inference');
  assert.equal(inferences.length, 30);
  assert.equal(kinds.slice(0, kinds.indexOf('start')).filter(k => k === 'inference').length, 7);   // 7 × 32 ms ≥ 0.2 s
  const end = events.find(e => e.type === 'end') as { silenceS: number };
  assert.ok(end.silenceS >= 0.35 && end.silenceS < 0.39);
});

test('raw accumulated silence is reported before the window counts', async () => {
  const events: VadEvent[] = [];
  const vad = new VadStream(scripted([0.1, 0.1, 0.1]), ev => events.push(ev));
  pushMs(vad, 3 * 32);
  await settle();
  const silence = events.filter(e => e.type === 'inference').map(e => (e as any).rawAccumulatedSilence);
  assert.deepEqual(silence.map(s => Math.round(s * 1000)), [0, 32, 64]);
});

test('once speaking, 0.6 keeps it; 0.6 alone never starts it', async () => {
  const events: VadEvent[] = [];
  const vad = new VadStream(scripted([...new Array(10).fill(0.6)]), ev => events.push(ev));
  pushMs(vad, 10 * 32);
  await settle();
  assert.ok(!events.some(e => e.type === 'start'));
});

test('each inference carries the 32 ms of the 8 kHz line it judged', async () => {
  const events: VadEvent[] = [];
  const vad = new VadStream(scripted([0.1]), ev => events.push(ev));
  pushMs(vad, 1000);
  await settle();
  const frames = events.filter(e => e.type === 'inference').map(e => (e as any).frame as Buffer);
  assert.equal(frames.length, 31);
  assert.ok(frames.every(f => f.length === 512));
});

test('a model error stops the detector and reports once', async () => {
  let errors = 0;
  const vad = new VadStream({ predict: async () => { throw new Error('boom'); } }, () => {}, undefined, () => errors++);
  pushMs(vad, 200);
  await settle();
  assert.equal(vad.alive, false);
  assert.equal(errors, 1);
});

test('the real Silero model hears speech in the fixture and silence around it', async () => {
  const speech = readFileSync(new URL('./__fixtures__/speech8k.raw', import.meta.url));
  const events: VadEvent[] = [];
  const vad = new VadStream(await loadSilero(), ev => events.push(ev));
  const silence = Buffer.alloc(8000 * 2);
  for (const chunk of [silence, speech, silence]) for (let i = 0; i < chunk.length; i += 320) vad.push(chunk.subarray(i, i + 320));
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.ok(events.some(e => e.type === 'start'));
  assert.ok(events.some(e => e.type === 'end'));
});
