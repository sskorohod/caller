/**
 * The consecutive interpreter through one and the same conversation, without a phone call: a scene
 * to compare changes by. Port of aidispatch's scripts/consecutive_smoke.py (9e4b1eb).
 *
 * Run in the backend container on the mini. The OpenAI key is the admin's provider credential,
 * read inside the process and never printed (OPENAI_API_KEY in the environment wins):
 *
 *   docker compose run --rm --no-deps -T backend \
 *     node dist/scripts/consecutive-smoke.js --out /tmp/smoke [--echo-db -30] [--format pcmu]
 *
 * With --rm the files leave with the container, the report on stdout stays; to keep them mount a
 * folder the container's user (uid 1001) can write to: `-v ~/smoke:/tmp/smoke`.
 *
 * The line is what Twilio's single leg carries on a speakerphone call: both voices on one 8 kHz
 * track. There is no echo of ours by default; --echo-db adds it (−30: 250 ms after us and 30 dB
 * quieter) — does the interpreter translate itself? --format pcmu gives the transcriber Twilio's
 * µ-law as it is instead of PCM at 24 kHz — does gpt-live-transcribe take it? The scene reacts to
 * the interpreter: "Yeah." sounds once a translation is playing, the answer once it has played,
 * the interruption in the middle of one.
 *
 * Out: smoke.wav (stereo: left the line, right us) and smoke.json (the translator's summary with
 * latencies, timeline and cost; the utterances; the scene log). The same input before and after
 * a change is the comparison.
 */
import { accessSync, constants, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import OpenAI from 'openai';
import { Downsampler3, FRAME_MS, FRAME_SAMPLES, LINE_RATE, mulawToPcm, pcmToMulaw } from '../services/consecutive/audio.js';
import { loadConsecutiveSettings } from '../services/consecutive/settings.js';
import { TRANSCRIBE_FORMAT, type TranscribeFormat } from '../services/consecutive/transcribe.js';
import { ConsecutiveTranslator } from '../services/consecutive/translator.js';

const RATE = LINE_RATE;   // the line: PCM16 at 8 kHz, as Twilio carries it
const ECHO_DELAY_S = 0.25;
const TRIGGER_TIMEOUT_S = 25;
const GREETING = "Hi, I'm the interpreter. Здравствуйте, я переводчик.";
const LONG_RU = 'Смотрите, ситуация такая. Посудомойка стоит у нас на кухне уже лет пять. '
  + 'Последние две недели она перестала сливать воду, внизу постоянно стоит лужа. '
  + 'Мы чистили фильтр, как написано в инструкции, но это не помогло. '
  + 'Потом появился странный запах, как будто что-то горелое. '
  + 'Мастер из другой компании приходил в прошлый вторник и сказал, что, скорее всего, сломался насос. '
  + 'Он назвал цену двести восемьдесят долларов, но деталь так и не привёз. '
  + 'Поэтому мы хотим понять, можете ли вы приехать в четверг после обеда и сколько это будет стоить.';

interface Step {
  who: 'A' | 'B';   // A speaks Russian (the subscriber), B English
  text: string;
  after: 'start' | 'prev_end' | 'playing' | 'played';
  gap: number;      // seconds after the trigger
  pauses?: boolean; // a long speech: sentences with short pauses inside the thought
}

const SCENE: Step[] = [
  { who: 'A', text: 'Я вчера разговаривал с менеджером, и он сказал, что', after: 'start', gap: 1.0 },
  { who: 'A', text: 'деньги за ремонт вернут в пятницу, но только если мы пришлём фотографии сломанной детали.',
    after: 'prev_end', gap: 0.9 },                                          // an unfinished thought with a 0.9 s pause
  { who: 'B', text: 'Yeah.', after: 'playing', gap: 1.2 },                  // a backchannel over the translation
  { who: 'B', text: 'Okay. Can you ask him what time on Friday? My number is three one zero, five five five, '
    + 'one two one two.', after: 'played', gap: 0.6 },
  { who: 'A', text: 'Нет, подождите, я перепутал: не в пятницу, а в четверг, после обеда.', after: 'playing', gap: 1.5 },
  { who: 'B', text: 'Got it, Thursday afternoon then. Thank you.', after: 'played', gap: 0.6 },
  { who: 'A', text: 'Мы хотели бы вас предупредить, чтобы вы взяли с собой сумку.', after: 'played', gap: 0.6 },
  { who: 'A', text: 'И ещё сменную обувь, там будет грязно.', after: 'playing', gap: 0.7 },   // went on as the translation began
  { who: 'A', text: LONG_RU, after: 'played', gap: 0.8, pauses: true },    // a monologue with pauses under 700 ms
  { who: 'B', text: 'Stop.', after: 'playing', gap: 2.5 },
  { who: 'B', text: 'Sorry, could you repeat the price?', after: 'prev_end', gap: 0.4 },
];
const VOICES = { A: 'ash', B: 'marin' };

/** Seconds, on the translator's own clock. */
const now = () => performance.now() / 1000;
const clamp16 = (x: number) => Math.max(-32768, Math.min(32767, Math.round(x)));

function samples(pcm: Buffer): Float32Array {
  const out = new Float32Array(pcm.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = pcm.readInt16LE(i * 2);
  return out;
}

interface Clip { start: number; pcm: Float32Array }

/** The line: the scene's voices on schedule, our voice as Twilio plays it, and its echo. */
class Mixer {
  pos = 0;                              // samples since the line started
  private playout = 0;                  // where our next frame sounds
  private clips: Clip[] = [];
  private echo: Clip[] = [];
  private ours: Clip[] = [];            // what we played: the right channel of the recording
  private readonly line: Buffer[] = []; // what the line carried: the left channel
  private readonly echoDelay = ECHO_DELAY_S * RATE;

  constructor(private readonly echoGain: number) {}

  /** A voice, from the next sample on. Returns where it ends. */
  add(pcm: Buffer): number {
    const clip = samples(pcm);
    const start = this.pos + 1;
    this.clips.push({ start, pcm: clip });
    return start + clip.length;
  }

  /** A frame of ours as Twilio gets it: played after what it already holds. */
  our(pcm: Buffer): void {
    const clip = samples(pcm);
    const start = Math.max(this.playout, this.pos);
    this.ours.push({ start, pcm: clip });
    if (this.echoGain > 0) this.echo.push({ start: start + this.echoDelay, pcm: clip.map(x => x * this.echoGain) });
    this.playout = start + clip.length;
  }

  /** Twilio's `clear`: what has not sounded yet never will, nor will its echo. */
  clear(): void {
    this.ours = this.ours.filter(c => c.start < this.pos);
    this.echo = this.echo.filter(c => c.start - this.echoDelay < this.pos);
    this.playout = this.pos;
  }

  /** Everything of ours Twilio got has sounded. */
  get playedOut(): boolean {
    return this.pos >= this.playout;
  }

  nextFrame(): Buffer {
    const lo = this.pos;
    const hi = lo + FRAME_SAMPLES;
    const out = new Float32Array(FRAME_SAMPLES);
    for (const { start, pcm } of [...this.clips, ...this.echo]) {
      for (let i = Math.max(lo, start); i < Math.min(hi, start + pcm.length); i++) out[i - lo] += pcm[i - start];
    }
    this.clips = this.clips.filter(c => c.start + c.pcm.length > hi);
    this.echo = this.echo.filter(c => c.start + c.pcm.length > hi);
    this.pos = hi;
    const frame = Buffer.alloc(FRAME_SAMPLES * 2);
    for (let i = 0; i < FRAME_SAMPLES; i++) frame.writeInt16LE(clamp16(out[i]), i * 2);
    this.line.push(frame);
    return frame;
  }

  /** Stereo PCM16 at 8 kHz: left the line, right us. */
  wav(path: string): void {
    const n = this.line.length * FRAME_SAMPLES;
    const left = Buffer.concat(this.line);
    const right = new Float32Array(n);
    for (const { start, pcm } of this.ours) {
      for (let i = start; i < Math.min(start + pcm.length, n); i++) right[i] += pcm[i - start];
    }
    const out = Buffer.alloc(44 + n * 4);
    out.write('RIFF', 0, 'ascii');
    out.writeUInt32LE(36 + n * 4, 4);
    out.write('WAVEfmt ', 8, 'ascii');
    out.writeUInt32LE(16, 16);         // fmt chunk size
    out.writeUInt16LE(1, 20);          // PCM
    out.writeUInt16LE(2, 22);          // channels
    out.writeUInt32LE(RATE, 24);
    out.writeUInt32LE(RATE * 4, 28);   // bytes per second
    out.writeUInt16LE(4, 32);          // bytes per sample, both channels
    out.writeUInt16LE(16, 34);         // bits per sample
    out.write('data', 36, 'ascii');
    out.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++) {
      out.writeInt16LE(left.readInt16LE(i * 2), 44 + i * 4);
      out.writeInt16LE(clamp16(right[i]), 46 + i * 4);
    }
    writeFileSync(path, out);
  }
}

/** The key the translator gets on a call. Never printed. */
async function openaiKey(): Promise<string> {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  // imported here: it pulls the database
  const { getAdminWorkspaceId, resolveCredentials } = await import('../services/credential-resolver.service.js');
  const ws = await getAdminWorkspaceId();
  return (await resolveCredentials<{ api_key: string }>(ws, 'openai')).api_key;
}

/** Synthesis's silence around the voice goes, 100 ms on each side stays: the first sound must not be cut. */
function trim(pcm24: Buffer): Buffer {
  const n = pcm24.length >> 1;
  let first = -1;
  let last = -1;
  for (let i = 0; i < n; i++) {
    if (Math.abs(pcm24.readInt16LE(i * 2)) > 300) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return pcm24;
  return pcm24.subarray(Math.max(first - 2400, 0) * 2, Math.min(last + 2400, n) * 2);
}

async function synth(client: OpenAI, text: string, voice: string): Promise<Buffer> {
  const response = await client.audio.speech.create({ model: 'gpt-4o-mini-tts', voice, input: text, response_format: 'pcm' });
  return new Downsampler3().push(trim(Buffer.from(await response.arrayBuffer())));
}

/** The scene voiced before the call: a clip per step, per sentence for a speech with pauses. */
async function clips(client: OpenAI): Promise<Buffer[][]> {
  const out: Buffer[][] = [];
  for (const step of SCENE) {
    const parts = step.pauses ? step.text.split('. ').filter(s => s.trim()).map(s => `${s.trim()}.`) : [step.text];
    const voiced: Buffer[] = [];
    for (const part of parts) voiced.push(await synth(client, part.replaceAll('..', '.'), VOICES[step.who]));
    out.push(voiced);
  }
  return out;
}

interface Args { out: string; echoDb: number | null; format: TranscribeFormat }

const USAGE = 'usage: node dist/scripts/consecutive-smoke.js [--out DIR] [--echo-db DB] [--format pcm24|pcmu]';

/** By hand: util.parseArgs refuses the "-30" of "--echo-db -30" as a value. */
function parseArgs(argv: string[]): Args {
  const args: Args = { out: '/tmp/consecutive-smoke', echoDb: null, format: TRANSCRIBE_FORMAT };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1] ?? '';
    if (flag === '--out' && value) args.out = value;
    else if (flag === '--echo-db' && value && Number.isFinite(Number(value))) args.echoDb = Number(value);
    else if (flag === '--format' && (value === 'pcm24' || value === 'pcmu')) args.format = value;
    else throw new Error(USAGE);
  }
  return args;
}

interface Row {
  id: number; lang: string | null; state: string; release: string; text: string;
  eos_to_sound_ms: number | null; translation: string;
}

function report(summary: Record<string, any>, utterances: Row[], sceneLog: string[]): void {
  const s = summary;
  console.log(`\n===== ${s.engine} =====`);
  console.log(`latency EOS→sound p50 ${s.latency_ms.p50} p90 ${s.latency_ms.p90} (n=${s.latency_ms.n}); `
    + `release p50 ${s.release_ms.p50}; judge p50 ${s.judge_ms.p50}; cost $${s.cost_usd.toFixed(4)} ${JSON.stringify(s.costs)}`);
  console.log('counts:', JSON.stringify(s.counts));
  console.log('echo:', JSON.stringify(s.echo));
  for (const row of utterances) {
    console.log(`  #${row.id} ${row.lang} ${row.state.padEnd(11)} ${(row.release || '-').padEnd(11)} `
      + `${String(row.eos_to_sound_ms ?? '-').padStart(5)} ms | ${JSON.stringify(row.text.slice(0, 70))}\n`
      + `      → ${JSON.stringify(row.translation.slice(0, 110))}`);
  }
  for (const line of sceneLog) if (line.startsWith('timeout')) console.log('  !', line);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(args.out, { recursive: true });
  accessSync(args.out, constants.W_OK);   // fail now, not after the whole scene
  const apiKey = await openaiKey();
  const audio = await clips(new OpenAI({ apiKey }));

  const mixer = new Mixer(args.echoDb === null ? 0 : 10 ** (args.echoDb / 20));
  // Twilio instead of LiveKit: the translator writes µ-law to a fake stream socket. Twilio
  // plays what it receives after what is already queued, and `clear` drops the rest — the
  // mixer does the same, so the recording is what the people would hear.
  const socket = {
    readyState: 1,
    send(data: string) {
      const msg = JSON.parse(data);
      if (msg.event === 'media') mixer.our(mulawToPcm(Buffer.from(msg.media.payload, 'base64')));
      else if (msg.event === 'clear') mixer.clear();
    },
  };
  const translator = new ConsecutiveTranslator({
    callId: 'smoke', workspaceId: 'smoke', myLanguage: 'ru', targetLanguage: 'en',
    socket, streamSid: 'MZsmoke', ttsVoiceId: 'marin', greetingText: GREETING, greetingDelaySeconds: 0,
    // Settings loaded here rather than in start(): start() then builds the core at once, and the
    // core's timeline (summary.events) counts from the same t0 as the scene log.
    parts: { apiKey, persist: false, transcribeFormat: args.format, settings: await loadConsecutiveSettings() },
  });
  const t0 = now();
  await translator.start();
  const stamp = () => (now() - t0).toFixed(2);

  // The line: a frame every 20 ms, counted from the start so the timer's delays do not add up.
  let running = true;
  const line = (async () => {
    const start = performance.now();
    for (let n = 1; running; n++) {
      translator.sendAudio(pcmToMulaw(mixer.nextFrame()));
      await sleep(Math.max(0, start + n * FRAME_MS - performance.now()));
    }
  })();
  const sceneLog = [`${stamp()} line starts (0:00 of smoke.wav); `
    + `echo ${args.echoDb === null ? 'off' : `${args.echoDb} dB`}, transcription ${args.format}`];

  const floor = translator.floor;
  const utterances = () => [...floor.utterances.values()];
  const playing = () => utterances().some(u => u.state === 'playing' && !u.greeting);
  const idle = () => !utterances().some(u => ['open', 'candidate', 'released', 'playing'].includes(u.state));
  // The translator counts a reply played once Twilio has its last frame, up to 400 ms before it
  // sounds; people answer what they hear.
  const played = () => idle() && mixer.playedOut;
  const until = async (cond: () => boolean, label: string) => {
    const end = now() + TRIGGER_TIMEOUT_S;
    while (now() < end) {
      if (cond()) return;
      await sleep(20);
    }
    sceneLog.push(`timeout waiting for ${label} at ${stamp()}`);
  };

  await until(() => ['done', 'dropped'].includes(utterances().find(u => u.greeting)?.state ?? ''), 'greeting');
  for (const [i, step] of SCENE.entries()) {
    if (step.after === 'playing') {
      await until(playing, 'playing');
    } else if (step.after === 'played') {
      await sleep(300);
      await until(played, 'played');
    }
    // start / prev_end: the greeting or the previous step has just ended — only the gap
    await sleep(step.gap * 1000);
    sceneLog.push(`${stamp()} ${step.who}: ${step.text.slice(0, 50)}`);
    for (const [j, pcm] of audio[i].entries()) {
      const end = mixer.add(pcm);
      await sleep(((end - mixer.pos) / RATE) * 1000);
      if (j < audio[i].length - 1) await sleep(500);   // a pause inside the thought, under 700 ms
    }
  }
  await sleep(1000);
  await until(played, 'end');
  await sleep(2000);
  running = false;
  await line;

  const summary = translator.summary();
  const rows: Row[] = utterances().filter(u => !u.greeting).map(u => ({
    id: u.id, lang: u.lang, state: u.state, release: u.releaseReason, text: u.text,
    eos_to_sound_ms: u.playAt !== null && u.ended !== null ? Math.trunc(((u.resumedAt || u.playAt) - u.ended) * 1000) : null,
    translation: translator.translationOf(u.id),
  }));
  await translator.finalize();   // persist: false — it only closes the transcriber and the engine
  mixer.wav(join(args.out, 'smoke.wav'));
  writeFileSync(join(args.out, 'smoke.json'), JSON.stringify({ summary, utterances: rows, scene_log: sceneLog }, null, 1));
  report(summary, rows, sceneLog);
}

// process.exit: the database pool would keep the process alive; stdout is flushed first.
main().then(
  () => process.stdout.write('', () => process.exit(0)),
  (err: unknown) => process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`, () => process.exit(1)),
);
