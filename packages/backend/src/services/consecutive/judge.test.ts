/**
 * Turn-taking judge: end-of-thought and intent-over-playing-translation.
 *
 * No network: the OpenAI client is replaced by a fake. We check the shape of the request, the
 * parsing of the answer, the fallback to null on any failure, and the usage/cost count — the
 * model's actual accuracy is measured against the live API, not here.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { calculateLLMCost } from '../../config/pricing.js';
import type { ChatClientLike, IntentLabel } from './judge.js';

// judge.ts builds its pino logger at module load (`pino({ name: 'consecutive' })` — not
// injectable, see judge.ts) so the "log has no key" test below needs stdout wrapped — recording
// every write and still forwarding it to the real stream — before that module is first loaded.
// A static top-level import of judge.js would evaluate before any line here runs, so it's
// loaded dynamically, after the wrap is installed.
const capturedStdout: string[] = [];
const realStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = ((chunk: any, ...rest: any[]) => {
  capturedStdout.push(String(chunk));
  return (realStdoutWrite as (...a: any[]) => boolean)(chunk, ...rest);
}) as typeof process.stdout.write;

const { Judge, JUDGE_MODEL, TIMEOUT_MS, INTENTS } = await import('./judge.js');

after(() => {
  process.stdout.write = realStdoutWrite;
});

const EMPTY_USAGE = { calls: 0, errors: 0, in: 0, cached: 0, out: 0 };
const PLAYING = 'Деньги вернут в пятницу.';

/** A Chat Completions reply: an object becomes JSON, a string or null pass through as-is. */
function reply(content: unknown, usage?: any) {
  const c = content === null || typeof content === 'string' ? content : JSON.stringify(content);
  return { choices: [{ message: { content: c } }], usage };
}

/**
 * Hands out queued replies in order and records every request. A queued Error is thrown
 * (rejected) instead of returned. With delayMs > 0, the reply only lands after that delay
 * unless aborted first — mirrors what the OpenAI SDK does with the `signal` option.
 */
class FakeClient implements ChatClientLike {
  requests: any[] = [];
  chat: ChatClientLike['chat'];
  private replies: any[];
  private delayMs: number;

  constructor(replies: any[], delayMs = 0) {
    this.replies = [...replies];
    this.delayMs = delayMs;
    this.chat = { completions: { create: (body: any, options?: any) => this.create(body, options) } };
  }

  private create(body: any, options?: { signal?: AbortSignal }): Promise<any> {
    this.requests.push(body);
    const answer = this.replies.shift();
    if (this.delayMs <= 0) {
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (answer instanceof Error) reject(answer);
        else resolve(answer);
      }, this.delayMs);
      options?.signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(options.signal!.reason ?? new Error('aborted'));
        },
        { once: true },
      );
    });
  }
}

// `Judge` here is a value destructured from a dynamic import (see top of file), not a type
// import, so the instance type is derived from it instead of naming `Judge` in a type position.
type JudgeInstance = InstanceType<typeof Judge>;

function make(
  replies: any[],
  opts: { languages?: [string, string]; delayMs?: number } = {},
): { judge: JudgeInstance; client: FakeClient } {
  const client = new FakeClient(replies, opts.delayMs ?? 0);
  const judge = new Judge(client, { languages: opts.languages ?? ['English', 'Russian'] });
  return { judge, client };
}

test('semanticEnd asks a strict schema without reasoning', async () => {
  const { judge, client } = make([reply({ complete: false, confidence: 0.9 })]);
  assert.deepStrictEqual(
    await judge.semanticEnd('  I spoke with the customer and he told me that '),
    [false, 0.9],
  );
  const kw = client.requests[0];
  // gpt-4.1-mini doesn't reason: a "reasoning" param would be rejected, and an extra key is extra delay
  assert.deepStrictEqual(
    new Set(Object.keys(kw)),
    new Set(['model', 'messages', 'response_format', 'max_tokens', 'temperature']),
  );
  assert.strictEqual(kw.model, JUDGE_MODEL);
  assert.strictEqual(JUDGE_MODEL, 'gpt-4.1-mini');
  assert.strictEqual(kw.temperature, 0);
  assert.strictEqual(kw.max_tokens, 40);
  assert.deepStrictEqual(kw.messages.map((m: any) => m.role), ['system', 'user']);
  assert.strictEqual(kw.messages[1].content, 'I spoke with the customer and he told me that');
  assert.strictEqual(kw.response_format.type, 'json_schema');
  const schema = kw.response_format.json_schema;
  assert.strictEqual(schema.strict, true);
  assert.ok(schema.name);
  assert.deepStrictEqual(schema.schema, {
    type: 'object',
    additionalProperties: false,
    required: ['complete', 'confidence'],
    properties: { complete: { type: 'boolean' }, confidence: { type: 'number' } },
  });
  assert.strictEqual(TIMEOUT_MS, 2500);
});

test('semanticEnd reads a finished thought', async () => {
  const { judge } = make([reply({ complete: true, confidence: 0.97 })]);
  assert.deepStrictEqual(await judge.semanticEnd('Деньги вернут в пятницу.'), [true, 0.97]);
});

test('intent sends the translation and what was said over it', async () => {
  const { judge, client } = make([reply({ intent: 'interrupt', confidence: 0.8 })]);
  assert.deepStrictEqual(await judge.intent("no, that's wrong", PLAYING), ['interrupt', 0.8]);
  const kw = client.requests[0];
  assert.deepStrictEqual(
    new Set(Object.keys(kw)),
    new Set(['model', 'messages', 'response_format', 'max_tokens', 'temperature']),
  );
  assert.strictEqual(kw.model, JUDGE_MODEL);
  assert.strictEqual(kw.temperature, 0);
  assert.strictEqual(kw.max_tokens, 40);
  const user = kw.messages[1].content as string;
  assert.ok(user.includes(PLAYING) && user.includes("no, that's wrong"));
  const schema = kw.response_format.json_schema;
  assert.strictEqual(schema.strict, true);
  assert.ok(schema.name);
  assert.deepStrictEqual(schema.schema, {
    type: 'object',
    additionalProperties: false,
    required: ['intent', 'confidence'],
    properties: { intent: { type: 'string', enum: ['interrupt', 'ack', 'later'] }, confidence: { type: 'number' } },
  });
});

test('every intent label comes back as is', async () => {
  assert.deepStrictEqual(INTENTS, ['interrupt', 'ack', 'later']);
  const { judge } = make(INTENTS.map((label) => reply({ intent: label, confidence: 0.6 })));
  const results: ([IntentLabel, number] | null)[] = [];
  for (const _label of INTENTS) results.push(await judge.intent('ага, понятно', PLAYING));
  assert.deepStrictEqual(results, INTENTS.map((label) => [label, 0.6]));
});

test('confidence is clamped to zero-one', async () => {
  const { judge } = make([
    reply({ complete: true, confidence: 1.7 }),
    reply({ intent: 'ack', confidence: -0.3 }),
    reply({ complete: false, confidence: 1 }),
  ]);
  assert.deepStrictEqual(await judge.semanticEnd('Да.'), [true, 1.0]);
  assert.deepStrictEqual(await judge.intent('yeah okay I completely understand you', PLAYING), ['ack', 0.0]);
  assert.deepStrictEqual(await judge.semanticEnd('my number is 818 277'), [false, 1.0]);
});

test('unknown label is no answer', async () => {
  const { judge } = make([reply({ intent: 'maybe', confidence: 0.9 })]);
  assert.strictEqual(await judge.intent('hmm', PLAYING), null);
  assert.strictEqual(judge.usage.calls, 1);
  assert.strictEqual(judge.usage.errors, 1);
});

test('garbled answer is no answer', async () => {
  const contents = [
    'not json',
    '',
    null,
    '[]',
    '{"complete": true',
    '{"complete": "yes", "confidence": 0.9}', // not a boolean
    '{"complete": true}', // no confidence
    '{"complete": true, "confidence": "high"}', // confidence is not a number
    '{"complete": true, "confidence": true}', // confidence is a boolean, not a number
    '{"complete": true, "confidence": 1e999}', // JSON.parse gives Infinity here — not finite, rejected
  ];
  for (const content of contents) {
    const { judge } = make([reply(content)]);
    assert.strictEqual(await judge.semanticEnd('Я поговорил с менеджером, и он сказал, что'), null);
    assert.deepStrictEqual(judge.usage, { ...EMPTY_USAGE, calls: 1, errors: 1 });
  }
});

test('api failure is no answer and the log has no key', async () => {
  // The OpenAI error text sometimes carries a piece of the key: only the exception class name
  // may reach the log.
  const { judge } = make([
    new TypeError('Incorrect API key provided: sk-proj-secret'),
    new RangeError('sk-proj-secret'),
  ]);
  const from = capturedStdout.length;
  assert.strictEqual(await judge.semanticEnd('Yes.'), null);
  assert.strictEqual(await judge.intent('wait, stop', PLAYING), null);
  assert.deepStrictEqual(judge.usage, { ...EMPTY_USAGE, calls: 2, errors: 2 });
  const logText = capturedStdout.slice(from).join('');
  assert.ok(logText.includes('TypeError'));
  assert.ok(logText.includes('RangeError'));
  assert.ok(!logText.includes('sk-proj-secret'));
});

test('SDK errors without a name still log their real class', async () => {
  // Mirrors real OpenAI SDK error classes (RateLimitError, AuthenticationError, ...), which
  // don't override `.name` — it stays the inherited "Error" — so only `.constructor.name`
  // reveals the real class. Still never the message.
  class RateLimitError extends Error {}
  const { judge } = make([new RateLimitError('quota exceeded for key sk-proj-secret')]);
  const from = capturedStdout.length;
  assert.strictEqual(await judge.semanticEnd('Yes.'), null);
  const logText = capturedStdout.slice(from).join('');
  assert.ok(logText.includes('RateLimitError'));
  assert.ok(!logText.includes('sk-proj-secret'));
});

test('slow answer is dropped at the timeout', async () => {
  // A verdict past the deadline is useless: the turn-taking core decides on its own instead of
  // holding the line. Both classifiers are awaited concurrently so this test costs one
  // TIMEOUT_MS (~2.5s) of wall time rather than two; TIMEOUT_MS is kept as the plain 2500 the
  // contract specifies (not injected for the test) since one timeout's wait is not unreasonable.
  const { judge } = make(
    [reply({ complete: true, confidence: 1.0 }), reply({ intent: 'ack', confidence: 1.0 })],
    { delayMs: TIMEOUT_MS + 5000 },
  );
  const started = performance.now();
  const [endResult, intentResult] = await Promise.all([
    judge.semanticEnd('Yes.'),
    judge.intent('ага', PLAYING),
  ]);
  const elapsed = performance.now() - started;
  assert.strictEqual(endResult, null);
  assert.strictEqual(intentResult, null);
  assert.ok(elapsed >= TIMEOUT_MS - 200, `expected elapsed >= ~${TIMEOUT_MS}ms, got ${elapsed}`);
  assert.ok(elapsed < TIMEOUT_MS + 2000, `expected the call to not hang, got ${elapsed}`);
  assert.deepStrictEqual(judge.usage, { ...EMPTY_USAGE, calls: 2, errors: 2 });
});

test('the deadline fires even when the client ignores the abort signal', async () => {
  // The 2.5s limit must not depend on the client honouring `signal`: this fake never settles and
  // never even looks at `options`, so only judge.ts's own independent timer can end the call.
  const neverSettles: ChatClientLike = {
    chat: { completions: { create: () => new Promise(() => {}) } },
  };
  const judge = new Judge(neverSettles, { languages: ['English', 'Russian'] });
  const started = performance.now();
  const result = await judge.semanticEnd('Yes.');
  const elapsed = performance.now() - started;
  assert.strictEqual(result, null);
  assert.ok(elapsed >= TIMEOUT_MS - 200, `expected elapsed >= ~${TIMEOUT_MS}ms, got ${elapsed}`);
  assert.ok(elapsed < TIMEOUT_MS + 2000, `expected the call to not hang, got ${elapsed}`);
  assert.deepStrictEqual(judge.usage, { ...EMPTY_USAGE, calls: 1, errors: 1 });
});

test('empty text is not sent', async () => {
  for (const text of ['', '   ', '\n\t ']) {
    const { judge, client } = make([]);
    assert.strictEqual(await judge.semanticEnd(text), null);
    assert.strictEqual(await judge.intent(text, PLAYING), null);
    assert.deepStrictEqual(client.requests, []);
    assert.deepStrictEqual(judge.usage, EMPTY_USAGE);
    assert.strictEqual(judge.costUsd(), 0);
  }
});

test('usage is counted from every answer and priced', async () => {
  const { judge } = make([
    reply(
      { complete: true, confidence: 0.9 },
      { prompt_tokens: 1000, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 400 } },
    ),
    reply({ intent: 'later', confidence: 0.7 }, { prompt_tokens: 500, completion_tokens: 8 }),
    // not parsed, but still paid for: the tokens count regardless
    reply('garbled', { prompt_tokens: 300, completion_tokens: null, prompt_tokens_details: { cached_tokens: null } }),
    reply({ complete: false, confidence: 0.5 }), // no usage at all
  ]);
  assert.deepStrictEqual(await judge.semanticEnd('I spoke with the customer yesterday.'), [true, 0.9]);
  assert.deepStrictEqual(await judge.intent('and how much will it cost', PLAYING), ['later', 0.7]);
  assert.strictEqual(await judge.semanticEnd('Деньги вернут в пятницу.'), null);
  assert.deepStrictEqual(await judge.semanticEnd('I need the washer, the dryer and'), [false, 0.5]);
  assert.deepStrictEqual(judge.usage, { calls: 4, errors: 1, in: 1800, cached: 400, out: 18 });
  // caller's pricing table has no cached-input discount (usage.cached is still counted above, just unpriced)
  assert.strictEqual(judge.costUsd(), calculateLLMCost(JUDGE_MODEL, 1800, 18));
});

test('prompts name both languages and stay short', async () => {
  // The language pair comes from the call's settings, not baked into the prompt. The prompt
  // stays short: the judge answers while the line is paused, and every extra hundred words is
  // delay before the translation.
  const { judge, client } = make(
    [reply({ complete: true, confidence: 1.0 }), reply({ intent: 'ack', confidence: 1.0 })],
    { languages: ['Spanish', 'Armenian'] },
  );
  await judge.semanticEnd('Sí.');
  await judge.intent('vale', 'Կվճարեն ուրբաթ օրը։');
  assert.strictEqual(client.requests.length, 2);
  for (const kw of client.requests) {
    const system = kw.messages[0].content as string;
    assert.ok(system.includes('Spanish') && system.includes('Armenian'));
    assert.ok(system.includes('punctuation')); // live transcript: the final period may be missing
    assert.ok(system.split(/\s+/).filter(Boolean).length <= 140);
  }
});
