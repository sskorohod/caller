// V2 — translation as a pipeline: live transcript → text translation → speech, ahead, while the person speaks.
//
// No network: the OpenAI client is a fake whose answers and pauses the tests set. We check what goes to
// translation and when, the order of the audio, the end of an utterance, cancellation and the bill. How the
// translation sounds is measured on the live API, not here.
//
// Port of aidispatch tests/test_consecutive_engine_v2.py (9e4b1eb), then caller's own tests at the end.
import { afterEach, beforeEach, test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { TONE_INSTRUCTIONS } from '../../config/languages.js';
import {
  CascadeEngine, log, PhraseChunker, resolveVoice, timing, TTS_CHUNK, TTS_INSTRUCTIONS, type EngineOptions,
} from './engine.js';

log.level = 'silent';   // tests read the log through captureLog(), not from stdout

// "Раз." translated into two phrases: eight words up to the comma — the first, the rest — the second
const LONG = 'One two three four five six seven eight, nine ten eleven twelve.';
const P1 = 'One two three four five six seven eight,';
const P2 = 'nine ten eleven twelve.';
const made: CascadeEngine[] = [];
const defaults = { ...timing };

// --- the fake OpenAI ------------------------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** asyncio.sleep(0): one turn of the event loop — and, like it, a point where a cancellation lands. */
async function tick(signal?: AbortSignal): Promise<void> {
  await new Promise<void>(resolve => setImmediate(resolve));
  signal?.throwIfAborted();
}

/** asyncio.Event: set() lets every waiter through; a waiter whose signal aborts leaves with its reason. */
class Gate {
  private isSet = false;
  private waiters: Array<() => void> = [];

  set(): void {
    this.isSet = true;
    for (const wake of this.waiters.splice(0)) wake();
  }

  wait(signal?: AbortSignal): Promise<void> {
    if (this.isSet) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(signal!.reason);
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
      this.waiters.push(() => { signal?.removeEventListener('abort', onAbort); resolve(); });
    });
  }
}

const textChunk = (content: string) => ({ choices: [{ delta: { content } }], usage: null });

/** The last chunk of a stream with include_usage: no choice in it, only the usage. */
const usageChunk = (prompt: number, cached: number, completion: number) => ({
  choices: [],
  usage: { prompt_tokens: prompt, completion_tokens: completion, prompt_tokens_details: { cached_tokens: cached } },
});

/** The new unit — the last line of the user message. */
const unitOf = (request: any): string => (request.messages.at(-1).content as string).split('\n').at(-1)!;

/**
 * A phrase's sound in the fake — the bytes of its text, in two chunks: they show what sounded and in what
 * order. Whole PCM16 samples, as the real endpoint sends them: odd text gets a padding byte and the halves are
 * cut at an even byte, because the engine passes on whole samples only.
 */
function pcm(phrase: string): Buffer[] {
  let data = Buffer.from(phrase);
  if (data.length % 2) data = Buffer.concat([data, Buffer.from(' ')]);
  const cut = Math.floor(data.length / 4) * 2;
  return [data.subarray(0, cut), data.subarray(cut)];
}
const join = (...sounds: Buffer[][]) => Buffer.concat(sounds.flat());

type Usage = [number, number, number];

/** Chat Completions and speech, both streaming. The translation defaults to "[unit]". */
class FakeOpenAI {
  readonly translations: Record<string, string>;
  readonly usage: Usage | null;                  // null — a stream without the last chunk with the usage
  readonly audioFor: Record<string, Buffer[]>;   // phrase → chunks of sound
  readonly failUnits: Record<string, Error> = {};
  readonly failPhrases: Record<string, Error> = {};
  readonly unitGates = new Map<string, Gate>();     // a unit's translation waits until its gate opens
  readonly phraseGates = new Map<string, Gate>();   // `${phrase}#${chunk number}`
  hangOnClose = false;
  readonly releaseClose = new Gate();
  readonly chatCalls: any[] = [];
  readonly chatOptions: any[] = [];
  readonly ttsCalls: any[] = [];
  readonly ttsOptions: any[] = [];
  readonly ttsFinished: string[] = [];
  chatClosed = 0;
  chatCompleted = 0;
  ttsActive = 0;
  ttsPeak = 0;
  readonly chat = { completions: { create: (body: any, options?: any) => this.chatCreate(body, options) } };
  readonly audio = { speech: { create: (body: any, options?: any) => this.speech(body, options) } };

  constructor(
    translations: Record<string, string> = {},
    { usage = [100, 0, 20], audio = {} }: { usage?: Usage | null; audio?: Record<string, Buffer[]> } = {},
  ) {
    this.translations = { ...translations };
    this.usage = usage;
    this.audioFor = { ...audio };
  }

  unitGate(unit: string): Gate {
    const gate = new Gate();
    this.unitGates.set(unit, gate);
    return gate;
  }

  phraseGate(phrase: string, chunk: number): Gate {
    const gate = new Gate();
    this.phraseGates.set(`${phrase}#${chunk}`, gate);
    return gate;
  }

  private async chatCreate(body: any, options?: { signal?: AbortSignal }): Promise<any> {
    this.chatCalls.push(body);
    this.chatOptions.push(options);
    const unit = unitOf(body);
    if (unit in this.failUnits) throw this.failUnits[unit];
    const stream = this.stream(unit, this.translations[unit] ?? `[${unit}]`, options?.signal);
    return Object.assign(stream, { controller: { abort() {} } });
  }

  private async *stream(unit: string, translation: string, signal?: AbortSignal) {
    try {
      yield textChunk('');                                  // the first chunk carries only the role
      await this.unitGates.get(unit)?.wait(signal);
      for (const piece of translation.match(/\s*\S+/g) ?? []) {   // word by word, like the model
        yield textChunk(piece);
        await tick(signal);
      }
      if (this.usage) yield usageChunk(...this.usage);
      this.chatCompleted += 1;
    } catch (err) {
      if (this.hangOnClose) await this.releaseClose.wait();   // the cancel caught the stream, and it will not close
      throw err;
    } finally {
      this.chatClosed += 1;
    }
  }

  private async speech(body: any, options?: { signal?: AbortSignal }): Promise<any> {
    this.ttsCalls.push(body);
    this.ttsOptions.push(options);
    if (body.input in this.failPhrases) throw this.failPhrases[body.input];
    return { body: this.sound(body.input, options?.signal) };
  }

  /** The response body: sound in chunks. Active while it streams (in Python: inside `async with`). */
  private async *sound(phrase: string, signal?: AbortSignal) {
    this.ttsActive += 1;
    this.ttsPeak = Math.max(this.ttsPeak, this.ttsActive);
    try {
      const chunks = this.audioFor[phrase] ?? pcm(phrase);
      for (let i = 0; i < chunks.length; i++) {
        await this.phraseGates.get(`${phrase}#${i}`)?.wait(signal);
        yield chunks[i];
        await tick(signal);
      }
      this.ttsFinished.push(phrase);
    } finally {
      this.ttsActive -= 1;
    }
  }
}

type Event = ['audio', number, Buffer] | ['text', number, string] | ['done', number];

/** Everything the engine gave the core, on one tape: it shows both the order of the audio and where onDone fell. */
class Recorder {
  readonly events: Event[] = [];
  readonly onAudio = (utt: number, data: Buffer) => { this.events.push(['audio', utt, data]); };
  readonly onText = (utt: number, text: string) => { this.events.push(['text', utt, text]); };
  readonly onDone = (utt: number) => { this.events.push(['done', utt]); };
  readonly skipped: Array<[number, string]> = [];
  readonly onSkipped = (utt: number, source: string) => { this.skipped.push([utt, source]); };

  audio(utt: number): Buffer {
    return Buffer.concat(this.events.filter(e => e[0] === 'audio' && e[1] === utt).map(e => e[2] as Buffer));
  }

  text(utt: number): string {
    return this.events.filter(e => e[0] === 'text' && e[1] === utt).map(e => e[2]).join('');
  }

  kinds(utt: number): string[] {
    return this.events.filter(e => e[1] === utt).map(e => e[0]);
  }

  doneCount(utt: number): number {
    return this.kinds(utt).filter(kind => kind === 'done').length;
  }
}

function make(client = new FakeOpenAI(), kw: Partial<EngineOptions> = {}) {
  const rec = new Recorder();
  const engine = new CascadeEngine({
    client, langA: 'en', langB: 'ru',
    onAudio: rec.onAudio, onText: rec.onText, onDone: rec.onDone, onSkipped: rec.onSkipped, ...kw,
  });
  made.push(engine);
  return { engine, client, rec };
}

/** Wait until the background tasks have done their part. Sleeping at random won't do: the tests would get slow and brittle. */
async function until(condition: () => unknown, timeout = 1.0): Promise<void> {
  const deadline = performance.now() + timeout * 1000;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error('condition not reached in time');
    await sleep(1);
  }
}

/** The engine's warnings — what caplog gives the Python tests. */
function captureLog(t: TestContext): string[] {
  const lines: string[] = [];
  t.mock.method(log as any, 'warn', (...args: unknown[]) => { lines.push(JSON.stringify(args)); });
  return lines;
}

/** Dollars: equal up to floating-point noise. */
function near(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} ≈ ${expected}`);
}

class RuntimeError extends Error { name = 'RuntimeError'; }
class ConnectionError extends Error { name = 'ConnectionError'; }
class ValueError extends Error { name = 'ValueError'; }

beforeEach(() => {
  timing.SETTLE_S = 0.02;   // we check the order of decisions, not the clock
  made.length = 0;
});

afterEach(async () => {
  for (const engine of made) await engine.aclose();
  Object.assign(timing, defaults);
});

// --- cutting into phrases for speech -----------------------------------------------------------------------

test('chunker cuts at the last mark once the phrase has enough words', () => {
  const c = new PhraseChunker(8, 20);
  assert.deepEqual(c.feed('One, two three four five'), []);          // a mark, but too few words
  assert.deepEqual(c.feed(' six seven eight; nine'), ['One, two three four five six seven eight;']);
  assert.deepEqual(c.feed(' ten.'), []);                              // a period at the very end may still become "10.5"
  assert.deepEqual(c.flush(), ['nine ten.']);
  assert.deepEqual(c.flush(), []);
});

test('chunker takes the last boundary when a big piece arrives at once', () => {
  const c = new PhraseChunker();
  assert.deepEqual(c.feed('a b c d e f g h, i j k l m n o p, q r'), ['a b c d e f g h, i j k l m n o p,']);
  assert.deepEqual(c.flush(), ['q r']);
});

test('chunker forces a cut at max words and prefers a mark', () => {
  const c = new PhraseChunker(8, 20);
  const twenty = Array.from({ length: 20 }, (_, i) => `w${i + 1}`);
  assert.deepEqual(c.feed('So, ' + twenty.join(' ') + ' more'), ['So,', twenty.join(' ')]);
  assert.deepEqual(c.flush(), ['more']);
});

test('chunker forces a cut at max words without any mark', () => {
  const c = new PhraseChunker(8, 20);
  const w = Array.from({ length: 25 }, (_, i) => `w${i + 1}`);
  assert.deepEqual(c.feed(w.join(' ')), [w.slice(0, 20).join(' ')]);
  assert.deepEqual(c.flush(), [w.slice(20).join(' ')]);
});

test('a Chinese translation is cut into phrases, and only at its marks', () => {
  // TOKEN matched a space-free run as ONE token, so `ends` held a single entry, the "may still grow" pop
  // emptied it and cut() returned null for ever: zh and ja never streamed at all. The whole sentence had to
  // finish before any speech began, and one failed speech request then dropped the WHOLE sentence where it
  // drops one phrase in English — the opposite of what the engine trades for.
  const c = new PhraseChunker();
  const text = '您好，我是口译员，冰箱的压缩机坏了，需要更换零件，大概需要两百八十美元。';
  const out: string[] = [];
  for (let i = 0; i < text.length; i += 4) out.push(...c.feed(text.slice(i, i + 4)));
  out.push(...c.flush());
  assert.ok(out.length >= 2, JSON.stringify(out));
  assert.equal(out.join(''), text);                      // nothing lost, nothing said twice
  for (const phrase of out.slice(0, -1)) {
    assert.ok('，、；：。？！'.includes(phrase.at(-1)!), phrase);   // every boundary is a mark
  }
});

test('an unpunctuated Chinese sentence is left whole rather than force-cut mid-word', () => {
  // One CJK token is one character, so maxWords falls inside an ordinary sentence. The naive fix split
  // 冰箱 across two speech requests and the model read it as two unrelated syllables.
  const c = new PhraseChunker();
  const text = '冰箱的压缩机坏了需要更换零件大概需要两百八十美元还要加上上门费用';
  const out: string[] = [];
  for (let i = 0; i < text.length; i += 4) out.push(...c.feed(text.slice(i, i + 4)));
  assert.deepEqual(out, []);
  assert.deepEqual(c.flush(), [text]);
});

test('a Japanese translation streams on its wide marks too', () => {
  const c = new PhraseChunker();
  const text = 'こんにちは、通訳です。冷蔵庫のコンプレッサーが壊れました、部品の交換が必要です。';
  const out: string[] = [];
  for (let i = 0; i < text.length; i += 4) out.push(...c.feed(text.slice(i, i + 4)));
  out.push(...c.flush());
  assert.ok(out.length >= 2, JSON.stringify(out));
  assert.equal(out.join(''), text);
});

test('chunker cuts at a mark only after the space behind it arrived', () => {
  // The model streams a number in pieces: "$1," and "500" come separately. A mark is a place to cut only once
  // the space behind it has come, or speech would say "one" and "five hundred" as two phrases.
  const c = new PhraseChunker(2, 20);
  assert.deepEqual(c.feed('The repair costs $1'), []);
  assert.deepEqual(c.feed(','), []);
  assert.deepEqual(c.feed('500 in total, parts'), ['The repair costs $1,500 in total,']);
  assert.deepEqual(c.flush(), ['parts']);
});

test('chunker never emits empty or mark-only phrases', () => {
  const c = new PhraseChunker(1, 3);
  assert.deepEqual(c.feed('   '), []);
  assert.deepEqual(c.flush(), []);
  assert.deepEqual(c.feed(' — '), []);
  assert.deepEqual(c.flush(), []);
  assert.deepEqual(c.feed('…'), []);
  assert.deepEqual(c.flush(), []);
  assert.deepEqual(c.feed('Yes.'), []);
  assert.deepEqual(c.flush(), ['Yes.']);
});

// --- what goes to translation, and when -------------------------------------------------------------------

test('sentences go to translation as soon as they are finished', async () => {
  const { engine, client, rec } = make();
  engine.opened(1, 'ru', false);
  engine.updated(1, 'Мастер приедет');
  engine.updated(1, 'Мастер приедет завтра');
  await sleep(50);
  assert.deepEqual(client.chatCalls, []);                     // the sentence has not ended yet
  engine.updated(1, 'Мастер приедет завтра. Он');
  await until(() => client.chatCalls.length === 1);
  assert.equal(unitOf(client.chatCalls[0]), 'Мастер приедет завтра.');
  engine.updated(1, 'Мастер приедет завтра. Он позвонит за час?');
  // "?" at the very end does not wait: it never occurs inside words
  await until(() => client.chatCalls.length === 2);
  assert.equal(unitOf(client.chatCalls[1]), 'Он позвонит за час?');
  assert.equal(engine.usage.units, 2);
  assert.equal(rec.doneCount(1), 0);                          // not released — more sound may come
});

test('a period at the very end waits until the text settles', async () => {
  // Transcript pieces are smaller than a word: "10 a." will still become "10 a.m.", "3." — "3.5". A period at
  // the very end ends a sentence only if the text stood SETTLE_S without new pieces.
  timing.SETTLE_S = 0.2;
  const { engine, client } = make();
  engine.opened(1, 'en', false);
  engine.updated(1, 'Can you come at 10 a.');
  await sleep(50);
  engine.updated(1, 'Can you come at 10 a.m.');
  await sleep(100);
  assert.deepEqual(client.chatCalls, []);
  await until(() => client.chatCalls.length > 0);
  assert.deepEqual(client.chatCalls.map(unitOf), ['Can you come at 10 a.m.']);
});

test('release sends the rest even without a final mark', async () => {
  const { engine, client, rec } = make();
  engine.opened(1, 'en', false);
  engine.updated(1, 'Hello there. I think');
  await until(() => client.chatCalls.length === 1);
  engine.released(1, 'Hello there. I think we should wait');
  await until(() => rec.doneCount(1) === 1);
  assert.deepEqual(client.chatCalls.map(unitOf), ['Hello there.', 'I think we should wait']);
  assert.deepEqual(rec.audio(1), join(pcm('[Hello there.]'), pcm('[I think we should wait]')));
});

test('units are translated one after another with the earlier one as context', async () => {
  const client = new FakeOpenAI({ 'Мастер приедет завтра.': 'The technician will come tomorrow.' });
  const gate = client.unitGate('Мастер приедет завтра.');
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.updated(1, 'Мастер приедет завтра. Он');
  engine.updated(1, 'Мастер приедет завтра. Он позвонит за час. Если');
  await until(() => client.chatCalls.length === 1);
  await sleep(20);
  assert.equal(client.chatCalls.length, 1, 'the second unit waits until the first is translated');
  gate.set();
  await until(() => client.chatCalls.length === 2);
  const first = client.chatCalls[0].messages[1].content as string;
  const second = client.chatCalls[1].messages[1].content as string;
  assert.ok(!first.includes('The technician'));
  assert.equal(unitOf(client.chatCalls[1]), 'Он позвонит за час.');
  const at = (part: string) => {
    const i = second.indexOf(part);
    assert.ok(i >= 0, part);
    return i;
  };
  assert.ok(at('Мастер приедет завтра.') < at('The technician will come tomorrow.'));
  assert.ok(at('The technician will come tomorrow.') < at('Он позвонит за час.'));
  // the translation text goes to the core in pieces as it streams: the echo filter knows our voice by it
  await until(() => rec.text(1).endsWith('[Он позвонит за час.]'));
  // a space between units: calls on 24.09 wrote "now.And", "спал.Хорошо." into the call card
  assert.equal(rec.text(1), 'The technician will come tomorrow. [Он позвонит за час.]');
});

test('context is the last three units of the same utterance', async () => {
  const { engine, client } = make();
  engine.opened(1, 'en', false);
  const questions = [1, 2, 3, 4, 5].map(i => `Is part ${i} here?`);
  for (let i = 1; i <= 5; i++) {
    engine.updated(1, questions.slice(0, i).join(' '));
    await until(() => client.chatCalls.length === i);
  }
  const last = client.chatCalls.at(-1).messages[1].content as string;
  assert.ok(!last.includes('part 1'));
  for (const i of [2, 3, 4]) assert.ok(last.includes(`Is part ${i} here?`) && last.includes(`[Is part ${i} here?]`));
  assert.equal(unitOf(client.chatCalls.at(-1)), 'Is part 5 here?');
  const firstUser = client.chatCalls[0].messages[1].content as string;
  assert.ok(!firstUser.slice(0, firstUser.lastIndexOf('\n')).includes('Is part'));
});

for (const [lang, text, direction] of [
  ['ru', 'Да.', 'from Russian into English'],
  ['en', 'Yes.', 'from English into Russian'],
] as const) {
  test(`direction follows the language of the utterance (${lang})`, async () => {
    const { engine, client } = make();
    engine.opened(1, lang, false);
    engine.released(1, text);
    await until(() => client.chatCalls.length > 0);
    assert.ok((client.chatCalls[0].messages[0].content as string).includes(direction));
  });
}

test('without a language the model translates into the other one', async () => {
  const { engine, client } = make();
  engine.opened(1, null, false);
  engine.released(1, 'Да.');
  engine.released(2, 'Привет.');              // opened never came: translate anyway, without a language hint
  await until(() => client.chatCalls.length === 2);
  for (const request of client.chatCalls) {
    const system = request.messages[0].content as string;
    assert.ok(system.includes('between English and Russian') && system.includes('whichever'));
    assert.ok(!system.includes('from Russian'));
  }
});

test('a candidate is not translated until the floor accepts it', async () => {
  const { engine, client, rec } = make();
  engine.opened(7, 'ru', true);
  await sleep(20);
  assert.deepEqual(client.chatCalls, []);
  assert.deepEqual(rec.events, []);
  engine.updated(7, 'Нет, подождите. Я');     // the first updated to a candidate is the core accepting it
  await until(() => client.chatCalls.length > 0);
  assert.equal(unitOf(client.chatCalls[0]), 'Нет, подождите.');
});

test('a rewritten start is not translated twice and no new word is lost', async () => {
  // The core recomputes an accepted candidate's text through the echo filter as a whole: a word taken for our
  // echo drops out of the middle. What was sent is not translated again, and no new word is lost.
  const { engine, client } = make();
  engine.opened(1, 'ru', false);
  engine.updated(1, 'Нет, это не так. Мастер');
  await until(() => client.chatCalls.length === 1);
  engine.updated(1, 'Нет, это так. Мастер приедет завтра. Хорошо');
  await until(() => client.chatCalls.length === 2);
  assert.equal(unitOf(client.chatCalls[1]), 'Мастер приедет завтра.');
});

// --- sound ---------------------------------------------------------------------------------------------------

test('audio keeps phrase order even when the second phrase is ready first', async () => {
  const client = new FakeOpenAI({ 'Раз.': LONG });
  const gate = client.phraseGate(P1, 0);
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.released(1, 'Раз.');
  await until(() => client.ttsFinished.length === 1 && client.ttsFinished[0] === P2);
  assert.equal(rec.audio(1).length, 0);                       // the second is ready, but the first is still silent
  gate.set();
  await until(() => rec.doneCount(1) === 1);
  assert.deepEqual(rec.audio(1), join(pcm(P1), pcm(P2)));
  assert.deepEqual(client.ttsCalls.map(c => c.input), [P1, P2]);
});

test('the head phrase streams before it is complete', async () => {
  const client = new FakeOpenAI({ 'Раз.': LONG });
  const gate = client.phraseGate(P1, 1);
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.released(1, 'Раз.');
  await until(() => rec.audio(1).equals(pcm(P1)[0]));
  assert.ok(!client.ttsFinished.includes(P1));
  gate.set();
  await until(() => rec.doneCount(1) === 1);
  assert.deepEqual(rec.audio(1), join(pcm(P1), pcm(P2)));
});

test('no more than two phrases are synthesized at once', async () => {
  const translation = 'a1 a2 a3 a4 a5 a6 a7 a8, b1 b2 b3 b4 b5 b6 b7 b8, c1 c2 c3 c4 c5 c6 c7 c8, d1 d2.';
  const phrases = ['a1 a2 a3 a4 a5 a6 a7 a8,', 'b1 b2 b3 b4 b5 b6 b7 b8,', 'c1 c2 c3 c4 c5 c6 c7 c8,', 'd1 d2.'];
  const client = new FakeOpenAI({ 'Раз.': translation });
  const gates = phrases.map(p => client.phraseGate(p, 0));
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.released(1, 'Раз.');
  await until(() => client.ttsCalls.length === 2);
  await sleep(20);
  assert.equal(client.ttsCalls.length, 2);
  assert.equal(client.ttsPeak, 2);
  for (const gate of gates) gate.set();
  await until(() => rec.doneCount(1) === 1);
  assert.deepEqual(client.ttsCalls.map(c => c.input), phrases);
  assert.equal(client.ttsPeak, 2);
  assert.deepEqual(rec.audio(1), join(...phrases.map(pcm)));
});

// --- the end of an utterance -----------------------------------------------------------------------------------

test('on_done comes exactly once after all the audio', async () => {
  const { engine, rec } = make(new FakeOpenAI({ 'Раз.': LONG }));
  engine.opened(1, 'ru', false);
  engine.updated(1, 'Раз. Два');
  engine.released(1, 'Раз. Два три.');
  await until(() => rec.doneCount(1) === 1);
  await sleep(20);
  const kinds = rec.kinds(1);
  assert.equal(kinds.filter(kind => kind === 'done').length, 1);
  assert.equal(kinds.at(-1), 'done');
  assert.deepEqual(rec.audio(1), join(pcm(P1), pcm(P2), pcm('[Два три.]')));
});

test('no on_done before release and at once when nothing is left', async () => {
  const { engine, client, rec } = make();
  engine.opened(1, 'en', false);
  engine.updated(1, 'Yes?');
  await until(() => client.ttsFinished.length > 0 && rec.audio(1).length > 0);
  await sleep(20);
  assert.equal(rec.doneCount(1), 0);                          // the thought is not finished: more sound may come
  engine.released(1, 'Yes?');                                // everything is already translated and spoken
  assert.equal(rec.doneCount(1), 1);                          // at once, within the same call
  engine.opened(2, 'en', false);
  engine.released(2, '');
  assert.equal(rec.doneCount(2), 1);
  assert.equal(client.chatCalls.length, 1);
});

test('a late tail is spoken before on_done', async () => {
  // The transcript brings the last words after the release, and in pieces: they are translated as one unit once
  // the text settles, and onDone comes only after their sound.
  const client = new FakeOpenAI();
  const gate = client.unitGate('Встретимся в');
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.released(1, 'Встретимся в');
  engine.updated(1, 'Встретимся в два');
  engine.updated(1, 'Встретимся в два часа.');
  gate.set();
  await until(() => rec.doneCount(1) === 1);
  await sleep(50);
  assert.deepEqual(client.chatCalls.map(unitOf), ['Встретимся в', 'два часа.']);
  assert.equal(rec.doneCount(1), 1);
  assert.equal(rec.kinds(1).at(-1), 'done');
  assert.deepEqual(rec.audio(1), join(pcm('[Встретимся в]'), pcm('[два часа.]')));
});

test('a tail after on_done is spoken and followed by another on_done', async () => {
  const { engine, rec } = make();
  engine.opened(1, 'ru', false);
  engine.released(1, 'Встретимся в');
  await until(() => rec.doneCount(1) === 1);
  engine.updated(1, 'Встретимся в два.');
  await until(() => rec.doneCount(1) === 2);
  assert.equal(rec.kinds(1).at(-1), 'done');
  assert.deepEqual(rec.audio(1), join(pcm('[Встретимся в]'), pcm('[два.]')));
});

// --- cancellation and failures ------------------------------------------------------------------------------------

for (const how of ['dropped', 'stopped'] as const) {
  test(`a dropped or stopped utterance goes silent and its work is cancelled (${how})`, async () => {
    const client = new FakeOpenAI({ 'Раз.': LONG });
    const head = client.phraseGate(P1, 1);
    const tail = client.unitGate('Два три.');
    const { engine, rec } = make(client);
    engine.opened(1, 'ru', false);
    engine.opened(2, 'en', false);
    engine.updated(1, 'Раз. Два');
    engine.released(1, 'Раз. Два три.');
    // the head sounds, the tail is in translation
    await until(() => rec.audio(1).length > 0 && client.chatCalls.length === 2);
    const before = rec.events.filter(e => e[1] === 1);
    engine[how](1);
    head.set();
    tail.set();
    await until(() => client.ttsActive === 0 && client.chatClosed === 2);
    await sleep(20);
    // the work was cut off, not just muted: nobody waits at the opened gates any more
    assert.equal(client.chatCompleted, 1);
    assert.ok(!client.ttsFinished.includes(P1));
    engine.updated(1, 'Раз. Два три. Четыре.');
    engine.released(1, 'Раз. Два три. Четыре.');
    await sleep(50);
    assert.deepEqual(rec.events.filter(e => e[1] === 1), before);
    assert.equal(client.chatCalls.length, 2);
    engine.released(2, 'Other one.');                         // the neighbouring utterance lives its own life
    await until(() => rec.doneCount(2) === 1);
  });
}

test('a failed unit is skipped and the utterance still ends', async (t) => {
  const records = captureLog(t);
  const client = new FakeOpenAI();
  client.failUnits['Два.'] = new RuntimeError('Incorrect API key provided: sk-live-SECRET');
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.updated(1, 'Раз. Два');
  engine.updated(1, 'Раз. Два. Три');
  engine.released(1, 'Раз. Два. Три.');
  await until(() => rec.doneCount(1) === 1);
  // Nothing streamed on the first ask, so nothing had reached the room or the echo filter: the unit is asked
  // for once more before it is given up. The caller still hears the sentences around it and not this one —
  // but now the turn carries which sentence was lost instead of looking complete.
  assert.deepEqual(client.chatCalls.map(unitOf), ['Раз.', 'Два.', 'Два.', 'Три.']);
  assert.deepEqual(rec.audio(1), join(pcm('[Раз.]'), pcm('[Три.]')));
  assert.deepEqual(rec.skipped, [[1, 'Два.']]);
  assert.equal(engine.usage.retried, 1);
  assert.equal(engine.usage.lost, 1);
  assert.ok(!(client.chatCalls[3].messages[1].content as string).includes('Два.'));   // a failed unit is no context
  assert.equal(engine.usage.errors, 2);   // the first ask and the retry
  const logged = records.join(' ');
  assert.ok(logged.includes('RuntimeError') && !logged.includes('sk-live'));
});

test('a failed phrase is skipped and the rest still plays', async (t) => {
  const records = captureLog(t);
  const client = new FakeOpenAI({ 'Раз.': LONG });
  client.failPhrases[P1] = new ConnectionError('sk-live-SECRET');
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.released(1, 'Раз.');
  await until(() => rec.doneCount(1) === 1);
  assert.deepEqual(rec.audio(1), join(pcm(P2)));
  assert.equal(engine.usage.errors, 1);
  const logged = records.join(' ');
  assert.ok(logged.includes('ConnectionError') && !logged.includes('sk-live'));
});

test('a failure is logged by its class even when the SDK leaves the name "Error"', async (t) => {
  class RateLimitError extends Error {}                       // openai-node's error classes do not set .name
  const records = captureLog(t);
  const client = new FakeOpenAI({ 'Раз.': LONG });
  client.failUnits['Два.'] = new RateLimitError('429 for sk-live-SECRET');
  client.failPhrases[P1] = new RateLimitError('429 for sk-live-SECRET');
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.updated(1, 'Раз. Два');
  engine.released(1, 'Раз. Два.');
  await until(() => rec.doneCount(1) === 1);
  await assert.rejects(engine.synthesize(P1));                // the greeting's failure is logged too, then passed on
  assert.equal(records.length, 4);                            // the unit, its retry, the phrase, the greeting
  assert.ok(records.every(r => r.includes('"err":"RateLimitError"') && !r.includes('sk-live')));
});

test('hanging calls time out and only their part is lost', async () => {
  timing.TIMEOUT_S = 0.05;
  const client = new FakeOpenAI();
  client.unitGate('Раз.');                                     // a translation that never comes
  client.phraseGate('[Два.]', 0);                              // and speech that never comes
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.updated(1, 'Раз. Два');
  engine.updated(1, 'Раз. Два. Три');
  engine.released(1, 'Раз. Два. Три.');
  await until(() => rec.doneCount(1) === 1);
  assert.deepEqual(rec.audio(1), join(pcm('[Три.]')));
  assert.equal(engine.usage.errors, 2);
  assert.equal(client.chatClosed, 3);
  assert.equal(client.ttsActive, 0);
});

test('a failing callback does not stop the engine', async (t) => {
  const records = captureLog(t);
  const client = new FakeOpenAI({ 'Раз.': LONG });
  const done: number[] = [];
  const boom = () => { throw new ValueError('core failed'); };
  const engine = new CascadeEngine({ client, langA: 'en', langB: 'ru', onAudio: boom, onText: boom, onDone: u => done.push(u) });
  made.push(engine);
  engine.opened(1, 'ru', false);
  engine.released(1, 'Раз.');
  await until(() => done.length === 1 && done[0] === 1);
  assert.deepEqual(client.ttsCalls.map(c => c.input), [P1, P2]);
  assert.ok(records.join(' ').includes('ValueError'));
});

test('aclose cancels everything quickly and never raises', async () => {
  timing.CLOSE_TIMEOUT_S = 0.1;
  const client = new FakeOpenAI({ 'Раз.': LONG });
  client.unitGate('Два.');
  client.phraseGate(P1, 1);
  client.hangOnClose = true;                                   // the response stream does not close — aclose is on time anyway
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.opened(2, 'en', false);
  engine.updated(1, 'Раз. Два');
  engine.updated(1, 'Раз. Два. Три');
  engine.updated(2, 'Hello there? And');
  await until(() => rec.audio(1).length > 0 && client.chatCalls.length === 3);
  const before = [...rec.events];
  const started = performance.now();
  await engine.aclose();
  assert.ok(performance.now() - started < 500);
  await engine.aclose();                                       // again — nothing
  engine.released(1, 'Раз. Два. Три.');
  engine.opened(3, 'en', false);
  engine.released(3, 'More.');
  await sleep(50);
  assert.deepEqual(rec.events, before);
  assert.equal(client.chatCalls.length, 3);
  client.releaseClose.set();                                   // let the hung stream go, so the test leaves no task behind
  await until(() => client.chatClosed === 3);
});

test('v2 has no line of its own', async () => {
  // No sockets of its own: the text comes from the shared transcript, and start opens nothing.
  const { engine, client, rec } = make();
  assert.equal(engine.name, 'v2');
  assert.equal(await engine.start(), true);
  assert.deepEqual(client.chatCalls, []);
  assert.deepEqual(client.ttsCalls, []);
  assert.deepEqual(rec.events, []);
});

// --- the shape of the requests, and the bill ------------------------------------------------------------------

test('requests have exactly the shape the live API accepted', async () => {
  const client = new FakeOpenAI({ 'Раз.': 'One.' });
  const { engine, rec } = make(client, { voice: 'cedar' });
  engine.opened(1, 'ru', false);
  engine.released(1, 'Раз.');
  await until(() => rec.doneCount(1) === 1);
  const kw = client.chatCalls[0];
  assert.deepEqual(Object.keys(kw).sort(),
    ['max_completion_tokens', 'messages', 'model', 'reasoning_effort', 'stream', 'stream_options']);
  assert.equal(kw.model, 'gpt-6-luna');
  assert.equal(kw.stream, true);
  assert.deepEqual(kw.stream_options, { include_usage: true });
  assert.equal(kw.reasoning_effort, 'none');
  assert.ok(kw.max_completion_tokens >= 64);
  assert.deepEqual(kw.messages.map((m: any) => m.role), ['system', 'user']);
  const system = kw.messages[0].content as string;
  for (const must of ['consecutive interpreter', 'from Russian into English', 'names, numbers', 'Do not answer',
    'NEW part', 'speech-to-text']) {
    assert.ok(system.includes(must), must);
  }
  assert.deepEqual(client.ttsCalls, [{ model: 'gpt-4o-mini-tts', voice: 'cedar', input: 'One.',
    instructions: TTS_INSTRUCTIONS, response_format: 'pcm' }]);
  // Python asked httpx for even chunks (iter_bytes(4800)); here the engine re-cuts the body itself:
  // whole PCM16 samples, never more than TTS_CHUNK at a time. Every call can be cut off by its signal.
  const sound = rec.events.filter(e => e[0] === 'audio').map(e => e[2] as Buffer);
  assert.ok(sound.length > 0 && sound.every(b => b.length > 0 && b.length % 2 === 0 && b.length <= TTS_CHUNK));
  assert.ok(client.chatOptions[0]?.signal instanceof AbortSignal);
  assert.ok(client.ttsOptions[0]?.signal instanceof AbortSignal);
});

test('every SDK call goes without the SDK retries, so the time budget holds', async () => {
  // openai-node looks at the signal only between attempts, and its backoff sleep cannot be cut short: a 429 with
  // retry-after 4 outlived a 0.5 s budget by 3.5 s. This fake honours neither the signal nor retries — it only
  // records what each call was asked for.
  const calls: Array<[string, any]> = [];
  const client = {
    chat: { completions: { create: async (_body: any, options: any) => {
      calls.push(['chat', options]);
      return { controller: { abort() {} }, async *[Symbol.asyncIterator]() { yield { choices: [{ delta: { content: 'One.' } }] }; } };
    } } },
    audio: { speech: { create: async (_body: any, options: any) => {
      calls.push(['speech', options]);
      return { body: (async function* () { yield new Uint8Array(2); })() };
    } } },
  };
  const rec = new Recorder();
  const engine = new CascadeEngine({ client, langA: 'en', langB: 'ru', onAudio: rec.onAudio, onText: rec.onText, onDone: rec.onDone });
  made.push(engine);
  engine.opened(1, 'ru', false);
  engine.released(1, 'Раз.');
  await until(() => rec.doneCount(1) === 1);
  await engine.synthesize('Hello.');                          // the greeting
  assert.deepEqual(calls.map(([kind, options]) => [kind, options?.maxRetries]), [['chat', 0], ['speech', 0], ['speech', 0]]);
  assert.ok(calls.every(([, options]) => options?.signal instanceof AbortSignal));
});

test('the prompt takes the background by characters and the direction literally', async () => {
  const client = new FakeOpenAI();
  const { engine, rec } = make(client, { langB: '$&', personalContext: '😀'.repeat(2001) });
  engine.opened(1, 'en', false);
  engine.released(1, 'Yes.');
  await until(() => rec.doneCount(1) === 1);
  const system = client.chatCalls[0].messages[0].content as string;
  assert.ok(system.includes('from English into $&.'));      // `$&` is not a replacement pattern
  assert.ok(system.endsWith('\n' + '😀'.repeat(2000)));      // 2000 characters, no surrogate pair split in half
});

test('speech reaches the core in whole samples, at most TTS_CHUNK bytes at a time', async () => {
  // The body comes as the network cut it. An odd byte waits for the next chunk, and a dangling last byte —
  // half a sample — is dropped: a broken stream must not shift the next phrase by half a sample.
  const sound = Buffer.from(Array.from({ length: 10_007 }, (_, i) => i % 251));
  const pieces = [sound.subarray(0, 3), sound.subarray(3, 10_004), sound.subarray(10_004)];
  const { engine, rec } = make(new FakeOpenAI({ 'Раз.': 'One.' }, { audio: { 'One.': pieces } }));
  engine.opened(1, 'ru', false);
  engine.released(1, 'Раз.');
  await until(() => rec.doneCount(1) === 1);
  assert.deepEqual(rec.events.filter(e => e[0] === 'audio').map(e => (e[2] as Buffer).length), [2, 4800, 4800, 402, 2]);
  assert.deepEqual(rec.audio(1), sound.subarray(0, 10_006));
  assert.equal(engine.usage.ttsSeconds, 10_006 / 48_000);
});

test('an unknown voice falls back to marin and sol is asked by name', async () => {
  const client = new FakeOpenAI({ 'Раз.': 'One.' });
  const { engine, rec } = make(client, { voice: 'robot', model: 'gpt-6-sol' });
  engine.opened(1, 'ru', false);
  engine.released(1, 'Раз.');
  await until(() => rec.doneCount(1) === 1);
  assert.equal(client.ttsCalls[0].voice, 'marin');
  assert.equal(client.chatCalls[0].model, 'gpt-6-sol');
});

test('costs count tokens at model prices and speech by characters', async () => {
  const minute = [Buffer.alloc(48000 * 30), Buffer.alloc(48000 * 30)];   // 60 s of PCM16 at 24 kHz
  const word = 'O'.repeat(999) + '.';                                     // one phrase of 1000 characters
  const client = new FakeOpenAI({ 'Раз.': word }, { usage: [1000, 200, 500], audio: { [word]: minute } });
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.released(1, 'Раз.');
  await until(() => rec.doneCount(1) === 1);
  assert.deepEqual(engine.usage, {
    units: 1, errors: 0, in: 1000, cached: 200, out: 500, ttsChars: 1000, ttsSeconds: 60,
    drafts: 0, draftsUsed: 0, draftsDropped: 0, retried: 0, lost: 0, cancelled: 0,
  });
  // caller's price table: GPT-6 Luna $0.10 in / $0.50 out per 1M tokens (no discount for cached ones there),
  // speech $0.015 per 1K characters
  const costs = engine.costs();
  near(costs.text, 0.00035);
  near(costs.tts, 0.015);
});

test('costs use sol prices and survive a stream without usage', async () => {
  let { engine, rec } = make(new FakeOpenAI({ 'Раз.': 'One.' }, { usage: [1000, 0, 100] }), { model: 'gpt-6-sol' });
  engine.opened(1, 'ru', false);
  engine.released(1, 'Раз.');
  await until(() => rec.doneCount(1) === 1);
  near(engine.costs().text, 0.003);                           // GPT-6 Sol: $2 in / $10 out per 1M tokens

  const quiet = new FakeOpenAI({ 'Раз.': 'One.' }, { usage: null, audio: { 'One.': [Buffer.alloc(48000)] } });
  ({ engine, rec } = make(quiet));
  engine.opened(1, 'ru', false);
  engine.released(1, 'Раз.');
  await until(() => rec.doneCount(1) === 1);
  const costs = engine.costs();
  assert.equal(costs.text, 0);
  near(costs.tts, 0.00006);                                   // "One.": 4 characters at $0.015 per 1K
  assert.equal(engine.usage.in, 0);
  assert.equal(engine.usage.out, 0);
  assert.equal(engine.usage.units, 1);
  assert.equal(engine.usage.ttsSeconds, 1);
});

test('reopened utterance goes back to translating sentences and is done only after the next release', async () => {
  // Released on a pause, but the person went on before the utterance played: from here it is live speech again.
  const { engine, client, rec } = make();
  engine.opened(1, 'ru', false);
  engine.released(1, 'Мастер приедет завтра.');
  await until(() => rec.doneCount(1) === 1);
  engine.reopened(1);
  engine.updated(1, 'Мастер приедет завтра. Он позвонит за час.');
  await until(() => client.chatCalls.length === 2);
  await sleep(50);
  assert.equal(rec.doneCount(1), 1);                          // after the continuation "done" waits for a new release
  engine.released(1, 'Мастер приедет завтра. Он позвонит за час.');
  await until(() => rec.doneCount(1) === 2);
  assert.deepEqual(client.chatCalls.map(unitOf), ['Мастер приедет завтра.', 'Он позвонит за час.']);
});

test('restart translates the whole thought anew and the old audio never arrives', async () => {
  // The speaker went on in the first seconds of the translation: the old work is cancelled, its late sound never
  // reaches the core, and the thought is translated again from the first word — as one coherent unit together
  // with the continuation.
  const client = new FakeOpenAI();
  const old = '[Мастер приедет завтра.]';
  const gate = client.phraseGate(old, 1);                     // the second half of the old sound is held back
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.released(1, 'Мастер приедет завтра.');
  await until(() => rec.audio(1).equals(pcm(old)[0]));        // half of the old translation is already with the core
  assert.equal(engine.restart(1), true);
  gate.set();
  const mark = rec.events.length;
  const text = 'Мастер приедет завтра, он позвонит за час.';
  engine.reopened(1);
  engine.updated(1, text);
  engine.released(1, text);
  await until(() => rec.doneCount(1) === 1);
  const after = rec.events.slice(mark);
  assert.deepEqual(Buffer.concat(after.filter(e => e[0] === 'audio').map(e => e[2] as Buffer)), join(pcm(`[${text}]`)));
  assert.deepEqual(client.chatCalls.map(unitOf), ['Мастер приедет завтра.', text]);
  assert.equal(engine.restart(7), false);                     // an unknown utterance has nothing to restart
  engine.dropped(1);
  assert.equal(engine.restart(1), false);                     // nor has a dropped one
});

// --- the prepared tail ----------------------------------------------------------------------------------------

test('a tail is prepared in silence and sounds at once when released', async () => {
  // Call of 24.09: "…come back for sign" without a period waited for the release and only then went to
  // translation and speech — 3.1 s to the first sound. The draft: the tail is translated and synthesised while
  // the core decides whether the thought is finished; the engine holds its sound and lets it out as soon as the
  // core releases the utterance with the same words.
  const { engine, client, rec } = make();
  engine.opened(1, 'en', false);
  const tail = 'you can come back for sign';
  engine.updated(1, tail);
  engine.prepare(1, tail);
  await until(() => client.ttsFinished.includes(`[${tail}]`));
  assert.equal(rec.audio(1).length, 0);                       // ready, but not out
  assert.equal(rec.text(1), '');
  assert.equal(rec.doneCount(1), 0);
  engine.released(1, tail + '.');                             // the same words, a period came
  await until(() => rec.doneCount(1) === 1);
  assert.deepEqual(rec.audio(1), join(pcm(`[${tail}]`)));
  assert.equal(rec.text(1), `[${tail}]`);
  assert.deepEqual(client.chatCalls.map(unitOf), [tail]);     // not translated a second time
  assert.deepEqual([engine.usage.drafts, engine.usage.draftsUsed], [1, 1]);
});

test('a continuation drops the draft and the tail is translated with it', async () => {
  // The person went on after the pause: the draft is thrown away, its sound never goes out, and the tail is
  // translated again together with the continuation — as one coherent unit.
  const { engine, client, rec } = make();
  engine.opened(1, 'ru', false);
  const head = 'Мы хотели бы вас предупредить';
  engine.prepare(1, head);
  await until(() => client.ttsFinished.includes(`[${head}]`));
  const whole = head + ', чтобы вы взяли сумку.';
  engine.updated(1, whole);
  engine.released(1, whole);
  await until(() => rec.doneCount(1) === 1);
  assert.deepEqual(rec.audio(1), join(pcm(`[${whole}]`)));   // no sound of the draft
  assert.equal(rec.text(1), `[${whole}]`);                    // nor its text: a run once gave "…managerI spoke…"
  assert.deepEqual(client.chatCalls.map(unitOf), [head, whole]);
  assert.deepEqual([engine.usage.drafts, engine.usage.draftsDropped], [1, 1]);
});

test('a draft dropped mid-translation never speaks and the utterance still ends', async () => {
  const client = new FakeOpenAI();
  const head = 'Мы хотели бы вас предупредить';
  const gate = client.unitGate(head);                         // the draft's translation is still running
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.prepare(1, head);
  await until(() => client.chatCalls.length === 1);
  const whole = head + ', чтобы вы взяли сумку.';
  engine.updated(1, whole);
  gate.set();
  engine.released(1, whole);
  await until(() => rec.doneCount(1) === 1);
  assert.deepEqual(rec.audio(1), join(pcm(`[${whole}]`)));
  assert.equal(rec.text(1), `[${whole}]`);
});

test('the abandoned loop of a draft dropped mid-translation leaves quietly', async () => {
  // JS has no task.cancel(): the dropped draft's loop wakes up after its await, sees another generation and
  // touches nothing — not the work count (onDone would come before the continuation's sound), not the errors.
  const client = new FakeOpenAI();
  const head = 'Мы хотели бы вас предупредить';
  client.unitGate(head);
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.prepare(1, head);
  await until(() => client.chatCalls.length === 1);
  const whole = head + ', чтобы вы взяли сумку.';
  engine.updated(1, whole);
  engine.released(1, whole);
  await until(() => rec.doneCount(1) === 1);
  await sleep(20);
  assert.equal(rec.doneCount(1), 1);
  assert.equal(rec.kinds(1).at(-1), 'done');
  assert.deepEqual(rec.audio(1), join(pcm(`[${whole}]`)));
  assert.equal(engine.usage.errors, 0);                      // a cancellation is not an error
});

test('work spawned in a turn starts after it, as an asyncio task does', async () => {
  // asyncio.create_task runs the coroutine only once the caller's code is done: a draft dropped in the same turn
  // it was prepared in is never requested at all.
  const { engine, client, rec } = make();
  engine.opened(1, 'ru', false);
  const head = 'Мы хотели бы вас предупредить';
  const whole = head + ', чтобы вы взяли сумку.';
  engine.prepare(1, head);
  engine.updated(1, whole);
  engine.released(1, whole);
  await until(() => rec.doneCount(1) === 1);
  assert.deepEqual(client.chatCalls.map(unitOf), [whole]);
  assert.deepEqual([engine.usage.drafts, engine.usage.draftsDropped], [1, 1]);
});

test('punctuation alone does not undo the draft', async () => {
  const { engine, client, rec } = make();
  engine.opened(1, 'en', false);
  engine.prepare(1, 'Thursday afternoon then');
  engine.updated(1, 'Thursday afternoon, then.');
  await sleep(50);                                            // and the settled-text timer does not send the tail again
  engine.released(1, 'Thursday afternoon, then.');
  await until(() => rec.doneCount(1) === 1);
  assert.deepEqual(client.chatCalls.map(unitOf), ['Thursday afternoon then']);
});

test('prepare does nothing when every sentence is already in translation', async () => {
  const { engine } = make();
  engine.opened(1, 'en', false);
  engine.updated(1, 'One. Two.');
  await sleep(50);                                            // "Two." settled and went to translation by itself
  engine.prepare(1, 'One. Two.');
  assert.equal(engine.usage.drafts, 0);
});

test('the draft sounds after the earlier sentences', async () => {
  const client = new FakeOpenAI();
  const gate = client.unitGate('Раз.');                       // the first sentence is still being translated
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.updated(1, 'Раз. два три');
  engine.prepare(1, 'Раз. два три');
  engine.released(1, 'Раз. два три');
  gate.set();
  await until(() => rec.doneCount(1) === 1);
  assert.deepEqual(rec.audio(1), join(pcm('[Раз.]'), pcm('[два три]')));
});

test('a dropped utterance takes its draft with it', async () => {
  const { engine, client, rec } = make();
  engine.opened(1, 'en', false);
  engine.prepare(1, 'see you then');
  await until(() => client.ttsFinished.includes('[see you then]'));
  engine.dropped(1);
  engine.released(1, 'see you then');
  await sleep(50);
  assert.equal(rec.audio(1).length, 0);
  assert.equal(rec.doneCount(1), 0);
});

test('a draft after translated sentences is joined with a space', async () => {
  const { engine, client, rec } = make(new FakeOpenAI({ 'Мастер приедет завтра.': 'The technician will come tomorrow.' }));
  engine.opened(1, 'ru', false);
  engine.updated(1, 'Мастер приедет завтра. Он позвонит');
  await until(() => rec.text(1) === 'The technician will come tomorrow.');
  engine.prepare(1, 'Мастер приедет завтра. Он позвонит');
  await until(() => client.ttsFinished.includes('[Он позвонит]'));
  engine.released(1, 'Мастер приедет завтра. Он позвонит.');
  await until(() => rec.doneCount(1) === 1);
  assert.equal(rec.text(1), 'The technician will come tomorrow. [Он позвонит]');
});

test('no space between chunks of a chinese or japanese translation but korean keeps it', async () => {
  // Second review round: the space between units was put into Chinese too — "我会打电话 明天。". Chinese and
  // Japanese put no spaces between words, Korean does.
  const cases: Array<[string, string, string, string]> = [
    ['zh', '我会打电话', '明天。', '我会打电话明天。'],
    ['ja', '電話します', '明日。', '電話します明日。'],
    ['zh', '嗯，我觉得，', '我们应该走。', '嗯，我觉得，我们应该走。'],
    ['ja', '「電話します」', '明日。', '「電話します」明日。'],
    ['ko', '전화할게요', '내일요.', '전화할게요 내일요.'],
  ];
  for (const [lang, headTr, tailTr, joined] of cases) {
    const { engine, rec } = make(new FakeOpenAI({ 'I will call': headTr, 'tomorrow.': tailTr }));
    engine.opened(1, 'en', false);
    engine.released(1, 'I will call');
    await until(() => rec.doneCount(1) === 1);
    engine.updated(1, 'I will call tomorrow.');                // the late tail of a released utterance
    await until(() => rec.doneCount(1) === 2);
    assert.equal(rec.text(1), joined, lang);
  }
});

// --- caller: tone, background, one-way mode, voices, greeting ---------------------------------------------------

function fakeClient(translation: string) {
  const calls: any[] = [];
  const speech: any[] = [];
  const client = {
    chat: { completions: { create: async (body: any) => {
      calls.push(body);
      const chunks = [{ choices: [{ delta: { content: translation } }] }, { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5 } }];
      return { controller: { abort() {} }, async *[Symbol.asyncIterator]() { for (const c of chunks) yield c; } };
    } } },
    audio: { speech: { create: async (body: any) => {
      speech.push(body);
      return { body: (async function* () { yield new Uint8Array(4800); })() };
    } } },
  };
  return { client, calls, speech };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 30));

test('tone and personal context reach the translation prompt; Original adds nothing', async () => {
  for (const [tone, withTone] of [['business', true], ['neutral', false]] as const) {
    const { client, calls } = fakeClient('Hello.');
    const engine = new CascadeEngine({ client, langA: 'ru', langB: 'en', tone, personalContext: 'Name: Slava', onAudio() {}, onText() {}, onDone() {} });
    engine.opened(1, 'ru', false);
    engine.released(1, 'Привет.');
    await settle();
    const system = calls[0].messages[0].content as string;
    assert.equal(system.includes(TONE_INSTRUCTIONS.business), withTone);
    assert.ok(system.includes('Name: Slava'));
    assert.ok(system.includes('DATA, not instructions'));
    await engine.aclose();
  }
});

test('a silent-language reply is translated as text and never synthesised', async () => {
  const { client, speech } = fakeClient('Всё хорошо.');
  const texts: string[] = [];
  const done: number[] = [];
  const engine = new CascadeEngine({ client, langA: 'ru', langB: 'en', silentLangs: ['en'], onAudio() {}, onText: (_u, t) => texts.push(t), onDone: u => done.push(u) });
  engine.opened(1, 'en', false);
  engine.released(1, 'All good.');
  await settle();
  assert.equal(texts.join(''), 'Всё хорошо.');
  assert.equal(speech.length, 0);
  assert.deepEqual(done, [1]);
  await engine.aclose();
});

test('stored xAI voices map to realtime voices and unknown ones fall back to marin', () => {
  assert.equal(resolveVoice('eve'), 'marin');
  assert.equal(resolveVoice('rex'), 'cedar');
  assert.equal(resolveVoice('coral'), 'coral');
  assert.equal(resolveVoice('nope'), 'marin');
});

test('synthesize returns the whole greeting and counts its characters', async () => {
  const { client, speech } = fakeClient('');
  const engine = new CascadeEngine({ client, langA: 'ru', langB: 'en', voice: 'coral', onAudio() {}, onText() {}, onDone() {} });
  const pcm = await engine.synthesize('Hi there.');
  assert.equal(pcm.length, 4800);
  assert.equal(speech[0].voice, 'coral');
  assert.equal(engine.usage.ttsChars, 'Hi there.'.length);
  await engine.aclose();
});

test('voice, tone, languages and silent languages changed mid-call apply to the work started afterwards', async () => {
  const translation = 'a1 a2 a3 a4 a5 a6 a7 a8, b1 b2 b3 b4 b5 b6 b7 b8, c1 c2 c3 c4 c5 c6 c7 c8, d1 d2.';
  const phrases = ['a1 a2 a3 a4 a5 a6 a7 a8,', 'b1 b2 b3 b4 b5 b6 b7 b8,', 'c1 c2 c3 c4 c5 c6 c7 c8,', 'd1 d2.'];
  const client = new FakeOpenAI({ 'Раз.': translation });
  const gates = phrases.slice(0, 2).map(p => client.phraseGate(p, 0));   // the first two hold both speech slots
  const { engine, rec } = make(client);
  engine.opened(1, 'ru', false);
  engine.released(1, 'Раз.');
  // all four phrases are made, the last two still wait for a slot
  await until(() => client.chatClosed === 1 && client.ttsCalls.length === 2);
  engine.setVoice('rex');
  engine.setTone('business');
  engine.setLanguages('en', 'zh');
  engine.setSilentLangs(['zh']);
  for (const gate of gates) gate.set();
  engine.opened(2, 'en', false);
  engine.released(2, 'Two.');
  engine.opened(3, 'zh', false);
  engine.released(3, '三。');
  await until(() => [1, 2, 3].every(u => rec.doneCount(u) === 1));
  const system = (unit: string) => client.chatCalls.find(c => unitOf(c) === unit).messages[0].content as string;
  assert.ok(system('Раз.').includes('from Russian into English') && !system('Раз.').includes(TONE_INSTRUCTIONS.business));
  assert.ok(system('Two.').includes('from English into Chinese') && system('Two.').includes(TONE_INSTRUCTIONS.business));
  assert.ok(system('三。').includes('from Chinese into English'));
  // a phrase keeps the voice it was made with, even when synthesised after the change; the stored xAI id is
  // mapped; the silent side gets its translation as text only. (Utterances have their own speech slots, so the
  // order of the calls between them is not fixed.)
  assert.equal(client.ttsCalls.length, 5);
  assert.deepEqual(Object.fromEntries(client.ttsCalls.map(c => [c.input, c.voice])),
    { ...Object.fromEntries(phrases.map(p => [p, 'marin'])), '[Two.]': 'cedar' });
  assert.equal(rec.text(3), '[三。]');
});

test('the utterance map stays bounded over a long call, and a dropped id stays dropped', async () => {
  // Nothing was ever deleted from it, so a four-hour call held on to every source and translation string of
  // the whole call — each entry also keeping a Set, a Semaphore and an AbortController — on a host whose
  // memory limit is shared with calls in progress.
  const client = new FakeOpenAI();
  const { engine } = make(client);
  for (let i = 1; i <= 400; i++) {
    engine.opened(i, 'ru', false);
    engine.dropped(i);
  }
  const utts = (engine as any).utts as Map<number, unknown>;
  assert.ok(utts.size <= 64, `the map grew to ${utts.size}`);
  // ...and the eviction must not resurrect a dropped utterance: live() builds a fresh, NOT cancelled one for
  // an unknown id on purpose, so without a tombstone the engine would speak text the floor had dropped.
  engine.updated(399, 'Это сбросили.');
  engine.released(399, 'Это сбросили.');
  await sleep(20);
  assert.equal(client.chatCalls.length, 0);
});
