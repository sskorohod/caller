import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUEUE_MS, TwilioOut } from './twilio-out.js';

function fake() {
  let t = 0;
  const sent: any[] = [];
  const socket = { readyState: 1, send: (d: string) => sent.push(JSON.parse(d)) };
  const out = new TwilioOut(socket, 'MZ1', () => t, async ms => { t += ms; });
  return { out, sent, socket, now: () => t };
}
const frame = () => Buffer.alloc(320, 1);

test('frames go out as mu-law media no further than 400 ms ahead of real time', async () => {
  const { out, sent, now } = fake();
  for (let i = 0; i < 30; i++) await out.write(frame());
  assert.equal(sent.length, 30);
  assert.deepEqual(Object.keys(sent[0]), ['event', 'streamSid', 'media']);
  assert.equal(Buffer.from(sent[0].media.payload, 'base64').length, 160);
  assert.ok(Math.abs(now() - (30 * 20 - QUEUE_MS)) <= 20, `slept ${now()} ms`);
});

test('clear drops what Twilio buffered and the next frame goes at once', async () => {
  const { out, sent, now } = fake();
  for (let i = 0; i < 30; i++) await out.write(frame());
  out.clear();
  assert.deepEqual(sent.at(-1), { event: 'clear', streamSid: 'MZ1' });
  const before = now();
  await out.write(frame());
  assert.equal(now(), before);
});

test('a closed socket swallows frames but keeps the pace', async () => {
  const { out, sent, socket, now } = fake();
  socket.readyState = 3;
  for (let i = 0; i < 30; i++) await out.write(frame());
  assert.equal(sent.length, 0);
  assert.ok(now() >= 30 * 20 - QUEUE_MS - 20);
});
