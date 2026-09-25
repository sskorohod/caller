// Changes to one live call run one at a time, in arrival order: an engine swap waits seconds for
// the new engine, and the change after it must see that engine, not the one it replaced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSerialized } from './run-serialized.js';

/** A promise the test settles by hand. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => { resolve = res; });
  return { promise, resolve };
}

/** Lets every pending promise reaction run. */
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test('a change waits for the one before it and sees what that one installed', async () => {
  const chains = new Map<string, Promise<void>>();
  let installed = 'cascade';
  const engineUp = deferred();
  const swap = runSerialized(chains, 'call-1', async () => {
    await engineUp.promise;   // the new engine takes a while to start
    installed = 'consecutive';
  });
  let seen = '';
  const next = runSerialized(chains, 'call-1', async () => { seen = installed; });
  await tick();
  assert.equal(seen, '');     // still queued behind the swap
  engineUp.resolve();
  await Promise.all([swap, next]);
  assert.equal(seen, 'consecutive');
});

test('a change that throws fails its own caller and does not block the next one', async () => {
  const chains = new Map<string, Promise<void>>();
  const failing = runSerialized(chains, 'call-1', async () => { throw new Error('engine did not start'); });
  let ran = false;
  const next = runSerialized(chains, 'call-1', async () => { ran = true; });
  await assert.rejects(failing, /engine did not start/);
  await next;
  assert.equal(ran, true);
  await tick();
  assert.equal(chains.size, 0);
});

test('changes of different calls do not wait for each other', async () => {
  const chains = new Map<string, Promise<void>>();
  const held = deferred();
  const slow = runSerialized(chains, 'call-1', () => held.promise);
  let other = false;
  await runSerialized(chains, 'call-2', async () => { other = true; });
  assert.equal(other, true);
  held.resolve();
  await slow;
});

test('the entry goes when the last queued change settles, not when an earlier one does', async () => {
  const chains = new Map<string, Promise<void>>();
  const first = deferred();
  const second = deferred();
  const a = runSerialized(chains, 'call-1', () => first.promise);
  const b = runSerialized(chains, 'call-1', () => second.promise);
  first.resolve();
  await a;
  await tick();
  assert.equal(chains.has('call-1'), true);   // b is still in flight: a's cleanup must leave b's chain
  second.resolve();
  await b;
  await tick();
  assert.equal(chains.has('call-1'), false);
});
