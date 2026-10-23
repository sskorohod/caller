import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { FRAME_BYTES } from './audio.js';
import { Playback, type PlaybackOut } from './playback.js';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** An output with a pace: each write takes `delay` ms, and the frame counts once its write returns.
 *  `lead` is what a real transport would still be holding unplayed; 0 unless a test says otherwise, and a
 *  clear() drops it, as TwilioOut's does. */
class Sink implements PlaybackOut {
  frames: Buffer[] = [];
  clears = 0;
  lead = 0;

  constructor(private readonly delay = 1) {}

  async write(frame: Buffer): Promise<void> {
    await sleep(this.delay);
    this.frames.push(frame);
  }

  clear(): void {
    this.clears += 1;
    this.lead = 0;
  }

  leadMs(): number {
    return this.lead;
  }
}

const pcm = (value: number, frames = 1) => Buffer.alloc(FRAME_BYTES * frames, value);

async function runUntil(cond: () => boolean, timeoutMs = 1000): Promise<boolean> {
  for (let i = 0; i < timeoutMs / 2; i++) {
    if (cond()) return true;
    await sleep(2);
  }
  return false;
}

test('plays only the released utterance and reports when it is done', async () => {
  const sink = new Sink();
  const finished: number[] = [];
  const player = new Playback(sink, { onFinished: u => finished.push(u) });
  const running = player.run();
  player.append(1, pcm(1, 3));
  player.append(2, pcm(2, 2));   // the second utterance's audio is ready, but it was not released
  await sleep(20);
  assert.deepEqual(sink.frames, []);   // nothing plays without play()
  player.play(1);
  await runUntil(() => sink.frames.length === 3);
  assert.ok(sink.frames.every(f => f[0] === 1));
  assert.deepEqual(finished, []);   // the engine may still add audio
  player.done(1);
  assert.ok(await runUntil(() => isDeepStrictEqual(finished, [1])));
  player.close();
  await running;
});

test('audio arriving while playing is played in order', async () => {
  const sink = new Sink();
  const finished: number[] = [];
  const player = new Playback(sink, { onFinished: u => finished.push(u) });
  const running = player.run();
  player.play(1);
  player.append(1, pcm(1));
  await runUntil(() => sink.frames.length === 1);
  player.append(1, pcm(2));
  player.done(1);
  assert.ok(await runUntil(() => isDeepStrictEqual(finished, [1])));
  assert.deepEqual(sink.frames.map(f => f[0]), [1, 2]);
  player.close();
  await running;
});

test('partial last frame is padded with silence', async () => {
  const sink = new Sink();
  const finished: number[] = [];
  const player = new Playback(sink, { onFinished: u => finished.push(u) });
  const running = player.run();
  player.append(1, Buffer.alloc(100, 5));
  player.done(1);
  player.play(1);
  assert.ok(await runUntil(() => isDeepStrictEqual(finished, [1])));
  assert.equal(sink.frames.length, 1);
  assert.equal(sink.frames[0].length, FRAME_BYTES);
  assert.deepEqual(sink.frames[0].subarray(0, 100), Buffer.alloc(100, 5));
  assert.deepEqual(sink.frames[0].subarray(100), Buffer.alloc(FRAME_BYTES - 100));
  player.close();
  await running;
});

test('stop clears downstream twice and drops the rest', async () => {
  const sink = new Sink(5);
  const finished: number[] = [];
  const player = new Playback(sink, { onFinished: u => finished.push(u) });
  const running = player.run();
  player.append(1, pcm(1, 50));
  player.play(1);
  await runUntil(() => sink.frames.length >= 2);
  player.stop(1);
  await sleep(30);
  const written = sink.frames.length;
  await sleep(30);
  assert.equal(sink.frames.length, written);   // not a frame after the stop
  assert.ok(sink.clears >= 2);   // at once, and after the frame that was already in flight
  assert.deepEqual(finished, []);   // an interrupted utterance is not "finished"
  player.close();
  await running;
});

test('discarded utterance never plays', async () => {
  const sink = new Sink();
  const finished: number[] = [];
  const player = new Playback(sink, { onFinished: u => finished.push(u) });
  const running = player.run();
  player.append(1, pcm(1, 2));
  player.discard(1);
  player.append(1, pcm(1, 2));   // late audio of a discarded utterance goes nowhere either
  player.play(1);
  await sleep(30);
  assert.deepEqual(sink.frames, []);
  player.close();
  await running;
});

test('every played frame is offered to the recording', async () => {
  const sink = new Sink();
  const finished: number[] = [];
  const recorded: Buffer[] = [];
  const player = new Playback(sink, { onFinished: u => finished.push(u), onFrame: f => recorded.push(f) });
  const running = player.run();
  player.append(1, pcm(3, 2));
  player.done(1);
  player.play(1);
  assert.ok(await runUntil(() => isDeepStrictEqual(finished, [1])));
  assert.deepEqual(recorded, sink.frames);
  assert.equal(player.playedSeconds, 2 * 0.02);
  player.close();
  await running;
});

test('a failing sink does not kill the player', async () => {
  const finished: number[] = [];
  let calls = 0;
  const flaky: PlaybackOut = {
    async write() {
      calls += 1;
      if (calls === 1) throw new Error('boom');
    },
    clear() {},
    leadMs() { return 0; },
  };
  const player = new Playback(flaky, { onFinished: u => finished.push(u) });
  const running = player.run();
  player.append(1, pcm(1, 3));
  player.done(1);
  player.play(1);
  assert.ok(await runUntil(() => isDeepStrictEqual(finished, [1])));
  player.close();
  await running;
});

test('pause keeps the rest and resume repeats what may not have been heard', async () => {
  // The speaker went on over the translation of their own words: the translation pauses and is played
  // on later. What went downstream but may not have been heard comes back to the front: better to
  // repeat than to lose.
  const sink = new Sink(2);
  const finished: number[] = [];
  const player = new Playback(sink, { onFinished: u => finished.push(u) });
  const running = player.run();
  const frames = Buffer.concat(Array.from({ length: 30 }, (_, i) => pcm(i + 1)));   // frames 1–30
  player.append(1, frames);
  player.done(1);
  player.play(1);
  await runUntil(() => sink.frames.length >= 5);
  player.pause(1);
  await sleep(20);
  const heard = sink.frames.map(f => f[0]);
  player.play(1);
  assert.ok(await runUntil(() => isDeepStrictEqual(finished, [1])));
  const resumed = sink.frames.map(f => f[0]).slice(heard.length);
  const seen = new Set([...heard, ...resumed]);
  assert.equal(resumed.at(-1), 30);
  assert.ok(Array.from({ length: 30 }, (_, i) => i + 1).every(v => seen.has(v)));   // not a frame lost
  assert.ok(resumed[0] <= heard[heard.length - 1]);   // started by repeating what may not have been heard
  player.close();
  await running;
});

test('resume starts from the beginning of the interrupted phrase', async () => {
  // Call of 24.09: after a pause the translation went on from the middle of a word and could not be
  // followed. Now it resumes from the start of the interrupted phrase (after the last pause in our
  // audio), with a short silence before it; the phrase before is not repeated.
  const sink = new Sink(2);
  const finished: number[] = [];
  const player = new Playback(sink, { onFinished: u => finished.push(u) });
  const running = player.run();
  const first = Buffer.concat(Array.from({ length: 10 }, (_, i) => pcm(i + 1)));     // phrase 1: frames 1–10
  const gap = Buffer.alloc(FRAME_BYTES * 15);                                          // 0.3 s of silence
  const second = Buffer.concat(Array.from({ length: 30 }, (_, i) => pcm(i + 11)));   // phrase 2: frames 11–40
  player.append(1, Buffer.concat([first, gap, second]));
  player.done(1);
  player.play(1);
  await runUntil(() => sink.frames.length >= 35);   // the middle of the second phrase is playing
  player.pause(1);
  await sleep(20);
  const heard = sink.frames.length;
  player.play(1);
  assert.ok(await runUntil(() => isDeepStrictEqual(finished, [1])));
  const resumed = sink.frames.map(f => f[0]).slice(heard);
  assert.deepEqual(resumed.slice(0, 6), [0, 0, 0, 0, 0, 11]);   // 0.1 s of silence, then the phrase from its start
  assert.equal(resumed.at(-1), 40);
  assert.ok(!resumed.some(v => v >= 1 && v <= 10));   // the first phrase is not repeated
  player.close();
  await running;
});

test('a pause gives back the end of the phrase before the seam, which downstream had not played', async () => {
  // Finding 13. The trim at the seam used to throw the end of the previous phrase away while the output was
  // still holding it unplayed, and the clear() of the pause then dropped it there too: up to 140 ms of
  // translated speech lost for good, in the one mechanism written to prevent exactly that.
  // The Sink's clear() zeroes its lead, as TwilioOut's does — so this also pins the ordering: read the lead
  // BEFORE the clear, or the prefix is empty and the fix is a no-op.
  const sink = new Sink(2);
  const finished: number[] = [];
  const player = new Playback(sink, { onFinished: u => finished.push(u) });
  const running = player.run();
  const first = Buffer.concat(Array.from({ length: 10 }, (_, i) => pcm(i + 1)));   // phrase 1: frames 1-10
  const gap = Buffer.alloc(FRAME_BYTES * 12);                                      // 0.24 s: the seam
  player.append(1, Buffer.concat([first, gap, pcm(11)]));                          // phrase 2 begins
  player.play(1);
  assert.ok(await runUntil(() => sink.frames.length === 23));
  sink.lead = 400;             // the output still has 0.4 s of it to play: the end of phrase 1 has not sounded
  player.pause(1);
  player.append(1, Buffer.concat(Array.from({ length: 29 }, (_, i) => pcm(i + 12))));
  player.done(1);
  player.play(1);
  assert.ok(await runUntil(() => isDeepStrictEqual(finished, [1])));
  const resumed = sink.frames.map(f => f[0]).slice(23);
  assert.deepEqual(resumed.slice(0, 8), [3, 4, 5, 6, 7, 8, 9, 10]);   // the unheard end of phrase 1 is back
  assert.deepEqual(resumed.slice(8, 20), Array.from({ length: 12 }, () => 0));   // the real seam, not a new one
  assert.equal(resumed[20], 11);          // then phrase 2 from its start
  assert.equal(resumed.at(-1), 40);
  player.close();
  await running;
});

test('a reply is not finished while the output is still playing it', async () => {
  // Finding 14. The buffer empties when the LAST frame has been handed over, and the output still has up to
  // 400 ms of it to play. Reporting the reply finished there stamps the next one's playAt before its first
  // sound and lets a clear() cut a tail the transcript already called done.
  const sink = new Sink(1);
  const finished: number[] = [];
  const player = new Playback(sink, { onFinished: u => finished.push(u) });
  const running = player.run();
  player.append(1, pcm(7, 3));
  player.done(1);
  sink.lead = 60;
  player.play(1);
  assert.ok(await runUntil(() => sink.frames.length === 3));
  // Everything has been handed over and the engine is done, but our voice is still in the room.
  assert.ok(!(await runUntil(() => finished.length > 0, 80)), 'finished while the tail was still sounding');
  sink.lead = 0;
  assert.ok(await runUntil(() => isDeepStrictEqual(finished, [1])));
  player.close();
  await running;
});

test('a barge-in while the tail still sounds silences it and the reply counts as interrupted', async () => {
  // Finding 14, the half that reaches the listener: in that window the floor still has the reply as playing,
  // so a stop really silences Twilio's buffer — and the turn is recorded interrupted rather than done.
  const sink = new Sink(1);
  const finished: number[] = [];
  const player = new Playback(sink, { onFinished: u => finished.push(u) });
  const running = player.run();
  player.append(1, pcm(7, 3));
  player.done(1);
  sink.lead = 200;
  player.play(1);
  assert.ok(await runUntil(() => sink.frames.length === 3));
  const clears = sink.clears;
  player.stop(1);
  assert.ok(sink.clears > clears, 'the tail downstream is dropped');
  await sleep(20);
  assert.deepEqual(finished, []);   // not "done": it was cut off
  player.close();
  await running;
});

test('restart throws away the old audio and plays the new one', async () => {
  // The translation starts over: the old audio is thrown away and the downstream queue cleared, but new
  // audio for the same utterance is accepted and plays from the start (a plain stop would close the
  // utterance to audio for good).
  const sink = new Sink(2);
  const finished: number[] = [];
  const player = new Playback(sink, { onFinished: u => finished.push(u) });
  const running = player.run();
  player.append(1, pcm(1, 30));
  player.play(1);
  await runUntil(() => sink.frames.length >= 3);
  const clears = sink.clears;
  player.restart(1);
  assert.ok(sink.clears > clears);
  await sleep(20);
  const heard = sink.frames.length;
  player.append(1, pcm(2, 3));
  player.done(1);
  player.play(1);
  assert.ok(await runUntil(() => isDeepStrictEqual(finished, [1])));
  assert.deepEqual(sink.frames.slice(heard).map(f => f[0]), [2, 2, 2]);
  player.close();
  await running;
});

test('undone waits for the engine again', async () => {
  const sink = new Sink();
  const finished: number[] = [];
  const player = new Playback(sink, { onFinished: u => finished.push(u) });
  const running = player.run();
  player.append(1, pcm(1));
  player.done(1);
  player.undone(1);   // the utterance went on: "done" no longer holds
  player.play(1);
  await sleep(30);
  assert.deepEqual(finished, []);
  player.append(1, pcm(2));
  player.done(1);
  assert.ok(await runUntil(() => isDeepStrictEqual(finished, [1])));
  player.close();
  await running;
});
