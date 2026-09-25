import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { setIo } from '../../realtime/io.js';
import {
  CLOSE_TIMEOUT_MS, COMMIT_FORCE_S, ConsecutiveTranslator, httpAgent, WARM_CONNECTIONS,
  type ConsecutiveParts, type ConsecutiveTranslatorOptions, type EngineLike, type JudgeLike, type TranscriberLike,
} from './translator.js';
import { TTS_MODEL, type EngineCallbacks } from './engine.js';
import type { Command } from './floor.js';
import { DEFAULT_CONSECUTIVE_SETTINGS } from './settings.js';
import type { VadModel } from './vad.js';

class FakeTranscriber implements TranscriberLike {
  audioSeconds = 0; pushed: Buffer[] = []; commits = 0; closed = false; closes = 0; up = true;
  async start() { return this.up; }
  push(b: Buffer) { this.pushed.push(b); }
  commit() { this.commits++; return true; }
  async aclose() { this.closes++; this.closed = true; }
}

/** An engine that translates at once: the engines' own speed is their tests' business. */
class FakeEngine implements EngineLike {
  usage = {}; log: string[] = []; langs = new Map<number, string | null>(); silent = new Set<string>(); closed = false;
  constructor(readonly cb: EngineCallbacks) {}
  async start() { return true; }
  opened(u: number, lang: string | null, candidate: boolean) { this.langs.set(u, lang); this.log.push(`opened ${u} ${lang} ${candidate}`); }
  updated() {}
  prepare(u: number, text: string) { this.log.push(`prepare ${u} ${text}`); }
  reopened(u: number) { this.log.push(`reopened ${u}`); }
  restart(u: number) { this.log.push(`restart ${u}`); return true; }
  released(u: number, text: string) {
    this.log.push(`released ${u} ${text}`);
    const lang = this.langs.get(u) ?? null;
    queueMicrotask(() => {
      this.cb.onText(u, `T(${text})`);
      if (!(lang && this.silent.has(lang))) this.cb.onAudio(u, Buffer.alloc(48000));   // 1 s at 24 kHz
      this.cb.onDone(u);
    });
  }
  dropped(u: number) { this.log.push(`dropped ${u}`); }
  stopped(u: number) { this.log.push(`stopped ${u}`); }
  setSilentLangs(langs: Iterable<string>) { this.silent = new Set(langs); }
  costs() { return { text: 0, tts: 0 }; }
  async aclose() { this.closed = true; }
  async synthesize(_text: string): Promise<Buffer> { return Buffer.alloc(4800); }   // 0.1 s at 24 kHz
}

class FakeOut {
  writes = 0; clears = 0;
  private gate: Promise<void> | null = null;
  private open: (() => void) | null = null;
  hold() { this.gate = new Promise(resolve => { this.open = resolve; }); }
  release() { this.open?.(); this.gate = null; }
  async write() { this.writes++; if (this.gate) await this.gate; }
  clear() { this.clears++; }
}

/** aidispatch's fake judge: never sure the thought is over, always for interrupting. */
const pyJudge = (): JudgeLike => ({
  usage: { in: 0, out: 0 }, semanticEnd: async () => null, intent: async () => ['interrupt', 0.9],
});

const SILENT_FRAME = Buffer.alloc(160, 0xff);   // 20 ms of µ-law silence from Twilio
const FRAME_24K = 960;                          // 20 ms of PCM16 at 24 kHz

/** PCM16 at a steady level. */
const level = (value: number, samples: number) => {
  const pcm = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) pcm.writeInt16LE(value, i * 2);
  return pcm;
};

const until = async (cond: () => boolean, tries = 400) => {
  for (let i = 0; i < tries && !cond(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(cond(), 'condition not reached');
};

const settle = async (times = 20) => {
  for (let i = 0; i < times; i++) await new Promise(resolve => setImmediate(resolve));
};

// Every translator a test built is closed after it, a failed test's too: no timer outlives it.
const live: ConsecutiveTranslator[] = [];
afterEach(() => {
  for (const translator of live.splice(0)) translator.detach();
});

function build(over: Partial<ConsecutiveParts> = {}, opts: Partial<ConsecutiveTranslatorOptions> = {},
  setup?: (engine: FakeEngine) => void) {
  const time = { now: 100 };
  let deltas!: (item: string, text: string) => void;
  const transcriber = new FakeTranscriber();
  let engine!: FakeEngine;
  const out = new FakeOut();
  const translator = new ConsecutiveTranslator({
    callId: 'c1', workspaceId: 'w1', myLanguage: 'ru', targetLanguage: 'en',
    socket: { readyState: 1, send() {} }, streamSid: 'MZ1', ...opts,
    parts: {
      apiKey: 'k', persist: false, vadModel: null, clock: () => time.now, settings: DEFAULT_CONSECUTIVE_SETTINGS,
      client: { chat: { completions: { create: async () => ({}) } }, audio: { speech: { create: async () => ({}) } } },
      transcriberFactory: onDelta => { deltas = onDelta; return transcriber; },
      judge: { usage: { in: 0, out: 0 }, semanticEnd: async () => [true, 0.95], intent: async () => ['later', 0.9] },
      engineFactory: cb => { engine = new FakeEngine(cb); setup?.(engine); return engine; }, out, ...over,
    },
  });
  live.push(translator);
  const apply = (cmds: Command[]) => (translator as any).apply(cmds);
  const advance = async (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / 0.05); i++) {
      time.now += 0.05;
      apply(translator.floor.tick());
      await new Promise(resolve => setImmediate(resolve));
    }
  };
  /** Speech as the detector and the transcriber report it: words 0.3 s apart, then 0.35 s of silence. */
  const speak = (text: string, step = 0.3) => {
    apply(translator.floor.vadStart());
    for (const word of text.split(' ')) {
      time.now += step;
      deltas('item_1', ' ' + word);
    }
    time.now += 0.35;
    apply(translator.floor.vadEnd(0.35));
  };
  return {
    translator, time, apply, advance, speak, transcriber, out,
    say: (text: string) => deltas('item_1', text),
    engine: () => engine,
    transcript: () => (translator as any).transcript as Array<Record<string, any>>,
  };
}

async function make(...args: Parameters<typeof build>) {
  const h = build(...args);
  await h.translator.start();
  return h;
}

const withoutTime = (turns: Array<Record<string, any>>) => turns.map(({ timestamp: _, ...turn }) => turn);

/** A detector that is never fed here: the test hands the call its windows itself. */
const quietDetector: VadModel = { predict: async () => 0 };
const windowOf = (h: Awaited<ReturnType<typeof make>>, silence: number, probability: number) =>
  (h.translator as any).onVad({ type: 'inference', probability, rawAccumulatedSilence: silence, frame: Buffer.alloc(512) });

// --- caller: the interface media-stream and the /translate page rely on ---------------------------------------------

test('pause silences the playing translation, drops what is queued and stops feeding the transcriber', async () => {
  const { translator, say, advance, transcriber, engine, out } = await make();
  out.hold();
  say('Я вчера разговаривал с менеджером.');
  await advance(1.5);
  await until(() => translator.floor.utterances.get(1)?.state === 'playing');
  translator.pause();
  assert.equal(out.clears, 1);
  assert.ok(engine().log.includes('stopped 1'));
  const pushed = transcriber.pushed.length;
  translator.sendAudio(Buffer.alloc(160, 0xff));
  assert.equal(transcriber.pushed.length, pushed);
  out.release();
  translator.detach();
});

test('while paused, text still arriving and the detector windows start nothing', async () => {
  const h = await make({ vadModel: quietDetector });
  h.translator.pause();
  h.say('Это было сказано до паузы.');   // text of audio sent before the pause
  windowOf(h, 0.5, 0.0);                  // a detector window queued before the pause
  (h.translator as any).onVad({ type: 'start' });
  await h.advance(1.5);
  assert.equal(h.translator.floor.utterances.size, 0);
  assert.equal(h.transcriber.pushed.length, 0);
  h.translator.resume();
  h.say('А это уже после.');
  assert.equal(h.translator.floor.utterances.size, 1);
});

test('one-way: the other side is translated as text, logged once translated and never played', async () => {
  const { translator, say, advance, out } = await make({}, { oneWay: true });
  say('Hello, everything is fine.');
  await advance(1.5);
  await until(() => (translator as any).transcript.length === 1);
  const turn = (translator as any).transcript[0];
  assert.equal(turn.speaker, 'other');
  assert.equal(turn.translated, 'T(Hello, everything is fine.)');
  assert.equal(out.writes, 0);
  assert.equal(translator.floor.utterances.get(1)!.state, 'done');
  translator.detach();
});

test('one-way: a text-only turn keeps the call from the idle hang-up', async () => {
  // persist with a carryover: the idle timer runs, the database is never touched
  const h = await make({ persist: true }, { oneWay: true, carryover: { sessionId: null, startTime: Date.now(), transcript: [] } });
  const armed = (h.translator as any).idleTimer;
  assert.ok(armed);
  h.say('Hello, everything is fine.');
  await h.advance(1.5);
  await until(() => h.transcript().length === 1);
  assert.notEqual((h.translator as any).idleTimer, armed);   // re-armed by the other side's turn
});

test('Socket.IO payloads are byte-for-byte StealthTranslator.emitTurn', async () => {
  const emitted: Array<[string, string, any]> = [];
  setIo({ to: (room: string) => ({ emit: (ev: string, payload: any) => emitted.push([room, ev, payload]) }) } as any);
  try {
    const { translator, say, advance } = await make({ persist: true }, { carryover: { sessionId: null, startTime: Date.now(), transcript: [] } });
    say('Привет, как дела?');
    await advance(1.5);
    await until(() => emitted.some(([, ev]) => ev === 'call:translation'));
    const [room, , payload] = emitted.find(([, ev]) => ev === 'call:translation')!;
    assert.equal(room, 'call:c1:translate');
    assert.deepEqual(Object.keys(payload), ['call_id', 'speaker', 'original', 'translated', 'detected_language', 'timestamp']);
    const final = emitted.find(([, ev, p]) => ev === 'call:transcript' && p.isFinal)!;
    assert.deepEqual(Object.keys(final[2]), ['call_id', 'speaker', 'text', 'timestamp', 'isFinal']);
    translator.detach();
  } finally {
    setIo(null as any);
  }
});

test('detach hands over the transcript and closes without finalizing', async () => {
  const { translator, say, advance, transcriber } = await make();
  say('Привет.');
  await advance(1.5);
  await until(() => (translator as any).transcript.length === 1);
  const carry = translator.detach();
  assert.equal(carry.transcript.length, 1);
  await until(() => transcriber.closed);
});

test('a same-script language change is refused in place', async () => {
  const { translator } = await make();
  translator.updateLanguages('en', 'it');
  assert.equal(translator.floor.cfg.langA, 'ru');
  translator.detach();
});

test('a greeting delay that is not a number falls back to 5 s', async () => {
  for (const [given, expected] of [[NaN, 5], [Infinity, 5], [undefined, 5], [100, 30], [-1, 0], [2, 2]] as const) {
    assert.equal((build({}, { greetingDelaySeconds: given }).translator as any).greetingDelaySeconds, expected, `given ${given}`);
  }
  // a garbage stored setting arrives as NaN, and setTimeout(NaN) fires at once
  const h = await make({}, { greetingText: 'Hi', greetingDelaySeconds: NaN });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(h.translator.floor.utterances.size, 0);   // no greeting queued yet
});

test('the close budget does not keep the process alive', async () => {
  const h = await make();
  const budgets: Array<ReturnType<typeof setTimeout>> = [];
  const original = globalThis.setTimeout;
  globalThis.setTimeout = ((handler: any, ms?: number, ...rest: any[]) => {
    const timer = original(handler, ms, ...rest);
    if (ms === CLOSE_TIMEOUT_MS) budgets.push(timer);
    return timer;
  }) as typeof setTimeout;
  try {
    await h.translator.finalize();
  } finally {
    globalThis.setTimeout = original;
  }
  assert.equal(budgets.length, 1);
  assert.equal(budgets[0].hasRef(), false);   // a script that finalizes (the smoke scene) exits at once
});

test("a judge that throws still settles the floor's question", async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
  process.on('unhandledRejection', onUnhandled);
  try {
    const failing = async (): Promise<never> => { throw new Error('judge down'); };
    const h = await make({ judge: { usage: { in: 0, out: 0 }, semanticEnd: failing, intent: failing } });
    // Longer than the floor's FAST_WORDS: with the question left open ("ask"), its period would not release it.
    const text = 'Я вчера разговаривал с менеджером нашего магазина, и он сказал, что мастер приедет завтра утром.';
    h.speak(text);
    await h.advance(1.0);
    const u = h.translator.floor.utterances.get(1)!;
    assert.equal(u.judging.size, 0);                    // the question is closed...
    assert.equal(u.verdicts.get(text), 'failed');       // ...as "the judge did not answer"
    assert.ok((h.translator.floor.counts.judge_failed ?? 0) >= 1);
    assert.equal(u.releaseReason, 'punctuation');       // so the period decides, as without a judge
    await settle();
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

// --- aidispatch tests/test_consecutive_call.py (9e4b1eb) -------------------------------------------------------------

test('a whole utterance goes from speech to sound and into the log', async () => {
  const h = await make({ judge: pyJudge() });
  h.speak('Мастер приедет завтра.');
  await h.advance(0.5);
  await until(() => h.transcript().length === 1);
  const engine = h.engine();
  assert.ok(engine.log.includes('opened 1 ru false'));
  assert.ok(engine.log.includes('released 1 Мастер приедет завтра.'));
  assert.equal(h.out.writes, 50);   // exactly what the engine gave: 1 s at 24 kHz is fifty 20 ms frames at 8 kHz
  assert.deepEqual(withoutTime(h.transcript()), [
    { speaker: 'subscriber', text: 'Мастер приедет завтра.', lang: 'ru', translated: 'T(Мастер приедет завтра.)' },
  ]);
  const [latency] = h.translator.floor.latenciesMs();   // end of speech → first sound
  assert.ok(latency >= 600 && latency <= 900, `latency ${latency}`);
  assert.ok(h.transcriber.commits >= 1);                 // the transcription segment is closed at the end of the thought
});

test('the engine is told to prepare the tail before the release', async () => {
  const h = await make({ judge: pyJudge() });
  h.speak('Ну и вот он мне говорит');
  await h.advance(0.3);
  assert.ok(h.engine().log.includes('prepare 1 Ну и вот он мне говорит'));
  assert.ok(!h.engine().log.some(entry => entry.startsWith('released')));
});

test('stop word during translation stops it and marks the turn interrupted', async () => {
  const h = await make({ judge: pyJudge() }, {}, engine => {
    engine.released = (u, text) => {   // a long translation: it plays until it is interrupted
      engine.log.push(`released ${u} ${text}`);
      engine.cb.onText(u, 'The technician will come tomorrow.');
      engine.cb.onAudio(u, Buffer.alloc(FRAME_24K * 200));
    };
  });
  h.speak('Мастер приедет завтра.');
  await h.advance(0.5);
  assert.equal(h.translator.floor.utterances.get(1)!.state, 'playing');
  h.time.now += 0.3;
  h.say(' Stop.');
  await settle();
  assert.ok(h.engine().log.includes('stopped 1'));
  assert.ok(h.out.clears >= 1);
  assert.equal(h.transcript()[0].interrupted, true);
  assert.equal(h.transcript()[0].translated, 'The technician will come tomorrow.');
});

test('a continuation in the first seconds restarts the translation and logs the whole thought', async () => {
  // Calls 24.09: the translation began, and the person went on half a second later. The sound goes, the engine
  // translates the thought anew, the new sound plays from the start; the log gets the whole text and a latency
  // that is not negative (it used to keep a scrap and −6.4 s).
  const restarts: number[] = [];
  const h = await make({ judge: pyJudge() }, {}, engine => {
    engine.restart = u => { restarts.push(u); return true; };
    engine.released = (u, text) => {   // a long translation: still playing when the person goes on
      engine.log.push(`released ${u} ${text}`);
      engine.cb.onText(u, 'The technician will come tomorrow.');
      engine.cb.onAudio(u, Buffer.alloc(FRAME_24K * 200));
    };
  });
  h.speak('Мастер приедет завтра.');
  await h.advance(0.5);
  assert.equal(h.translator.floor.utterances.get(1)!.state, 'playing');
  for (const word of ['И', 'он', 'позвонит', 'заранее.']) {
    h.time.now += 0.3;
    h.say(' ' + word);
  }
  await settle();
  assert.deepEqual(restarts, [1]);
  assert.ok(h.out.clears >= 1);
  assert.ok(!(h.translator as any).hasAudio.has(1) && !(h.translator as any).translations.has(1));
  delete (h.engine() as any).released;   // the new translation comes at once
  await h.advance(1.5);
  await until(() => h.transcript().length === 1);
  assert.deepEqual(h.transcript().map(turn => turn.text), ['Мастер приедет завтра. И он позвонит заранее.']);
  const turn = h.transcript()[0];
  assert.equal(turn.translated, 'T(Мастер приедет завтра. И он позвонит заранее.)');
  assert.equal(turn.interrupted, undefined);
  const [latency] = h.translator.floor.latenciesMs();
  assert.ok(latency >= 0 && latency < 2000, `latency ${latency}`);
});

test('greeting is spoken first and not logged', async () => {
  const h = await make({ judge: pyJudge() }, { greetingText: "Hi, I'm the interpreter.", greetingDelaySeconds: 0 });
  await until(() => h.translator.floor.utterances.get(1)?.state === 'done');
  assert.equal(h.translator.floor.utterances.get(1)!.greeting, true);
  assert.equal(h.out.writes, 5);   // its 0.1 s at 24 kHz: five 20 ms frames on the line
  assert.deepEqual(h.transcript(), []);   // it translates nothing, so it is no turn
});

test('greeting without audio does not block the queue', async () => {
  // No sound, or the speech call failed (CascadeEngine.synthesize rethrows): either way it is dropped.
  for (const synthesize of [async () => Buffer.alloc(0), async (): Promise<Buffer> => { throw new Error('speech failed'); }]) {
    const h = await make({ judge: pyJudge() }, { greetingText: 'Hi', greetingDelaySeconds: 0 }, engine => {
      engine.synthesize = synthesize;
    });
    await until(() => h.translator.floor.utterances.get(1)?.state === 'dropped');
    h.speak('Да.');
    await h.advance(0.5);
    await until(() => h.transcript().length === 1);   // the reply after it plays
    assert.equal(h.transcript()[0].text, 'Да.');
  }
});

test('the transcriber hears the line only after the detector checked it', async () => {
  let open!: () => void;
  const judged = new Promise<void>(resolve => { open = resolve; });
  const detector: VadModel = { predict: async () => { await judged; return 0; } };
  const h = await make({ vadModel: detector, judge: pyJudge() });
  const vad = (h.translator as any).vad;
  let fed = 0;
  const push = vad.push.bind(vad);
  vad.push = (pcm: Buffer) => { fed++; push(pcm); };
  for (let i = 0; i < 10; i++) h.translator.sendAudio(SILENT_FRAME);
  await settle();
  assert.equal(fed, 10);
  assert.equal(h.transcriber.pushed.length, 0);   // the detector has not judged a window yet
  open();
  await until(() => h.transcriber.pushed.length === 6);   // 200 ms of the line are six 32 ms windows
  assert.ok(h.transcriber.pushed.every(pcm => pcm.length === 1536));   // each window at 24 kHz
});

test('a segment is closed only in silence the detector confirmed', async () => {
  // Run 24.09: the core closed the segment the moment it released a reply while the person was speaking again —
  // "Я п" went into one segment, "He puttle" instead of "ерепутал" into the next. Now the request waits for silence.
  const h = await make({ vadModel: quietDetector, judge: pyJudge() });
  h.apply([{ kind: 'commit' }]);
  for (const [silence, probability] of [[0.0, 0.9],    // speaking
                                        [0.2, 0.1],    // a pause inside a phrase
                                        [0.4, 0.9]]) { // the pause is over: speech in this window
    windowOf(h, silence, probability);
    assert.equal(h.transcriber.commits, 0);
  }
  windowOf(h, 0.4, 0.1);
  assert.equal(h.transcriber.commits, 1);
  windowOf(h, 0.8, 0.0);   // one request, one commit
  assert.equal(h.transcriber.commits, 1);
});

test('without any silence the segment is closed anyway after a while', async () => {
  const h = await make({ vadModel: quietDetector, judge: pyJudge() });
  h.apply([{ kind: 'commit' }]);
  h.time.now += COMMIT_FORCE_S - 0.1;
  windowOf(h, 0.0, 0.9);
  assert.equal(h.transcriber.commits, 0);
  h.time.now += 0.1;
  windowOf(h, 0.0, 0.9);
  assert.equal(h.transcriber.commits, 1);
});

test('when the detector dies the line goes to the transcriber directly', async () => {
  const broken: VadModel = { predict: async () => { throw new Error('inference failed'); } };
  const h = await make({ vadModel: broken, judge: pyJudge() });
  h.apply([{ kind: 'commit' }]);
  h.translator.sendAudio(SILENT_FRAME);   // 20 ms: less than a detector window
  await settle();
  assert.equal(h.transcriber.pushed.length, 0);
  assert.equal(h.transcriber.commits, 0);
  h.translator.sendAudio(SILENT_FRAME);   // a whole window now, and the detector fails on it
  await until(() => h.transcriber.commits === 1);   // the pending request is carried out at once
  assert.equal(h.transcriber.pushed.length, 0);
  h.translator.sendAudio(SILENT_FRAME);
  assert.equal(h.transcriber.pushed.length, 1);     // the call feeds the transcriber itself again
  h.apply([{ kind: 'commit' }]);
  assert.equal(h.transcriber.commits, 2);
});

test('the call measures the echo and tells the floor', async () => {
  // While our translation plays the line stays silent: no echo, and the floor's echo filter goes off.
  const h = await make({ judge: pyJudge() }, {}, engine => {
    engine.released = (u, text) => {   // 4 s of our voice at a steady level
      engine.log.push(`released ${u} ${text}`);
      engine.cb.onText(u, 'The technician will come tomorrow.');
      engine.cb.onAudio(u, level(2000, 4 * 24000));
      engine.cb.onDone(u);
    };
  });
  assert.equal(h.translator.floor.echo, true);
  h.speak('Мастер приедет завтра.');
  await h.advance(0.5);
  await until(() => h.out.writes === 200);   // 4 s of our audio went out, frame by frame...
  for (let i = 0; i < 200; i++) {            // ...and the line said nothing back
    h.time.now += 0.02;
    h.translator.sendAudio(SILENT_FRAME);
  }
  assert.equal(h.translator.floor.echo, false);
  assert.equal(h.translator.summary().echo.present, false);
});

test('no transcriber means no call', async () => {
  const h = build({ judge: pyJudge() });
  h.transcriber.up = false;
  await assert.rejects(h.translator.start(), /transcriber did not start/);
  // media-stream falls back to the cascade: nothing of ours may stay open
  assert.equal(h.transcriber.closed, true);
  assert.equal(h.engine().closed, true);
  assert.equal((h.translator as any).ticker, undefined);
});

test('closing writes usage and latency even if parts fail', async () => {
  // aidispatch also wrote the call recording here; caller has none. persist is off: the metrics are what finalize()
  // would write to translator_sessions.metrics.
  const h = await make({ judge: { usage: { in: 250, out: 0 }, semanticEnd: async () => null, intent: async () => null } }, {},
    engine => {
      engine.costs = () => ({ text: 0.002, tts: 0.001 });
      engine.aclose = async () => { throw new Error('socket already gone'); };
    });
  h.transcriber.audioSeconds = 60;
  h.transcriber.aclose = async () => { throw new Error('socket already gone'); };   // closing must not lose the totals
  h.speak('Да.');
  await h.advance(0.5);
  await until(() => h.transcript().length === 1);
  let settled: Record<string, any> | null = null;
  const summary = h.translator.summary.bind(h.translator);
  h.translator.summary = () => (settled = summary());
  await h.translator.finalize();
  assert.ok(settled);
  const usage: Record<string, any> = settled;
  assert.equal(usage.engine, 'consecutive');
  assert.equal(usage.utterances, 1);
  assert.deepEqual(usage.costs, { transcribe: 0.017, text: 0.002, judge: 0.0001, tts: 0.001 });
  assert.equal(usage.cost_usd, 0.0201);
  assert.equal(usage.counts.release_punctuation, 1);
  assert.equal(usage.latency_ms.n, 1);
});

test('closing twice is harmless', async () => {
  const h = await make({ judge: pyJudge() });
  h.translator.stop();
  h.translator.stop();
  await h.translator.finalize();
  assert.equal(h.transcriber.closes, 1);
});

test('close budget fits the shutdown window', () => {
  // media-stream finalizes on Twilio's stop: turns and totals go first, the sockets get at most this long
  assert.ok(CLOSE_TIMEOUT_MS <= 2000);
});

test('a reply dropped as stale stays in the log untranslated', async () => {
  // A late short reply is not translated, but what was said must stay in the call's record.
  const h = await make({ judge: pyJudge() });
  h.speak('Теперь правильно.');
  h.apply([{ kind: 'drop', utt: 1, reason: 'stale' }]);
  await settle();
  assert.deepEqual(withoutTime(h.transcript()), [
    { speaker: 'subscriber', text: 'Теперь правильно.', lang: 'ru', translated: '', skipped: 'stale' },
  ]);
  assert.ok(h.engine().log.includes('dropped 1'));
});

test('what was said right before hanging up stays in the log', async () => {
  // Review: the goodbye that still waited for silence vanished from the call's record. Nobody is left to hear its
  // translation, but what was said must stay.
  const h = await make({ judge: pyJudge() });
  h.speak('Спасибо, до свидания.');
  await h.advance(0.3);   // not released yet: it waits for 0.7 s of silence
  await h.translator.finalize();
  assert.deepEqual(withoutTime(h.transcript()), [
    { speaker: 'subscriber', text: 'Спасибо, до свидания.', lang: 'ru', translated: '', skipped: 'call_ended' },
  ]);
});

test('connections to OpenAI are warmed up when the call starts', async () => {
  // Measured 25.09: the call's first request waited 0.9–1.5 s for the first sound against 0.5 s on a warm
  // connection. The connections for the judge, the translation and two syntheses open while the greeting plays.
  const asked: string[] = [];
  const client = {
    chat: { completions: { create: async () => ({}) } }, audio: { speech: { create: async () => ({}) } },
    models: { retrieve: async (model: string) => { asked.push(model); } },
  };
  await make({ client, judge: pyJudge() });
  await until(() => asked.length === WARM_CONNECTIONS);
  await settle();
  assert.equal(asked.length, WARM_CONNECTIONS);
  assert.ok(WARM_CONNECTIONS >= 4);
  assert.ok(asked.every(model => model === TTS_MODEL));
});

test('idle connections outlive the pauses between utterances', () => {
  // The SDK's default agent drops an idle connection after 4 s, and the pause between replies is usually longer:
  // every reply reopened them. OpenAI keeps an idle connection at least 4 minutes (measured 25.09).
  const agent = httpAgent();
  assert.equal(agent.options.keepAlive, true);
  assert.ok((agent.options.timeout ?? 0) >= 240_000);
  agent.destroy();
});
