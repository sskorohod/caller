/**
 * Transcription of the line by gpt-live-transcribe: what goes on the wire, what comes back, and how the
 * leg survives a dropped socket. Port of aidispatch tests/test_consecutive_transcribe.py (9e4b1eb).
 *
 * No network here: the socket is fake, and the event shapes are the live API's (checked 2026-09-24).
 * No other test would show a misread of the wire — the translation just stays silent while the minutes
 * are billed to the key.
 */
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  BACKOFF_S, CLOSE_TIMEOUT_S, DELAY, HANDSHAKE_TIMEOUT_MS, MIN_COMMIT_MS, RATE, TRANSCRIBE_FORMAT, TRANSCRIBE_MODEL,
  TRANSCRIBE_URL, TranscribeLeg, log, type TranscribeFormat, type WsLike,
} from './transcribe.js';

// 20 ms of PCM16 24 kHz mono — 960 bytes, as the line gives them
const FRAME = Buffer.alloc(960, Buffer.from([1, 2]));

log.level = 'silent';   // tests read the log through captureLog(), not from stdout

function deltaEvent(itemId: string, text: string) {
  return { type: 'conversation.item.input_audio_transcription.delta', item_id: itemId, delta: text };
}

function completedEvent(itemId: string, text: string, seconds = 1.0) {
  return {
    type: 'conversation.item.input_audio_transcription.completed', item_id: itemId,
    transcript: text, usage: { type: 'duration', seconds },
  };
}

// The live API's answer to a session it will not take — here the model the key has no access to.
const REFUSAL = { type: 'error', error: {
  type: 'invalid_request_error', code: 'model_not_found',
  message: 'The model `gpt-live-transcribe` does not exist or you do not have access to it.',
  param: 'session.audio.input.transcription.model', event_id: null } };

/**
 * A socket: gives the leg what it was fed and remembers everything the leg sent. Like the live API it answers
 * every session.update — with session.updated unless told to refuse or to stay silent.
 */
class FakeWs extends EventEmitter implements WsLike {
  readyState = 0;          // CONNECTING until the fake server accepts
  bufferedAmount = 0;
  sent: string[] = [];
  closed = false;          // the leg called close()
  terminated = false;      // the leg dropped the connection outright
  failSend = false;

  constructor(private readonly opts: {
    hangOnClose?: boolean; slow?: boolean; refuse?: Error; stall?: boolean; session?: 'accept' | 'refuse' | 'ignore';
  } = {}) {
    super();
  }

  send(data: string): void {
    if (this.failSend) throw new Error('socket is gone');
    this.sent.push(data);
    if (this.opts.slow) this.bufferedAmount += Buffer.byteLength(data);   // nothing ever leaves
    const answer = this.opts.session ?? 'accept';
    if (data.startsWith('{"type":"session.update"') && answer !== 'ignore') {
      setImmediate(() => {
        if (this.readyState === 1) this.feed(answer === 'accept' ? { type: 'session.updated', session: {} } : REFUSAL);
      });
    }
  }

  close(): void {
    this.closed = true;
    if (this.readyState === 3) return;
    const connecting = this.readyState === 0;
    this.readyState = 2;
    if (this.opts.hangOnClose) return;              // the server does not answer the close
    setImmediate(() => {
      // like ws: a handshake cut short reports an error, then the close
      if (connecting) this.emit('error', new Error('closed before the connection was established'));
      this.finish();
    });
  }

  terminate(): void {
    this.terminated = true;
    this.finish();
  }

  /** The server side of the handshake: open — or refuse the way ws reports it, an error and then the close. */
  accept(): void {
    if (this.readyState !== 0) return;              // closed while connecting: ws never opens after that
    if (this.opts.stall) return;                    // a server that never answers the handshake
    if (this.opts.refuse) {
      this.readyState = 3;
      this.emit('error', this.opts.refuse);
      this.emit('close', 1006, Buffer.alloc(0));
      return;
    }
    this.readyState = 1;
    this.emit('open');
  }

  feed(event: unknown): void {
    this.emit('message', Buffer.from(typeof event === 'string' ? event : JSON.stringify(event)), false);
  }

  feedBinary(data: Buffer): void {
    this.emit('message', data, true);
  }

  /** The server dropped the connection on its own: the socket closes without our close(). */
  drop(): void {
    this.finish();
  }

  /** ws's handshake timer fired: it cuts the handshake and reports it like any failure — an error, then the close. */
  timeOut(): void {
    if (this.readyState !== 0) return;
    this.readyState = 3;
    this.emit('error', new Error('Opening handshake has timed out'));
    this.emit('close', 1006, Buffer.alloc(0));
  }

  events(): any[] {
    return this.sent.map(s => JSON.parse(s));
  }

  types(): string[] {
    return this.events().map(e => e.type);
  }

  private finish(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit('close', 1006, Buffer.alloc(0));
  }
}

/** Every connect gives the next socket from the list; an error in the list is a refused connection. */
class FakeConnector {
  calls: { url: string; headers: Record<string, string> }[] = [];
  held = false;                                     // while set, a new socket hangs in CONNECTING until release()
  private readonly items: (FakeWs | Error)[];
  private readonly waiting: FakeWs[] = [];

  constructor(...items: (FakeWs | Error)[]) {
    this.items = items;
  }

  connect = (url: string, headers: Record<string, string>): WsLike => {
    this.calls.push({ url, headers });
    const item = this.items.shift();
    if (item === undefined) throw new Error('no socket left');
    const ws = item instanceof FakeWs ? item : new FakeWs({ refuse: item });
    if (this.held) this.waiting.push(ws);
    else setImmediate(() => ws.accept());
    return ws;
  };

  release(): void {
    this.held = false;
    for (const ws of this.waiting.splice(0)) ws.accept();
  }
}

/** Wait for the leg's background work. Sleeping at random would make the tests both slow and brittle. */
async function until(condition: () => boolean, timeoutMs = 500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('condition not reached in time');
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}

const tick = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));

function approx(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) <= 1e-6 * Math.max(1, Math.abs(expected)), `${actual} is not ≈ ${expected}`);
}

interface LegOptions {
  languages?: string[];
  format?: TranscribeFormat;
  onDelta?: (itemId: string, text: string) => void;
  onCompleted?: (itemId: string, text: string) => void;
  acceptTimeoutMs?: number;
}

/**
 * Real pauses of 0.5–2 s are no use to the tests: they check the order of actions, not the clock. So the
 * leg's waits are instant here, and `slept` keeps what it asked for.
 */
function makeLeg(connector: FakeConnector, opts: LegOptions = {}) {
  const deltas: [string, string][] = [];
  const done: [string, string][] = [];
  const slept: number[] = [];
  const leg = new TranscribeLeg({
    languages: opts.languages ?? ['ru', 'en'],
    apiKey: 'sk-test',
    format: opts.format ?? 'pcm24',   // the wire tests count PCM16 24 kHz bytes; pcmu has its own below
    onDelta: opts.onDelta ?? ((itemId, text) => { deltas.push([itemId, text]); }),
    onCompleted: opts.onCompleted ?? ((itemId, text) => { done.push([itemId, text]); }),
    connect: connector.connect,
    acceptTimeoutMs: opts.acceptTimeoutMs,
    sleep: async (ms) => {
      slept.push(ms);
      await new Promise(resolve => setImmediate(resolve));
    },
  });
  return { leg, deltas, done, slept };
}

type Level = 'debug' | 'info' | 'warn' | 'error';

/** The leg's log lines — what caplog gives the Python tests. */
function captureLog(t: TestContext): { level: Level; text: string }[] {
  const records: { level: Level; text: string }[] = [];
  for (const level of ['debug', 'info', 'warn', 'error'] as const) {
    t.mock.method(log, level, (...args: unknown[]) => { records.push({ level, text: JSON.stringify(args) }); });
  }
  return records;
}

function at(records: { level: Level; text: string }[], level: Level) {
  return records.filter(r => r.level === level);
}

// --- the wire -------------------------------------------------------------------------------------

test('the address asks for transcription and leaves the model to the session', async () => {
  // With model= in the URL the API rejects the whole session (checked 24.09): the model is named only in
  // session.update.
  const connector = new FakeConnector(new FakeWs());
  const { leg } = makeLeg(connector);
  assert.equal(await leg.start(), true);
  const { url, headers } = connector.calls[0];
  assert.equal(url, 'wss://api.openai.com/v1/realtime?intent=transcription');
  assert.equal(url, TRANSCRIBE_URL);
  assert.ok(!url.includes('model='));
  assert.deepEqual(headers, { Authorization: 'Bearer sk-test' });
  assert.ok(leg.alive);
  await leg.aclose();
});

test('the session is set up exactly as the live API accepted it', async () => {
  // Both languages of the pair at once: the line is shared by two. No speech threshold at all — the model
  // rejects it, and the core sets utterance boundaries with its own commits. No noise reduction either:
  // near_field holds on to the first voice and mutes the second. A repeated language is dropped, the order kept.
  const ws = new FakeWs();
  const { leg } = makeLeg(new FakeConnector(ws), { languages: ['ru', 'en', 'ru'] });
  await leg.start();
  assert.deepEqual(ws.events()[0], {
    type: 'session.update', session: { type: 'transcription', audio: { input: {
      format: { type: 'audio/pcm', rate: 24000 },
      transcription: { model: 'gpt-live-transcribe', languages: ['ru', 'en'], delay: 'low' } } } },
  });
  assert.ok(!ws.sent[0].includes('turn_detection'));
  assert.ok(!ws.sent[0].includes('noise_reduction'));
  await leg.aclose();
});

test('audio goes out as base64 appends and is counted', async () => {
  const ws = new FakeWs();
  const { leg } = makeLeg(new FakeConnector(ws));
  await leg.start();
  const other = Buffer.alloc(960, Buffer.from([3, 4]));
  leg.push(FRAME);
  leg.push(other);
  await until(() => ws.sent.length === 3);
  assert.deepEqual(ws.events().slice(1), [
    { type: 'input_audio_buffer.append', audio: FRAME.toString('base64') },
    { type: 'input_audio_buffer.append', audio: other.toString('base64') },
  ]);
  approx(leg.audioSeconds, 0.04);
  await leg.aclose();
});

test('commit under 100 ms is not sent and each commit has its own id', async () => {
  // The server closes nothing under 100 ms and answers with an error. Such a commit is not sent at all:
  // false means "the item keeps growing", and the core will try later.
  const ws = new FakeWs();
  const { leg } = makeLeg(new FakeConnector(ws));
  await leg.start();
  assert.equal(leg.commit(), false);                  // no audio yet
  for (let i = 0; i < 4; i++) leg.push(FRAME);        // 80 ms
  assert.equal(leg.commit(), false);
  leg.push(FRAME);                                    // exactly 100 ms
  assert.equal(leg.commit(), true);
  assert.equal(leg.commit(), false, 'after a commit the count starts from zero');
  leg.push(Buffer.concat(Array(5).fill(FRAME)));      // 100 ms in one piece
  assert.equal(leg.commit(), true);

  await until(() => ws.sent.length === 9);
  const append = 'input_audio_buffer.append';
  const commit = 'input_audio_buffer.commit';
  // a commit goes strictly after the audio it closes
  assert.deepEqual(ws.types().slice(1), [append, append, append, append, append, commit, append, commit]);
  assert.deepEqual(ws.events().filter(e => e.type === commit).map(e => e.event_id), ['commit-1', 'commit-2']);
  assert.equal(MIN_COMMIT_MS, 100);
  await leg.aclose();
});

// --- what comes back ------------------------------------------------------------------------------

test('text arrives piece by piece with its item', async () => {
  // Text comes while the person speaks, before the commit, in pieces smaller than a word, and for an item
  // it may come after its commit too. So each piece is passed on at once with its item_id: the core glues them.
  const ws = new FakeWs();
  const { leg, deltas, done } = makeLeg(new FakeConnector(ws));
  await leg.start();
  for (const piece of ['Мастер при', 'едет', ',']) ws.feed(deltaEvent('item_A', piece));
  ws.feed({ type: 'input_audio_buffer.committed', item_id: 'item_A', previous_item_id: null });
  ws.feed(deltaEvent('item_A', ' в два.'));           // a late piece, after the commit
  ws.feed(completedEvent('item_A', 'Мастер приедет, в два.'));
  ws.feed({ type: 'session.updated', session: {} });
  ws.feed({ type: 'rate_limits.updated' });           // the rest is skipped quietly
  ws.feed(deltaEvent('item_B', 'Okay'));
  await until(() => deltas.length === 5);
  assert.deepEqual(deltas, [
    ['item_A', 'Мастер при'], ['item_A', 'едет'], ['item_A', ','], ['item_A', ' в два.'],
    ['item_B', 'Okay'],
  ]);
  assert.deepEqual(done, [['item_A', 'Мастер приедет, в два.']]);
  await leg.aclose();
});

test('a failing callback does not stop the text', async (t) => {
  // A failure in the translation core is no reason to silence the transcription for the whole call: the
  // next piece still arrives.
  const records = captureLog(t);
  const seen: string[] = [];
  const ws = new FakeWs();
  const connector = new FakeConnector(ws);
  const { leg } = makeLeg(connector, {
    onDelta: (_itemId, text) => {
      seen.push(text);
      if (text === 'раз') throw new RangeError('сбой в ядре');
    },
    onCompleted: () => { throw new TypeError('и здесь тоже'); },
  });
  await leg.start();
  ws.feed(deltaEvent('item_A', 'раз'));
  ws.feed(completedEvent('item_A', 'раз'));
  ws.feed(deltaEvent('item_B', 'два'));
  await until(() => seen.includes('два'));
  assert.ok(leg.alive && connector.calls.length === 1, 'neither a crash nor a reconnect');
  const warnings = at(records, 'warn').map(r => r.text).join(' ');
  assert.ok(warnings.includes('RangeError') && warnings.includes('TypeError'));
  assert.ok(!records.some(r => r.text.includes('сбой') || r.text.includes('здесь')),
    'class names only, never messages');
  await leg.aclose();
});

test('a premature commit is only noted while other errors warn', async (t) => {
  // A commit on an almost empty buffer is routine at the seam between utterances: the item just keeps growing.
  const records = captureLog(t);
  const ws = new FakeWs();
  const connector = new FakeConnector(ws);
  const { leg, deltas } = makeLeg(connector);
  await leg.start();
  ws.feed({ type: 'error', error: {
    type: 'invalid_request_error', code: 'input_audio_buffer_commit_empty',
    message: 'Error committing input audio buffer: buffer too small. Expected at least 100ms of audio, '
      + 'but buffer only has 40.00ms of audio.', event_id: 'commit-7' } });
  ws.feed(deltaEvent('item_A', 'дальше'));
  await until(() => deltas.length > 0);
  const noted = records.filter(r => r.text.includes('commit-7'));
  assert.ok(noted.length > 0 && noted.every(r => r.level === 'info'));
  assert.equal(at(records, 'warn').length, 0);
  assert.ok(leg.alive && connector.calls.length === 1);

  ws.feed({ type: 'error', error: { type: 'invalid_request_error', code: 'unknown_parameter',
    message: "Unknown parameter: 'session.audio.input.turn_detection'." } });
  ws.feed(deltaEvent('item_A', 'и дальше'));
  await until(() => deltas.length === 2);
  assert.ok(at(records, 'warn').some(r => r.text.includes('unknown_parameter')));
  assert.ok(leg.alive && connector.calls.length === 1);
  await leg.aclose();
});

test('a malformed or binary frame is skipped not fatal', async () => {
  // One broken frame must not cost a reconnect and a hole in the text.
  const ws = new FakeWs();
  const connector = new FakeConnector(ws);
  const { leg, deltas } = makeLeg(connector);
  await leg.start();
  ws.feed('not json');
  ws.feed(['not', 'an', 'event']);
  ws.feedBinary(Buffer.from([0, 1]));
  ws.feedBinary(Buffer.from(JSON.stringify(deltaEvent('item_X', 'binary'))));   // binary even when it reads as an event
  ws.feed(deltaEvent('item_A', 'живой'));
  await until(() => deltas.length > 0);
  assert.deepEqual(deltas, [['item_A', 'живой']]);
  assert.ok(leg.alive && connector.calls.length === 1);
  await leg.aclose();
});

// --- drops ----------------------------------------------------------------------------------------

test('a dropped socket is replaced and the session set up again', async () => {
  // The new session knows nothing of the old one: the setup is sent again, and the uncommitted audio
  // stayed in the old buffer — the commit count starts from zero, or the core would get an error instead
  // of an utterance.
  const first = new FakeWs();
  const second = new FakeWs();
  const connector = new FakeConnector(first, second);
  const { leg, deltas } = makeLeg(connector);
  await leg.start();
  for (let i = 0; i < 4; i++) leg.push(FRAME);        // 80 ms the old session will never close
  await until(() => first.sent.length === 5);

  first.drop();
  await until(() => second.sent.length === 1);
  assert.deepEqual(second.events()[0], first.events()[0]);
  assert.equal(second.events()[0].type, 'session.update');
  assert.ok(leg.alive && first.closed && connector.calls.length === 2);

  leg.push(FRAME);
  assert.equal(leg.commit(), false, 'the new buffer heard 20 ms, not 100');
  second.feed(deltaEvent('item_B', 'снова'));
  await until(() => deltas.length > 0);
  assert.deepEqual(deltas, [['item_B', 'снова']]);
  await leg.aclose();
});

test('a failed send also brings a new socket', async () => {
  const first = new FakeWs();
  const second = new FakeWs();
  const { leg } = makeLeg(new FakeConnector(first, second));
  await leg.start();
  first.failSend = true;
  leg.push(FRAME);
  await until(() => second.sent.length === 1);
  assert.deepEqual(second.types(), ['session.update']);
  assert.ok(leg.alive);
  leg.push(FRAME);
  await until(() => second.sent.length === 2);
  assert.equal(second.types()[1], 'input_audio_buffer.append');
  await leg.aclose();
});

test('audio is dropped not hoarded while the socket is down', async (t) => {
  // While there is no socket, audio is thrown away: hoarding it means transcribing the past late, and the
  // line cannot wait. Frames come 50 a second, so one warning per batch, not one per frame.
  const records = captureLog(t);
  const first = new FakeWs();
  const second = new FakeWs();
  const connector = new FakeConnector(first, second);
  const { leg } = makeLeg(connector);
  await leg.start();
  connector.held = true;
  first.drop();
  await until(() => connector.calls.length === 2);   // the reconnect hangs

  records.length = 0;
  for (let i = 0; i < 50; i++) leg.push(FRAME);       // a second of speech into nowhere
  assert.ok(leg.alive, 'the leg is coming back, not dead');
  assert.equal(leg.audioSeconds, 0, 'dropped audio is not paid for');
  assert.equal(leg.commit(), false);
  assert.equal(at(records, 'warn').filter(r => r.text.includes('drop')).length, 1);

  connector.release();
  await until(() => second.sent.length === 1);
  await tick();
  assert.deepEqual(second.types(), ['session.update'], 'dropped audio must not surface in the new session');
  await leg.aclose();
});

test('after three failed attempts the leg stays dead', async (t) => {
  const records = captureLog(t);
  const ws = new FakeWs();
  const connector = new FakeConnector(ws, new Error('down'), new Error('down'), new Error('down'), new FakeWs());
  const { leg, slept } = makeLeg(connector);
  await leg.start();
  ws.drop();
  await until(() => !leg.alive);
  await tick();
  assert.equal(connector.calls.length, 4, 'three attempts and that is all: the spare socket was never needed');
  assert.deepEqual(slept, [500, 1000, 2000]);         // the production pauses before each attempt
  assert.ok(at(records, 'error').length > 0);

  leg.push(FRAME);                                    // a dead leg swallows audio quietly
  assert.ok(leg.audioSeconds === 0 && leg.commit() === false);
  await leg.aclose();
});

test('a later outage gets its own three attempts', async () => {
  // A drop half an hour after the previous one is a new trouble, not the old one going on: three attempts again.
  const first = new FakeWs();
  const second = new FakeWs();
  const third = new FakeWs();
  const connector = new FakeConnector(first, new Error('down'), second, new Error('down'), new Error('down'), third);
  const { leg, slept } = makeLeg(connector);
  await leg.start();
  first.drop();
  await until(() => second.sent.length === 1);
  second.drop();
  await until(() => third.sent.length === 1);
  assert.ok(leg.alive && connector.calls.length === 6);
  assert.deepEqual(slept, [500, 1000, 500, 1000, 2000]);   // the backoff starts over as well
  await leg.aclose();
});

test('a server that keeps dropping right away is given up on', async (t) => {
  // The server accepts the connection and drops it at once: without a limit the leg would reconnect
  // forever, twice a second. Three short-lived sessions in a row — enough.
  const records = captureLog(t);
  const sockets = [new FakeWs(), new FakeWs(), new FakeWs(), new FakeWs()];
  const connector = new FakeConnector(...sockets);
  const { leg } = makeLeg(connector);
  await leg.start();
  for (const ws of sockets.slice(0, 3)) {
    await until(() => ws.sent.length >= 1);
    ws.drop();
  }
  await until(() => !leg.alive);
  assert.equal(connector.calls.length, 3, 'the fourth socket was not needed');
  assert.ok(at(records, 'error').length > 0);
  await leg.aclose();
});

test('a slow socket costs audio never the line', async (t) => {
  // The network cannot keep up — audio is lost, but push neither waits nor throws: reading from the line
  // cannot stall.
  const records = captureLog(t);
  const ws = new FakeWs({ slow: true });
  const { leg } = makeLeg(new FakeConnector(ws));
  await leg.start();
  for (let i = 0; i < 450; i++) leg.push(FRAME);      // 9 s, and the socket never let a byte out
  // about 8 s reached the socket (aidispatch: a queue of 400 frames of 20 ms), the rest was dropped
  assert.ok(leg.audioSeconds >= 8 && leg.audioSeconds < 8.2, `audioSeconds = ${leg.audioSeconds}`);
  assert.equal(at(records, 'warn').filter(r => r.text.includes('drop')).length, 1);
  assert.equal(leg.commit(), false, 'a commit with no room in the socket is not sent');
  assert.ok(!ws.types().includes('input_audio_buffer.commit'));
  await leg.aclose();
});

// --- start and end --------------------------------------------------------------------------------

test('close is bounded idempotent and never reconnects', async () => {
  // A socket that does not answer the close must not eat the call teardown. A close is not a drop: no new
  // session may come up after it.
  const ws = new FakeWs({ hangOnClose: true });
  const connector = new FakeConnector(ws, new FakeWs());
  const { leg, slept } = makeLeg(connector);
  await leg.start();
  const started = performance.now();
  await leg.aclose();
  await leg.aclose();
  assert.ok(performance.now() - started < 500);
  assert.deepEqual(slept, [CLOSE_TIMEOUT_S * 1000], 'one wait for the close, bounded, and only one');
  assert.ok(ws.terminated, 'a close left unanswered is cut, so nothing holds the process');
  ws.drop();                                          // the server hangs up at last
  await tick(20);
  assert.ok(ws.closed && !leg.alive && connector.calls.length === 1);

  leg.push(FRAME);                                    // audio after the close is lost quietly
  assert.ok(leg.commit() === false && leg.audioSeconds === 0);
});

test('a call that ends while connecting leaves no socket behind', async () => {
  // The call ended while the socket was coming up: leaving it alive means paying for an empty line.
  const ws = new FakeWs();
  const connector = new FakeConnector(ws);
  connector.held = true;
  const { leg } = makeLeg(connector);
  const starting = leg.start();
  await until(() => connector.calls.length > 0);
  await leg.aclose();
  connector.release();
  assert.equal(await starting, false);
  assert.ok(ws.closed && !leg.alive);

  // the same when the handshake completes at the very moment the call ends
  const late = new FakeWs();
  const lateConnector = new FakeConnector(late);
  lateConnector.held = true;
  const { leg: lateLeg } = makeLeg(lateConnector);
  const lateStarting = lateLeg.start();
  lateConnector.release();
  const closing = lateLeg.aclose();
  assert.equal(await lateStarting, false);
  await closing;
  assert.ok(late.closed && !lateLeg.alive);
});

test('a leg that never came up swallows audio quietly', async () => {
  const { leg } = makeLeg(new FakeConnector(new Error('no route')));
  leg.push(FRAME);                                    // not up: push must stay quiet, not throw
  assert.ok(leg.commit() === false && leg.audioSeconds === 0);
  assert.equal(await leg.start(), false);
  assert.ok(!leg.alive);
  await leg.aclose();

  // a connect that throws outright is the same failure
  const { leg: other } = makeLeg(new FakeConnector());
  assert.equal(await other.start(), false);
  assert.ok(!other.alive);
  await other.aclose();
});

test('the price is per minute of audio sent', async () => {
  // The transcription model is billed per minute of audio, not per token. The leg counts the seconds that
  // reached the socket; the call assembly prices them.
  const { leg } = makeLeg(new FakeConnector(new FakeWs()));
  assert.equal(leg.audioSeconds, 0);
  await leg.start();
  const second = Buffer.alloc(RATE * 2);              // 1 s of PCM16 24 kHz
  for (let i = 0; i < 90; i++) leg.push(second);
  approx(leg.audioSeconds / 60, 1.5);
  await leg.aclose();
});

test('the contract matches what the live API accepted', () => {
  assert.ok(TRANSCRIBE_MODEL === 'gpt-live-transcribe' && RATE === 24000 && MIN_COMMIT_MS === 100);
  assert.equal(DELAY, 'low');
  assert.deepEqual(BACKOFF_S, [0.5, 1.0, 2.0]);
  assert.equal(TRANSCRIBE_FORMAT, 'pcmu');            // Twilio's µ-law, checked live on the smoke scene
});

// --- additions: µ-law input, a new language pair mid-call, a session that lived long -------------

test('a pcmu session names µ-law and counts 8000 bytes a second', async () => {
  // Twilio's own µ-law, a byte a sample at 8 kHz: 100 ms is 800 bytes, a second is 8000.
  const ws = new FakeWs();
  const { leg } = makeLeg(new FakeConnector(ws), { format: 'pcmu' });
  await leg.start();
  assert.deepEqual(ws.events()[0].session.audio.input.format, { type: 'audio/pcmu' });
  const frame = Buffer.alloc(160, 0xff);              // 20 ms of µ-law silence
  for (let i = 0; i < 4; i++) leg.push(frame);        // 80 ms
  assert.equal(leg.commit(), false);
  leg.push(frame);                                    // 100 ms
  assert.equal(leg.commit(), true);
  approx(leg.audioSeconds, 0.1);
  await leg.aclose();
});

test('new languages reach the live session and every session after a reconnect', async () => {
  const first = new FakeWs();
  const second = new FakeWs();
  const connector = new FakeConnector(first, second);
  const { leg } = makeLeg(connector);
  await leg.start();
  leg.setLanguages(['es', 'en', 'es']);
  assert.equal(first.types()[1], 'session.update');
  assert.deepEqual(first.events()[1].session.audio.input.transcription.languages, ['es', 'en']);

  connector.held = true;
  first.drop();
  await until(() => connector.calls.length === 2);
  leg.setLanguages(['de', 'en']);                     // no socket yet: nothing to send, but remembered
  assert.equal(first.sent.length, 2);
  connector.release();
  await until(() => second.sent.length === 1);
  assert.deepEqual(second.events()[0].session.audio.input.transcription.languages, ['de', 'en']);
  await leg.aclose();
});

test('a session that lived long is a recovery and the count of short ones starts over', async (t) => {
  // A long call loses its session now and then (the server limits a session's life): a drop after a healthy
  // stretch is a new trouble. Only short-lived sessions in a row mean a server that keeps dropping.
  let clock = 0;                                      // ms
  t.mock.method(performance, 'now', () => clock);
  const sockets = [new FakeWs(), new FakeWs(), new FakeWs(), new FakeWs(), new FakeWs(), new FakeWs()];
  const connector = new FakeConnector(...sockets);
  const { leg } = makeLeg(connector);
  await leg.start();
  for (const [i, ws] of sockets.slice(0, 5).entries()) {
    await until(() => ws.sent.length >= 1);
    if (i === 2) clock += 10_000;                     // the third session lives 10 s
    ws.drop();
  }
  // short, short, long (the count starts over), short, short: still coming back, not given up
  await until(() => sockets[5].sent.length === 1);
  assert.ok(leg.alive && connector.calls.length === 6);
  await leg.aclose();
});

test('a handshake that times out is a failed connect', async () => {
  // ws cuts a handshake the server never answers after HANDSHAKE_TIMEOUT_MS and reports it like any failure,
  // an error and then the close: at the start the leg does not come up, and mid-call it goes on to the next
  // attempt instead of hanging on a dead one.
  assert.equal(HANDSHAKE_TIMEOUT_MS, 10_000);
  const hung = new FakeWs({ stall: true });
  const { leg } = makeLeg(new FakeConnector(hung));
  let settled = false;
  const starting = leg.start().finally(() => { settled = true; });
  await tick();
  assert.ok(!settled, 'the start waits on the handshake');
  hung.timeOut();
  assert.equal(await starting, false);
  assert.ok(!leg.alive);
  await leg.aclose();

  const first = new FakeWs();
  const stalled = new FakeWs({ stall: true });
  const second = new FakeWs();
  const connector = new FakeConnector(first, stalled, second);
  const { leg: midCall, slept } = makeLeg(connector);
  await midCall.start();
  first.drop();
  await until(() => connector.calls.length === 2);   // the first attempt hangs in the handshake...
  stalled.timeOut();                                  // ...until the timer cuts it
  await until(() => second.sent.length === 1);
  assert.ok(midCall.alive && connector.calls.length === 3);
  assert.deepEqual(slept, [500, 1000], 'the next attempt comes after its own pause');
  await midCall.aclose();
});

test('a failed connect says why in the log but never the message', async (t) => {
  // An HTTP status or an error code tells a bad key from a dead network; the message itself may carry
  // secrets, so it never reaches the log.
  const records = captureLog(t);
  const unauthorized = Object.assign(new Error('Unexpected server response: 401'), {});
  const refused = Object.assign(new Error('connect ECONNREFUSED 10.1.2.3:443'), { code: 'ECONNREFUSED' });
  for (const err of [unauthorized, refused]) {
    const { leg } = makeLeg(new FakeConnector(err));
    assert.equal(await leg.start(), false);
    await leg.aclose();
  }
  const failed = at(records, 'warn').filter(r => r.text.includes('failed to connect'));
  assert.deepEqual(failed.map(r => JSON.parse(r.text)[0]), [
    { err: 'Error', status: 401 },
    { err: 'Error', code: 'ECONNREFUSED' },
  ]);
  assert.ok(!records.some(r => r.text.includes('Unexpected server response') || r.text.includes('10.1.2.3')),
    'the message never reaches the log');
});

test('a session the server refuses fails the start and closes the socket', async (t) => {
  // The start is done only once the server takes the session: a refused one (the model not enabled for the
  // key) must fail it, so the call falls back to the cascade instead of staying silent until the idle hang-up.
  const records = captureLog(t);
  const ws = new FakeWs({ session: 'refuse' });
  const connector = new FakeConnector(ws);
  const { leg } = makeLeg(connector);
  assert.equal(await leg.start(), false);
  assert.ok(ws.closed && !leg.alive && connector.calls.length === 1);
  const refused = at(records, 'warn').filter(r => r.text.includes('session refused'));
  assert.deepEqual(refused.map(r => JSON.parse(r.text)[0]), [
    { code: 'model_not_found', type: 'invalid_request_error' },
  ]);
  assert.ok(!records.some(r => r.text.includes('does not exist')), 'the message never reaches the log');
  await leg.aclose();
});

test('a session left unanswered fails the start after the timeout', async () => {
  const ws = new FakeWs({ session: 'ignore' });
  const { leg } = makeLeg(new FakeConnector(ws), { acceptTimeoutMs: 30 });
  const started = performance.now();
  let result: boolean | undefined;
  void leg.start().then((ok) => { result = ok; });
  await until(() => result !== undefined);            // the polling holds the loop: the leg's own timer does not
  assert.equal(result, false);
  assert.ok(performance.now() - started >= 25, 'it waited for the answer');
  assert.ok(ws.closed && !leg.alive);
  await leg.aclose();
});

test('a reconnect sends the session and goes on without waiting for it', async (t) => {
  // Mid-call the line cannot wait for the server's answer: the new session is used at once, and an error
  // about it is only logged, as before.
  const records = captureLog(t);
  const first = new FakeWs();
  const second = new FakeWs({ session: 'refuse' });
  const { leg } = makeLeg(new FakeConnector(first, second));
  await leg.start();
  first.drop();
  await until(() => second.sent.length === 1);
  leg.push(FRAME);
  assert.equal(second.types()[1], 'input_audio_buffer.append', 'audio goes to the new session at once');
  await until(() => at(records, 'warn').some(r => r.text.includes('model_not_found')));
  assert.ok(leg.alive && !second.closed);
  await leg.aclose();
});
