/**
 * Turn-taking of consecutive interpretation: whose speech it is now, when a thought is finished, when its
 * translation may go out on the line, and who interrupted whom.
 *
 * Pure logic without network or sound: events in, commands out, time injected. So it is checked by the spec
 * scenarios on a fake clock rather than by live calls.
 *
 * The line: both people speak into one phone and their voices arrive mixed on one audio stream; whose words they
 * are shows only in the alphabet of the shared transcriber's text. The speech detector says "speech / silence on
 * the line" but not whose, and while we play it also hears our echo, so interruptions are caught by words, not by
 * the detector.
 *
 * End of thought per the spec: silence ≥ 700 ms and "the thought is finished". The model check takes 0.6–1 s
 * (measured 24.09) and does not fit into the window after the pause. So the fast path is a sentence-end mark in the
 * live transcript (with delay=low an unfinished "…and he said that" comes without a period), and the model's answer,
 * when it already exists for this text, outranks the mark. The check is requested ahead: at every sentence end and
 * at every pause.
 *
 * Port of aidispatch agent/consecutive/floor.py (9e4b1eb, release 2.29.0).
 */

import {
  echoesStop, endsSentence, isBackchannel, languageOf, pairScripts, scriptOf, startsWithStop, stripEcho, words,
} from './policy.js';

export const LAG_S = 0.9;             // a speech's text may still come this long after it ended (delay=low: 0.3–0.55 s)
export const TEXT_LAG_S = 0.4;        // the usual lag of a word behind its sound
export const FRESH_SEGMENT_S = 0.3;   // text this early in new speech is still the tail of the last one
export const NOISE_S = 1.5;           // speech without a single word for longer than this is noise, not a speaker
export const QUIET_S = 0.3;           // this much silence on the line, and we may start playing
export const JUDGE_DEBOUNCE_S = 0.15; // the text is still being written: ask once it settles
export const PREPARE_S = 0.6;         // the person is silent this long: the engine prepares the tail ahead while the
                                      // judge thinks...
export const PREPARE_QUIET_S = 0.25;  // ...if there were no new words this long either. Not earlier: the last word
                                      // comes 0.3–0.55 s after the speech, and a draft with an incomplete tail is
                                      // thrown away (run: 29 of 30)
export const CANDIDATE_END_S = 1.2;   // this long without new words: the interrupter has finished
export const PROMOTE_S = 1.0;         // "uh-huh" in the last second of a translation or after it is an answer already
export const ECHO_TAIL_S = 1.5;       // the echo of our sound may still come back this long after it
export const ECHO_MEMORY_S = 10.0;    // played text is remembered for the echo filter this long
export const HEAD_TIMEOUT_S = 10.0;   // a released utterance without sound longer than this stops holding the queue:
                                      // the engine broke
export const GREETING_MAX_WAIT_S = 6.0;  // the greeting waits for quiet, but not forever: both sides must know
                                         // we are on the line
export const INTENT_WAIT_S = 3.0;     // no answer about the intent this long: do not interrupt
export const INTENT_MIN_CONFIDENCE = 0.6;
export const YIELD_WORDS = 3;         // this many words of the other side in a pause are an answer, not "uh-huh"
export const FAST_WORDS = 12;         // an utterance up to this many words is released by its period; a longer one only
                                      // by the model: in a monologue a finished sentence and a 0.7 s pause are not
                                      // the end of the story yet
export const RESUME_WORDS = 2;        // this many words of the speaker over the translation of his own utterance: he
                                      // has not finished, we yield
export const RESTART_S = 3.0;         // he went on within this long of his translation starting: it restarts, whole
export const STALE_S = 8.0;           // a short reply said over someone else's thought that went on this long after
export const STALE_WORDS = 3;         // it: the talk moved on and a late translation would sound out of place; longer
                                      // replies are always translated: they carry substance
export const OVERLAP_GRACE_S = 0.2;   // words of the first speaker coming more than this after the other's utterance
                                      // began: he is still talking
export const MIN_LETTERS = 2;         // an utterance of one letter ("З", "С") is a transcription scrap, not speech
export const LEAD_WORDS = 1;          // one word of the other alphabet at the start of continuous speech is its own
                                      // beginning ("What такое…"); two may already be the other side's answer that
                                      // was talked over at once ("Not Thursday" + "А когда?")
export const LEAD_GAP_S = 0.8;        // the words of the second language followed within this
export const INSIDE_S = 1.5;          // the other language sounded within this long before a short utterance and after
                                      // it: the utterance is inside the other's speech, the transcriber wrote Russian
                                      // in English words ("uda moica")
export const HOLD_LETTER_S = 0.5;     // a single letter ("И") waits this long for the next word to show its language
export const COMMIT_MIN_S = 1.0;      // transcription segments shorter than this are not committed
export const COMMIT_AFTER_S = 10.0;   // a long monologue is committed at the nearest pause...
export const COMMIT_HARD_S = 20.0;    // ...and forcibly
export const EVENTS_MAX = 300;

export interface FloorConfig {
  langA: string;
  langB: string;
  endSilenceS?: number;   // default 0.7
  hardEndS?: number;      // default 2.2
  threshold?: number;     // default 0.8
  bargeInWords?: number;  // default 5
  silentLangs?: Iterable<string>;
}

// --- commands to the call ------------------------------------------------------------------------------------------
export type Command =
  | { kind: 'opened'; utt: number; lang: string | null; candidate: boolean }   // a new utterance: the engine sets it up
  | { kind: 'updated'; utt: number }   // the utterance's text grew: finished sentences are translated ahead
  | { kind: 'judge'; utt: number; text: string }   // ask the model whether the thought is finished
  | { kind: 'intent'; utt: number; text: string; playing: string }   // ask whether the interrupter wants the floor
  | { kind: 'release'; utt: number }   // the thought is finished: the engine completes it, the utterance is queued
  | { kind: 'play'; utt: number }      // time to sound
  | { kind: 'stop'; utt: number }      // interrupted: drop what is playing now
  | { kind: 'drop'; utt: number; reason: string }   // the utterance is not translated at all
  | { kind: 'commit' }                 // commit the transcription segment
  | { kind: 'reopened'; utt: number }  // released but not yet played, and it went on: the engine translates further
  | { kind: 'pause'; utt: number }     // the speaker went on over the translation of his words: pause it, resume after
  | { kind: 'restart'; utt: number }   // ...and it had only begun: drop its sound, translate the utterance anew, whole
  | { kind: 'prepare'; utt: number };  // the person fell silent: translate and voice the tail ahead, before the release

export type UttState = 'open' | 'candidate' | 'released' | 'playing' | 'done' | 'interrupted' | 'dropped';
export type JudgeVerdict = [complete: boolean, confidence: number] | null;
export type IntentVerdict = [label: 'interrupt' | 'ack' | 'later', confidence: number] | null;
type IntentLabel = NonNullable<IntentVerdict>[0];

/** Letters in the text, counted by code point (Python's sum(ch.isalpha() for ch in text)). */
const letters = (text: string): number => text.match(/\p{L}/gu)?.length ?? 0;
const judgeKey = (utt: number, text: string): string => `${utt}\u0000${text}`;

export class Utterance {
  id: number;
  lang: string | null;
  started: number;
  raw = '';
  state: UttState = 'open';
  greeting = false;
  paused = false;                     // played, but its speaker went on: waits at the head of the queue, resumes
  ended: number | null = null;        // end of this speaker's last speech segment
  duringPauseOf: number | null = null;  // said in the pause of another's utterance or before its translation played:
                                      // "uh-huh" is not translated
  source: number | null = null;       // whose translation was playing when the candidate began
  clean = '';                         // what was said over our sound, without the echo
  filtered = false;                   // the utterance's text is `clean`: `raw` holds our echo too
  echoPossible = false;
  realCount = 0;
  lastRealAt = -Infinity;
  verdicts = new Map<string, boolean | 'failed' | null>();   // null: the judge is not confident
  judging = new Set<string>();
  intentAt: number | null = null;
  intentLabel: IntentLabel | null = null;
  hasAudio = false;
  translation = '';
  releasedAt: number | null = null;
  releaseReason = '';
  playAt: number | null = null;
  finishedAt: number | null = null;
  firstRealAt: number | null = null;
  decidedAt: number | null = null;
  firstAt = 0;                        // when the first word came
  resumedAt: number | null = null;    // played again after a pause: latency is counted to this
  listenBase = '';                    // the text before the speaker went on over our sound
  queuedAt: number | null = null;     // first release: a reopened utterance keeps its place in the queue
  prepared = '';                      // the text the engine was last told to prepare the tail of
  over: number | null = null;         // someone else's utterance its speaker had not finished when this one was queued

  constructor(id: number, lang: string | null, started: number) {
    this.id = id;
    this.lang = lang;
    this.started = started;
  }

  get text(): string {
    return (this.filtered ? this.clean : this.raw).trim();
  }

  append(fragment: string): void {
    this.raw += fragment;
    if (this.filtered) this.clean += fragment;
  }
}

export class FloorManager {
  cfg: Required<Omit<FloorConfig, 'silentLangs'>>;
  readonly utterances = new Map<number, Utterance>();
  echo = true;   // our voice's echo on the line is possible until the call's measurement shows otherwise
  readonly events: Array<[number, string, string]> = [];
  readonly counts: Record<string, number> = {};
  readonly judgeMs: number[] = [];
  readonly bargeMs: Array<[number, number]> = [];   // first word → decision, decision → stop

  private scripts: Set<string>;
  private japanese: boolean;
  private silent: Set<string>;
  private readonly clock: () => number;
  private readonly t0: number;
  private nextId = 1;
  private out: Command[] = [];
  private speaking = false;
  private speechStarted = -Infinity;
  private speechEnded = -Infinity;
  private segmentLangs = new Set<string>();
  private lastLang: string | null = null;
  private playing: number | null = null;
  private playedUntil = -Infinity;
  private listenRaw = new Map<string, string>();
  private lastCommit: number;
  private readonly judgeSent = new Map<string, number>();
  private readonly textTimes = new Map<string, number[]>();
  private held: [string, number] | null = null;   // a single letter waiting for the next word

  constructor(config: FloorConfig, clock: () => number = () => performance.now() / 1000) {
    this.cfg = {
      langA: config.langA,
      langB: config.langB,
      endSilenceS: config.endSilenceS ?? 0.7,
      hardEndS: config.hardEndS ?? 2.2,
      threshold: config.threshold ?? 0.8,
      bargeInWords: config.bargeInWords ?? 5,
    };
    this.scripts = pairScripts(config.langA, config.langB);
    this.japanese = config.langA === 'ja' || config.langB === 'ja';
    this.silent = new Set(config.silentLangs ?? []);
    this.clock = clock;
    this.t0 = clock();
    this.lastCommit = this.t0;
  }

  // --- inputs ------------------------------------------------------------------------------------------------------
  vadStart(): Command[] {
    const now = this.clock();
    this.speaking = true;
    this.speechStarted = now;
    this.segmentLangs = new Set();
    return this.finish();
  }

  vadEnd(silenceS: number): Command[] {
    const now = this.clock();
    const end = now - Math.max(silenceS, 0.0);
    this.speaking = false;
    this.speechEnded = end;
    if (!this.listening(now)) {
      for (const u of this.open()) {
        if (u.lang !== null && this.segmentLangs.has(u.lang)) u.ended = end;
      }
      const opened = this.open();
      const elapsed = now - this.lastCommit;
      if (elapsed >= COMMIT_AFTER_S
          || (elapsed >= COMMIT_MIN_S && opened.length > 0 && endsSentence(opened[opened.length - 1].raw))) {
        this.commit(now);
      }
    }
    this.segmentLangs = new Set();
    return this.finish();
  }

  text(fragment: string): Command[] {
    const now = this.clock();
    if (this.held !== null) {
      fragment = this.held[0] + fragment;
      this.held = null;
    } else if (scriptOf(fragment, this.japanese) === null && letters(fragment) === 1) {
      // A single letter ("И", "I", "a") gives no alphabet away, and inheriting the last speaker's language would glue
      // the start of a new utterance to someone else's. Wait for the next word: it shows whose it is.
      this.held = [fragment, now];
      return this.finish();
    }
    this.route(fragment, now);
    return this.finish();
  }

  private route(fragment: string, now: number): void {
    const script = scriptOf(fragment, this.japanese);
    if (script !== null && !this.scripts.has(script)) {
      // On echo and overlaps the transcriber writes Japanese, Greek and the like. Neither side speaks such a piece,
      // and tying it to the last language would pour garbage into someone's utterance.
      this.inc('foreign_text');
      return;
    }
    const lang = languageOf(fragment, this.cfg.langA, this.cfg.langB) || this.lastLang;
    if (lang === null || !fragment) return;
    this.lastLang = lang;
    let times = this.textTimes.get(lang);
    if (times === undefined) {
      times = [];
      this.textTimes.set(lang, times);
    }
    times.push(now);
    if (times.length > 400) times.shift();
    const late = this.lateOwner(lang, now);
    if (late !== null) {
      late.append(fragment);   // the tail of an utterance released already: words come half a second late
      this.out.push({ kind: 'updated', utt: late.id });
    } else if (this.listening(now) || this.candidateFor(lang) !== null) {
      this.hearWhilePlaying(lang, fragment, now);
    } else {
      this.hear(lang, fragment, now);
    }
  }

  judged(utt: number, text: string, verdict: JudgeVerdict): Command[] {
    const u = this.utterances.get(utt);
    if (u !== undefined) {
      u.judging.delete(text);
      const key = judgeKey(utt, text);
      const sent = this.judgeSent.get(key);
      this.judgeSent.delete(key);
      if (sent !== undefined) this.judgeMs.push(Math.trunc((this.clock() - sent) * 1000));
      if (verdict === null) {
        u.verdicts.set(text, 'failed');   // the model did not answer: the sentence-end mark decides, as without it
        this.inc('judge_failed');
      } else {
        const [complete, confidence] = verdict;
        u.verdicts.set(text, confidence >= this.cfg.threshold ? complete : null);
        this.log('judge', `#${utt} ${complete ? 'complete' : 'incomplete'} ${confidence.toFixed(2)}`);
      }
    }
    return this.finish();
  }

  intent(utt: number, verdict: IntentVerdict): Command[] {
    const now = this.clock();
    const u = this.utterances.get(utt);
    if (u === undefined || u.state !== 'candidate') return this.finish();
    const label: IntentLabel = verdict && verdict[1] >= INTENT_MIN_CONFIDENCE ? verdict[0] : 'later';
    this.log('intent', `#${utt} ${verdict ? verdict[0] : 'none'} → ${label}`);
    this.inc(`intent_${label}`);
    u.intentLabel = label;
    if (label === 'interrupt') {
      this.interrupt(u, now, 'intent');
    } else if (label === 'later') {
      this.accept(u, now);
    }
    // "ack" is decided at the end, like "uh-huh": agreement in the last second of a translation is an answer already
    return this.finish();
  }

  audio(utt: number): Command[] {
    const u = this.utterances.get(utt);
    if (u !== undefined) u.hasAudio = true;
    return this.finish();
  }

  /** The text of our translation: by it the echo filter knows our voice coming back from the line. */
  translation(utt: number, text: string): void {
    const u = this.utterances.get(utt);
    if (u !== undefined) u.translation += text;
  }

  finished(utt: number): Command[] {
    const now = this.clock();
    const u = this.utterances.get(utt);
    if (u !== undefined && u.state === 'playing') {
      u.state = 'done';
      u.finishedAt = now;
      this.playing = null;
      this.playedUntil = now;
      this.log('played', `#${utt}`);
    }
    return this.finish();
  }

  greeting(text: string): [number, Command[]] {
    const now = this.clock();
    const u = this.newUtterance(null, now, { greeting: true });
    u.raw = u.translation = text;
    u.state = 'released';
    u.releasedAt = now;
    u.releaseReason = 'greeting';
    return [u.id, this.finish()];
  }

  /** The call's measurement: whether our echo is heard on the line. Without echo, words over a translation are real. */
  setEcho(present: boolean): void {
    if (present !== this.echo) {
      this.echo = present;
      this.log('echo', present ? 'on' : 'off');
    }
  }

  /** Drop an utterance from outside: say, a greeting that could not be voiced. */
  discard(utt: number, reason: string): Command[] {
    const u = this.utterances.get(utt);
    if (u !== undefined) this.drop(u, reason, this.clock());
    return this.finish();
  }

  tick(): Command[] {
    return this.finish();
  }

  /** One-way mode: replies in these languages are translated as text only and never queue for playback. */
  setSilentLangs(langs: Iterable<string>): void {
    this.silent = new Set(langs);
  }

  /** A text-only reply got its translation: it is over. No finishedAt — it never sounded,
   *  so it is neither a playback source nor text for the echo filter. */
  textDone(utt: number): Command[] {
    const u = this.utterances.get(utt);
    if (u && u.state === 'released' && !u.greeting) {
      u.state = 'done';
      this.log('text', `#${utt}`);
    }
    return this.finish();
  }

  /** Translator paused: silence what plays and forget everything in flight. */
  pauseAll(reason: string): Command[] {
    const now = this.clock();
    const playing = this.playing !== null ? this.utterances.get(this.playing) : undefined;
    if (playing) {
      playing.state = 'interrupted';
      playing.finishedAt = now;
      this.playing = null;
      this.playedUntil = now;
      this.out.push({ kind: 'stop', utt: playing.id });
      this.log('stop', `#${playing.id} (${reason})`);
    }
    for (const u of this.utterances.values()) {
      if (u.state === 'open' || u.state === 'candidate' || u.state === 'released') this.drop(u, reason, now);
    }
    this.listenRaw.clear();
    this.held = null;
    return this.finish();
  }

  setLanguages(langA: string, langB: string): void {
    this.cfg = { ...this.cfg, langA, langB };
    this.scripts = pairScripts(langA, langB);
    this.japanese = langA === 'ja' || langB === 'ja';
  }

  // --- hearing speech ----------------------------------------------------------------------------------------------
  private hear(lang: string, fragment: string, now: number): void {
    const fresh = this.speaking && now - this.speechStarted < FRESH_SEGMENT_S;
    if (this.speaking && !fresh) this.segmentLangs.add(lang);
    let u = this.openFor(lang);
    let lead: Utterance | null = null;
    if (u === null) {
      // The transcriber wrote the start of this same speech in the other alphabet (call 24.09 20:02: "What такое
      // говорите?" sent "Что?" to the Russian side and "Is that what you're saying?" to the English one).
      // One continuous speech is one utterance: the translation model sees it whole.
      lead = this.leadIn(lang, now);
      if (lead !== null) this.drop(lead, 'lead_in', now);
      u = this.reopenable(lang, now);
    }
    if (u === null) {
      u = this.newUtterance(lang, now);
      if (lead !== null) {
        u.firstAt = lead.firstAt;
        u.started = lead.started;
      }
      // Someone else's thought has not reached the listener yet: its speaker is in a pause, or its translation waits
      // in the queue. "Uh-huh" at such a time reacts to the sound of their speech and is no answer (call 24.09 21:29:
      // "Hmm" held a ready translation 2.8 s and then sounded itself as "Хм."; "Okay" before our introduction became
      // "Хорошо." 5.4 s later).
      const others = [...this.utterances.values()].filter((o) => o.lang !== lang
        && ((o.state === 'open' && o.realCount > 0) || o.state === 'released'));
      if (others.length > 0) u.duringPauseOf = others[others.length - 1].id;
    }
    if (lead !== null) u.append((u.raw ? ' ' : '') + lead.text);
    u.append(fragment);
    u.realCount = words(u.text).length;
    u.lastRealAt = now;
    if (this.speaking && !fresh) {
      u.ended = null;             // speaking right now
    } else if (now - this.speechEnded <= LAG_S) {
      // the text of speech that has ended already: this speaker sounded in it too
      u.ended = Math.max(u.ended ?? -Infinity, this.speechEnded);
    } else {
      // words come while the speech detector is silent (a quiet voice below its threshold): words prove speech too
      u.ended = now - TEXT_LAG_S;
    }
    this.out.push({ kind: 'updated', utt: u.id });
  }

  /** Words said over our sound. The speech detector cannot be trusted here: it hears our echo too. */
  private hearWhilePlaying(lang: string, fragment: string, now: number): void {
    const source = this.sourceOfPlayback();
    this.listenRaw.set(lang, (this.listenRaw.get(lang) ?? '') + fragment);
    const raw = this.listenRaw.get(lang)!;
    // our translation sounds in the listener's language; speech in the source utterance's language cannot be echo
    const echoPossible = this.echo && (source === null || source.lang === null || source.lang !== lang);
    const [clean, count] = this.clean(raw, echoPossible, now);
    const accepted = this.openFor(lang);
    if (accepted !== null && accepted.decidedAt !== null) {
      // the interrupter was accepted already (or the speaker went on with his utterance): from here he just talks
      const total = (accepted.listenBase + ' ' + clean).trim();
      if (words(total).length > accepted.realCount) {
        accepted.lastRealAt = now;
        accepted.ended = now;
      }
      accepted.clean = total;
      accepted.filtered = true;
      accepted.realCount = words(total).length;
      this.out.push({ kind: 'updated', utt: accepted.id });
      return;
    }
    if (!count) return;
    let c = [...this.utterances.values()].find((x) => x.state === 'candidate' && x.lang === lang) ?? null;
    if (c === null) {
      c = this.newUtterance(lang, now, { candidate: true });
      c.source = source ? source.id : null;
      c.firstRealAt = now;
      c.echoPossible = echoPossible;
      c.filtered = true;
      this.log('candidate', `#${c.id} ${lang}`);
    }
    if (count > c.realCount) c.lastRealAt = now;
    c.raw = raw;
    c.clean = clean;
    c.realCount = count;
    const playing = this.playing ? this.utterances.get(this.playing) ?? null : null;
    if (startsWithStop(c.clean) && !(echoPossible && echoesStop(c.clean, this.playedTexts(now)))) {
      this.inc('stop_phrase');
      this.interrupt(c, now, 'stop');
    } else if (playing !== null && playing.lang === lang && c.realCount >= RESUME_WORDS
               && !isBackchannel(c.clean)) {
      // The speaker went on over the translation of his own words: he has not finished, so we yield. If the
      // translation had just begun, the listener heard a second or two: translate the thought anew, whole, and play
      // it from the start. If it has played a while, it resumes after him from the start of the cut phrase
      // (calls 24.09).
      if (c.firstAt - (playing.resumedAt || playing.playAt || now) <= RESTART_S) {
        this.restart(playing, now);
      } else {
        this.pause(playing, now);
      }
      this.merge(c, playing, now);
    } else if (c.intentAt === null && c.realCount >= this.cfg.bargeInWords && !isBackchannel(c.clean)) {
      c.intentAt = now;
      this.out.push({ kind: 'intent', utt: c.id, text: c.clean, playing: playing ? playing.translation : '' });
    }
  }

  // --- decisions ---------------------------------------------------------------------------------------------------
  private finish(): Command[] {
    const now = this.clock();
    if (this.held !== null && now - this.held[1] >= HOLD_LETTER_S) {
      const fragment = this.held[0];
      this.held = null;
      this.route(fragment, now);   // the next word never came: decide by the last language
    }
    if (!this.listening(now) && this.listenRaw.size > 0) {
      // the buffer is needed while its candidate is undecided: it began in the echo window and ends after it
      this.listenRaw = new Map([...this.listenRaw].filter(([lang]) => this.candidateFor(lang) !== null));
    }
    this.decideCandidates(now);
    this.decideReleases(now);
    this.decideDrafts(now);
    this.decidePlayback(now);
    if (now - this.lastCommit >= COMMIT_HARD_S) this.commit(now);
    const out = this.out;
    this.out = [];
    return out;
  }

  /**
   * The person fell silent, and the thought is not released yet: the judge thinks, the pause grows. Meanwhile the
   * engine translates and voices the tail ahead: a release with the same words gets ready sound, a continuation
   * throws the draft away. Once per text of the utterance. Not while the detector hears speech: the core takes the
   * first word of new speech for the tail of the last one, and the draft would be a single word.
   */
  private decideDrafts(now: number): void {
    if (this.speaking) return;
    for (const u of this.open()) {
      if (u.greeting || u.ended === null || !u.realCount || u.text === u.prepared
          || now - u.ended < PREPARE_S || now - u.lastRealAt < PREPARE_QUIET_S) {
        continue;
      }
      u.prepared = u.text;
      this.log('prepare', `#${u.id}`);
      this.out.push({ kind: 'prepare', utt: u.id });
    }
  }

  private decideCandidates(now: number): void {
    for (const c of [...this.utterances.values()].filter((x) => x.state === 'candidate')) {
      if (c.intentAt !== null && c.intentLabel === null) {
        if (now - c.intentAt < INTENT_WAIT_S) continue;
        this.inc('intent_timeout');
        c.intentLabel = 'later';
        this.accept(c, now);      // no answer from the model in time: do not interrupt, but do not lose it either
        continue;
      }
      if (now - c.lastRealAt < CANDIDATE_END_S) continue;
      [c.clean, c.realCount] = this.clean(c.raw, c.echoPossible, now, { final: true });
      if (!c.realCount) {
        this.drop(c, 'echo', now);
        continue;
      }
      const source = c.source ? this.utterances.get(c.source) ?? null : null;
      const answered = source !== null && source.finishedAt !== null
        && c.lastRealAt >= source.finishedAt - PROMOTE_S;
      const ack = c.intentLabel === 'ack';
      if (ack || isBackchannel(c.clean)) {
        if (answered) {
          this.accept(c, now);    // "yes", "okay" in the last second of a translation is an answer
        } else {
          this.drop(c, ack ? 'ack' : 'backchannel', now);
        }
      } else if (c.echoPossible && c.intentLabel === null && c.realCount >= 2) {
        // A couple of words in the translation's language while we played: the listener's reply or our own echo
        // that the transcriber made a mess of ("My step", "City"). The text cannot tell them apart, so ask the model:
        // "ack" (and garbage) is dropped, "later" is translated after.
        c.intentAt = now;
        const playing = this.playing ? this.utterances.get(this.playing) ?? null : source;
        this.out.push({ kind: 'intent', utt: c.id, text: c.clean, playing: playing ? playing.translation : '' });
      } else if (c.realCount < 2) {
        // One word over a translation is an echo scrap rather than a reply; a reply right after a translation is
        // "yes" or "okay", and those are above, among the backchannels. But for a speaker over the translation of his
        // own words it begins his continuation, and the other words were late at the transcriber (run 24.09:
        // "Последние" came alone, "две недели" 1.2 s later): his text is kept.
        const playing = this.playing ? this.utterances.get(this.playing) ?? null : null;
        this.drop(c, 'short', now, { keepText: playing !== null && playing.lang === c.lang });
      } else {
        this.accept(c, now);      // it could not interrupt, but what was said is not lost: translated after
      }
    }
  }

  private decideReleases(now: number): void {
    const unknownSegment = this.speaking && this.segmentLangs.size === 0 && now - this.speechStarted < NOISE_S;
    for (const u of this.open()) {
      const owner = u.duringPauseOf !== null ? this.utterances.get(u.duringPauseOf) ?? null : null;
      if (owner !== null && owner.state === 'open' && owner.ended !== null
          && owner.realCount >= 2 && letters(owner.text) >= MIN_LETTERS
          && !this.inside(owner)
          && u.realCount >= YIELD_WORDS && !isBackchannel(u.text)
          && owner.lastRealAt <= u.firstAt + OVERLAP_GRACE_S
          && now - owner.lastRealAt >= this.cfg.endSilenceS) {
        // the other side spoke for real, and the first speaker has been silent since: he has finished; decide
        // without waiting for the second one to finish: it is the first one we release
        this.release(owner, now, 'yield');
        u.duringPauseOf = null;
      }
      if (this.speaking && ((u.lang !== null && this.segmentLangs.has(u.lang)) || unknownSegment)) {
        continue;                 // he is speaking himself, or it is not clear yet who is
      }
      if (u.ended === null) {
        if (this.speaking) continue;
        u.ended = this.speechEnded > -Infinity ? this.speechEnded : now;
      }
      const silence = now - u.ended;
      const text = u.text;
      if (letters(text) < MIN_LETTERS) {
        if (silence >= this.cfg.hardEndS) this.drop(u, 'empty', now);
        continue;
      }
      if (u.realCount < 2 * YIELD_WORDS && silence >= this.cfg.endSilenceS && this.inside(u)) {
        // a few words in the middle of the other side's speech that sounded both before and after them: no answer
        // but an overlap or a transcription error ("Мастер из" in Latin as "Master is", "Посудомойка" as "uda moica")
        this.drop(u, 'overlap', now);
        continue;
      }

      if (u.duringPauseOf !== null && isBackchannel(text) && silence >= this.cfg.endSilenceS) {
        const owner = this.utterances.get(u.duringPauseOf);
        if (owner !== undefined
            && (owner.state === 'open' || owner.state === 'released' || owner.state === 'playing')) {
          this.drop(u, 'backchannel', now);   // "uh-huh" in the pause of someone else's utterance: agreement only
          continue;
        }
      }
      const verdict = u.verdicts.has(text) ? u.verdicts.get(text) as boolean | 'failed' | null : 'ask';
      if (verdict === 'ask' && !u.judging.has(text) && now - u.lastRealAt >= JUDGE_DEBOUNCE_S) {
        this.askJudge(u, text, now);
      }
      if (silence >= this.cfg.endSilenceS) {
        if (verdict === true) {
          this.release(u, now, 'semantic');
          continue;
        }
        const short = words(text).length <= FAST_WORDS;
        if (endsSentence(text) && (verdict === 'failed' || (verdict === 'ask' && short))) {
          this.release(u, now, 'punctuation');
          continue;
        }
      }
      if (silence >= this.cfg.hardEndS) this.release(u, now, 'hard');
    }
    // ahead, while the person is still talking: a sentence end is a reason to ask whether the thought is finished
    for (const u of this.open()) {
      const text = u.text;
      if (text && endsSentence(text) && !u.verdicts.has(text) && !u.judging.has(text)) this.askJudge(u, text, now);
    }
  }

  private decidePlayback(now: number): void {
    if (this.playing !== null) return;
    // one-way mode: replies in the silent languages are text only and never queue
    const queue = [...this.utterances.values()]
      .filter((u) => u.state === 'released' && (u.greeting || u.lang === null || !this.silent.has(u.lang)))
      .sort((x, y) => (Number(!x.greeting) - Number(!y.greeting))
        || ((x.queuedAt || x.releasedAt || 0) - (y.queuedAt || y.releasedAt || 0))
        || (x.id - y.id));
    if (queue.length === 0) return;
    const head = queue[0];
    const waited = now - (head.releasedAt || now);
    if (this.stale(head, now)) {
      // call 24.09 20:08: "теперь правильно" waited 18.5 s for the end of the other's utterance and then sounded
      // out of place
      this.drop(head, 'stale', now);
      this.decidePlayback(now);
      return;
    }
    if (!head.hasAudio) {
      if (waited >= HEAD_TIMEOUT_S) {
        this.drop(head, 'no audio', now);
        this.decidePlayback(now);
      }
      return;
    }
    const quiet = !this.speaking && now - this.speechEnded >= QUIET_S;
    const midThought = this.open().some((u) => u.realCount > 0)
      || [...this.utterances.values()].some((u) => u.state === 'candidate');
    if ((quiet && !midThought) || (head.greeting && waited >= GREETING_MAX_WAIT_S)) {
      if (head.paused) head.resumedAt = now;
      head.state = 'playing';
      head.playAt = head.playAt || now;
      head.paused = false;
      this.playing = head.id;
      this.listenRaw = new Map();
      this.log('play', `#${head.id}`);
      this.out.push({ kind: 'play', utt: head.id });
    }
  }

  // --- actions -----------------------------------------------------------------------------------------------------
  private release(u: Utterance, now: number, reason: string): void {
    if (!u.greeting && letters(u.text) < MIN_LETTERS) {
      this.drop(u, 'empty', now);   // "С", "З": nothing to translate, whatever path led to the release
      return;
    }
    u.state = 'released';
    u.releasedAt = now;
    u.releaseReason = reason;
    if (u.queuedAt === null) {
      u.queuedAt = now;
      // said over someone else's thought its speaker has not finished yet: that is how "теперь правильно" was
      const over = this.open().filter((o) => o.lang !== u.lang && !o.greeting && o.realCount > 0
        && o.firstAt <= u.lastRealAt);
      u.over = over.length > 0 ? over[over.length - 1].id : null;
    }
    if (u.lang !== null && this.listenRaw.has(u.lang)) {
      this.listenRaw.set(u.lang, '');   // the next speech in the same language starts with a clean slate
    }
    this.inc(`release_${reason}`);
    this.log('release', `#${u.id} ${reason}`);
    this.out.push({ kind: 'release', utt: u.id });
    if (now - this.lastCommit >= COMMIT_MIN_S) this.commit(now);
  }

  private interrupt(by: Utterance, now: number, how: string): void {
    const playing = this.playing ? this.utterances.get(this.playing) ?? null : null;
    if (playing !== null) {
      playing.state = 'interrupted';
      playing.finishedAt = now;
      this.playing = null;
      this.playedUntil = now;
      this.out.push({ kind: 'stop', utt: playing.id });
      this.inc('interrupted');
      this.log('stop', `#${playing.id} by #${by.id} (${how})`);
      if (by.firstRealAt !== null) this.bargeMs.push([Math.trunc((now - by.firstRealAt) * 1000), 0]);
      // the rest of the same line of translation is not needed any more: that is exactly what was interrupted
      for (const q of [...this.utterances.values()]) {
        if (q.state === 'released' && !q.greeting && q.lang === playing.lang) this.drop(q, 'interrupted', now);
      }
    }
    this.accept(by, now);
  }

  /**
   * The speaker went on over the translation of his own words: it is the same thought going on. It is merged into
   * the same utterance, whose translation then plays whole, in one piece, not in scraps.
   */
  private merge(c: Utterance, into: Utterance, now: number): void {
    const base = into.text;
    into.state = 'open';
    into.releasedAt = null;
    into.releaseReason = '';
    into.listenBase = base;
    into.filtered = true;
    into.clean = (base + ' ' + c.clean).trim();
    into.raw = into.raw + ' ' + c.raw;
    into.realCount = words(into.clean).length;
    into.lastRealAt = now;
    into.ended = now;
    into.decidedAt = now;
    this.inc('merged');
    this.log('merge', `#${c.id} → #${into.id}`);
    c.state = 'dropped';          // on its own it is not an utterance
    c.decidedAt = now;
    this.out.push({ kind: 'drop', utt: c.id, reason: 'merged' }, { kind: 'reopened', utt: into.id },
      { kind: 'updated', utt: into.id });
  }

  private pause(playing: Utterance, now: number): void {
    playing.state = 'released';
    playing.paused = true;
    this.playing = null;
    this.playedUntil = now;
    this.inc('paused');
    this.log('pause', `#${playing.id}`);
    this.out.push({ kind: 'pause', utt: playing.id });
  }

  /**
   * The translation had only begun, and the speaker went on: the old translation no longer fits. Its sound is
   * dropped, the thought is heard out, the engine translates it anew, and it plays from the start: latency is counted
   * from the new sound.
   */
  private restart(playing: Utterance, now: number): void {
    playing.state = 'released';
    playing.paused = false;
    playing.playAt = null;
    playing.resumedAt = null;
    playing.hasAudio = false;
    playing.translation = '';
    this.playing = null;
    this.playedUntil = now;
    this.inc('restarted');
    this.log('restart', `#${playing.id}`);
    this.out.push({ kind: 'restart', utt: playing.id });
  }

  /**
   * A released utterance that has not played yet, and its speaker went on: the same thought, the pause just came out
   * longer than 700 ms. Tearing it apart would translate the story in scraps.
   */
  private reopenable(lang: string, now: number): Utterance | null {
    const same = [...this.utterances.values()].filter((u) => u.lang === lang && !u.greeting && u.state !== 'dropped');
    if (same.length === 0) return null;
    const last = same.reduce((a, b) => (b.id > a.id ? b : a));
    if (last.state !== 'released' || (last.playAt !== null && !last.paused)) {
      return null;                // playing or played already: going on is a new utterance
    }
    // a real utterance of the other side after it means a new thought, not a continuation; scraps (dropped ones,
    // candidates, a couple of words) do not break the chain
    if ([...this.utterances.values()].some((u) => u.id > last.id && u.lang !== lang && !u.greeting
        && u.state !== 'dropped' && u.state !== 'candidate' && u.realCount >= YIELD_WORDS)) {
      return null;
    }
    last.state = 'open';
    last.releasedAt = null;
    last.releaseReason = '';
    this.inc('reopened');
    this.log('reopen', `#${last.id}`);
    this.out.push({ kind: 'reopened', utt: last.id });
    return last;
  }

  /** The candidate becomes an ordinary utterance: interrupting or not, what was said will be translated. */
  private accept(c: Utterance, now: number): void {
    if (c.state !== 'candidate') return;
    c.state = 'open';
    c.decidedAt = now;
    if (this.listening(now)) {
      c.ended = c.lastRealAt;     // the speech detector hears our echo now: the end is taken from the words
    }
    this.log('accept', `#${c.id}`);
    this.out.push({ kind: 'updated', utt: c.id });
  }

  private drop(u: Utterance, reason: string, now: number, { keepText = false }: { keepText?: boolean } = {}): void {
    if (u.state === 'dropped' || u.state === 'done' || u.state === 'interrupted') return;
    u.state = 'dropped';
    u.decidedAt = now;
    if (u.lang !== null && this.listenRaw.has(u.lang) && !keepText) {
      this.listenRaw.set(u.lang, '');   // the next candidate in the same language starts with a clean slate
    }
    this.inc(`drop_${reason}`);
    this.log('drop', `#${u.id} ${reason}`);
    this.out.push({ kind: 'drop', utt: u.id, reason });
  }

  private clean(raw: string, echoPossible: boolean, now: number, { final = false }: { final?: boolean } = {}):
      [string, number] {
    if (!echoPossible) return [raw.trim(), words(raw).length];
    return stripEcho(raw, this.playedTexts(now), { final });
  }

  private askJudge(u: Utterance, text: string, now: number): void {
    u.judging.add(text);
    this.judgeSent.set(judgeKey(u.id, text), now);
    this.out.push({ kind: 'judge', utt: u.id, text });
  }

  private commit(now: number): void {
    this.lastCommit = now;
    this.out.push({ kind: 'commit' });
  }

  // --- lookups -----------------------------------------------------------------------------------------------------
  private newUtterance(lang: string | null, now: number,
    { candidate = false, greeting = false }: { candidate?: boolean; greeting?: boolean } = {}): Utterance {
    const u = new Utterance(this.nextId, lang, this.speaking ? this.speechStarted : now);
    u.greeting = greeting;
    u.state = candidate ? 'candidate' : 'open';
    u.firstAt = now;
    this.nextId += 1;
    this.utterances.set(u.id, u);
    if (!greeting) this.out.push({ kind: 'opened', utt: u.id, lang, candidate });
    return u;
  }

  private open(): Utterance[] {
    return [...this.utterances.values()].filter((u) => u.state === 'open');
  }

  /** A short utterance wholly inside the other side's speech: its language sounded both before and after it. */
  private inside(u: Utterance): boolean {
    const others = [this.cfg.langA, this.cfg.langB].filter((lang) => lang !== u.lang);
    if (others.length === 0 || !u.realCount) return false;
    const times = this.textTimes.get(others[0]) ?? [];
    const before = times.some((t) => u.firstAt - INSIDE_S <= t && t < u.firstAt);
    const after = times.some((t) => t > u.lastRealAt + OVERLAP_GRACE_S);
    return before && after;
  }

  /**
   * A word of the other alphabet this same speech began with: it came no earlier than 0.3 s into the speech segment
   * (not the tail of the last one), the words of the second language followed within LEAD_GAP_S, and it is alone.
   * A finished phrase ("No, Friday.") is not the start of someone else's speech but an answer that the other side
   * talked over at once.
   */
  private leadIn(lang: string, now: number): Utterance | null {
    if (this.speechStarted === -Infinity) {
      return null;                // no detector: one speech cannot be told from two
    }
    for (const o of this.open()) {
      if (o.lang !== lang && !o.greeting && 0 < o.realCount && o.realCount <= LEAD_WORDS && !endsSentence(o.text)
          && o.firstAt - this.speechStarted >= FRESH_SEGMENT_S
          && now - o.lastRealAt <= LEAD_GAP_S) {
        return o;
      }
    }
    return null;
  }

  /**
   * A short reply said over someone else's thought that went on so long after it that the talk moved on: too late
   * to translate it. Counted by the other's speech, not by the clock: our own sound in the queue is no reason to drop
   * an objection (second review round). An answer to a thought finished already waits however long it takes.
   */
  private stale(u: Utterance, now: number): boolean {
    if (u.greeting || u.playAt !== null || u.over === null || words(u.text).length > STALE_WORDS) return false;
    const o = this.utterances.get(u.over);
    return o !== undefined && u.queuedAt !== null && o.lastRealAt - u.queuedAt >= STALE_S;
  }

  private candidateFor(lang: string): Utterance | null {
    return [...this.utterances.values()].find((u) => u.state === 'candidate' && u.lang === lang) ?? null;
  }

  private openFor(lang: string): Utterance | null {
    return this.open().find((u) => u.lang === lang) ?? null;
  }

  /** An utterance released already while its last words are still coming: the transcript lags. */
  private lateOwner(lang: string, now: number): Utterance | null {
    if (this.openFor(lang) !== null) return null;
    for (const u of [...this.utterances.values()].sort((x, y) => y.id - x.id)) {
      if (u.greeting || u.lang !== lang) continue;
      if ((u.state === 'released' || u.state === 'playing') && u.ended !== null && now - u.ended <= LAG_S) return u;
      return null;
    }
    return null;
  }

  private listening(now: number): boolean {
    return this.playing !== null || now - this.playedUntil < ECHO_TAIL_S;
  }

  private sourceOfPlayback(): Utterance | null {
    if (this.playing !== null) return this.utterances.get(this.playing) ?? null;
    const done = [...this.utterances.values()].filter((u) => u.finishedAt !== null);
    return done.length > 0 ? done.reduce((a, b) => (b.finishedAt! > a.finishedAt! ? b : a)) : null;
  }

  private playedTexts(now: number): string[] {
    return [...this.utterances.values()]
      .filter((u) => u.translation && (u.state === 'playing'
        || (u.finishedAt !== null && now - u.finishedAt < ECHO_MEMORY_S)))
      .map((u) => u.translation);
  }

  private log(kind: string, detail = ''): void {
    if (this.events.length < EVENTS_MAX) {
      this.events.push([Math.round((this.clock() - this.t0) * 1000) / 1000, kind, detail]);
    }
  }

  private inc(key: string): void {
    this.counts[key] = (this.counts[key] ?? 0) + 1;
  }

  // --- call totals -------------------------------------------------------------------------------------------------
  /** End of speech → first sound of the translation, for every utterance that played. */
  latenciesMs(): number[] {
    return [...this.utterances.values()]
      .filter((u) => !u.greeting && u.playAt !== null && u.ended !== null)
      .map((u) => Math.trunc(((u.resumedAt || u.playAt!) - u.ended!) * 1000));
  }
}
