// Turn-taking of consecutive interpretation on a fake clock: the acceptance scenarios of both specs and the places
// where the mixed line breaks simple rules. Port of aidispatch tests/test_consecutive_floor.py (9e4b1eb).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANDIDATE_END_S, FloorManager, GREETING_MAX_WAIT_S, HEAD_TIMEOUT_S, INTENT_WAIT_S, RESTART_S,
  type Command, type FloorConfig,
} from './floor.js';

type Of<K extends Command['kind']> = Extract<Command, { kind: K }>;

const Play = (utt: number): Command => ({ kind: 'play', utt });
const Stop = (utt: number): Command => ({ kind: 'stop', utt });
const Pause = (utt: number): Command => ({ kind: 'pause', utt });
const Restart = (utt: number): Command => ({ kind: 'restart', utt });
const Prepare = (utt: number): Command => ({ kind: 'prepare', utt });
const Drop = (utt: number, reason: string): Command => ({ kind: 'drop', utt, reason });

class Clock {
  t = 100.0;
  readonly now = (): number => this.t;
}

/** The line as the core sees it: the speech detector, the transcript in pieces, model answers, engine audio. */
class Line {
  readonly clock = new Clock();
  readonly floor: FloorManager;
  readonly log: Command[] = [];

  constructor(cfg: Partial<FloorConfig> = {}) {
    this.floor = new FloorManager({ langA: 'en', langB: 'ru', ...cfg }, this.clock.now);
  }

  take(cmds: Command[]): Command[] {
    this.log.push(...cmds);
    for (const cmd of cmds) {   // the engine has audio at once: its speed is the engine tests' business
      if (cmd.kind === 'release') this.log.push(...this.floor.audio(cmd.utt));
    }
    return cmds;
  }

  wait(seconds: number, step = 0.05): void {
    const end = this.clock.t + seconds;
    while (this.clock.t < end - 1e-9) {
      this.clock.t = Math.min(this.clock.t + step, end);
      this.take(this.floor.tick());
    }
  }

  /** A person says a phrase: the speech detector at once, the words with the transcriber's lag. */
  say(text: string, { secondsPerWord = 0.3 } = {}): void {
    this.take(this.floor.vadStart());
    for (const piece of text.split(' ')) {
      this.wait(secondsPerWord);
      this.take(this.floor.text(' ' + piece));
    }
    // the detector announces the end of speech after 0.35 s of silence
    this.wait(0.35);
    this.take(this.floor.vadEnd(0.35));
  }

  /** Words over our sound: the speech detector decides nothing here, only the text. */
  speakOver(text: string, { secondsPerWord = 0.3 } = {}): void {
    for (const piece of text.split(' ')) {
      this.wait(secondsPerWord);
      this.take(this.floor.text(' ' + piece));
    }
  }

  of<K extends Command['kind']>(kind: K): Array<Of<K>> {
    return this.log.filter((c): c is Of<K> => c.kind === kind);
  }

  answerJudges(complete: boolean, confidence = 0.95): void {
    for (const cmd of this.of('judge')) {
      const u = this.floor.utterances.get(cmd.utt)!;
      if (u.judging.has(cmd.text)) this.take(this.floor.judged(cmd.utt, cmd.text, [complete, confidence]));
    }
  }
}

const drops = (line: Line) => line.of('drop').map((d) => [d.utt, d.reason]);
const spoken = (line: Line) =>
  [...line.floor.utterances.values()].filter((u) => u.state !== 'dropped').map((u) => [u.lang, u.text]);

test('a completed sentence is released after 700 ms by punctuation', () => {
  const line = new Line();
  line.say('I spoke with the customer yesterday.');
  assert.equal(line.of('release').length, 0);
  line.wait(0.4);                                 // 0.35 + 0.4 = 0.75 s of silence
  assert.deepEqual(line.of('release').map((r) => r.utt), [1]);
  assert.equal(line.floor.utterances.get(1)!.releaseReason, 'punctuation');
  assert.deepEqual(line.of('play'), [Play(1)]);
});

test('the model verdict beats the period both ways', () => {
  const line = new Line();
  line.say('I spoke with the customer and he told me that.');
  line.answerJudges(false);                       // the model: not finished, though the period is there
  line.wait(1.0);
  assert.equal(line.of('release').length, 0);
  line.wait(1.0);                                 // the 2.2 s hard limit releases it anyway
  assert.equal(line.floor.utterances.get(1)!.releaseReason, 'hard');

  const line2 = new Line();
  line2.say('Ну и вот он мне говорит');
  line2.answerJudges(true);                       // no period, but the model is sure: finished
  line2.wait(0.4);
  assert.equal(line2.floor.utterances.get(1)!.releaseReason, 'semantic');
});

test('an unsure judge answer is no worse than no answer', () => {
  // A weak "complete" used to be stored as a verdict that matched no release path at all, so the utterance
  // sat out the 2.2 s hard limit — strictly slower than if the model had never answered. The sentence mark
  // decides instead, exactly as it does when the judge errors or times out.
  const line = new Line();
  line.say('I spoke with the customer yesterday.');
  line.answerJudges(true, 0.6);                   // under the 0.8 threshold
  line.wait(0.4);                                 // 0.75 s of silence
  assert.deepEqual(line.of('release').map((r) => r.utt), [1]);
  assert.equal(line.floor.utterances.get(1)!.releaseReason, 'punctuation');
  assert.equal(line.floor.counts.judge_unsure, 1);
});

test('an unsure incomplete keeps waiting: the weak lean is all that says the thought is unfinished', () => {
  // The deliberate asymmetry. Falling back for an incomplete too would release a phrase the model leaned
  // against finishing, which is the one case where its weak answer still carries information.
  const line = new Line();
  line.say('I spoke with the customer yesterday.');
  line.answerJudges(false, 0.6);
  line.wait(0.4);
  assert.equal(line.of('release').length, 0);
  line.wait(1.5);
  assert.equal(line.floor.utterances.get(1)!.releaseReason, 'hard');
});

test('an unfinished thought with a 900 ms pause is not released and continues', () => {
  const line = new Line();
  line.say('Я поговорил с мастером и он сказал что');
  line.wait(0.55);                                // 0.9 s of pause in all
  assert.equal(line.of('release').length, 0);
  line.say('деньги вернут в пятницу.');
  line.wait(0.4);
  const releases = line.of('release');
  assert.deepEqual(releases.map((r) => r.utt), [1]);   // one utterance, not two
  assert.ok(line.floor.utterances.get(1)!.text.endsWith('пятницу.'));
});

test('a long monologue with short pauses is one utterance', () => {
  const line = new Line();
  for (let i = 0; i < 12; i++) {                  // about a minute of speech with 0.5 s pauses
    line.say(`Это часть номер ${i} длинного рассказа, и я продолжаю`);
    line.wait(0.15);
  }
  assert.equal(line.of('release').length, 0);
  line.say('вот и всё.');
  line.wait(0.4);
  assert.equal(line.of('release').length, 0);     // a long utterance is not released by a period alone
  line.answerJudges(true);
  line.wait(0.1);
  assert.deepEqual(line.of('release').map((r) => r.utt), [1]);
  assert.equal(line.floor.utterances.get(1)!.releaseReason, 'semantic');
});

test('a long story of finished sentences with 700 ms pauses stays one utterance', () => {
  // A monologue of finished sentences with 0.7–0.8 s pauses: each alone is "finished", but the story goes on.
  // The model answers "will continue" to them, and the utterance is one (the first run tore it into pieces).
  const line = new Line();
  for (const sentence of ['Смотрите, ситуация такая.', 'Посудомойка стоит у нас уже лет пять.',
    'Две недели она не сливает воду.', 'Мы чистили фильтр, но это не помогло.']) {
    line.say(sentence);
    line.wait(0.1);
    line.answerJudges(false);                     // the story is in progress
    line.wait(0.35);
  }
  assert.equal(line.of('release').length, 0);
  assert.equal(line.floor.utterances.size, 1);
});

test('a speaker resuming before his translation played reopens the same utterance', () => {
  // Released at the pause, but the sound is not ready yet and the person went on: the same thought, not a new one.
  const line = new Line();
  line.floor.audio = () => [];                    // no sound yet: the utterance waits in the queue
  line.say('Первая мысль закончена.');
  line.wait(0.4);
  assert.equal(line.floor.utterances.get(1)!.state, 'released');
  line.say('И вот продолжение этой мысли.');
  assert.ok(line.log.some((c) => c.kind === 'reopened' && c.utt === 1));
  assert.equal(line.floor.utterances.size, 1);
  assert.ok(line.floor.utterances.get(1)!.text.endsWith('продолжение этой мысли.'));
});

test('the tail is prepared as soon as the speaker falls silent, and once per text', () => {
  // While the judge decides whether the thought is finished, the engine prepares the tail: the signal comes as soon
  // as the person is silent with no new words, before the release. Once per text; new words, a new signal after a
  // new pause.
  const line = new Line();
  line.say('Ну и вот он мне говорит');
  line.wait(0.3);                                 // 0.65 s of silence: the transcriber's last word is in already
  assert.deepEqual(line.of('prepare'), [Prepare(1)]);
  assert.equal(line.of('release').length, 0);
  assert.equal(line.floor.utterances.get(1)!.prepared, 'Ну и вот он мне говорит');   // not from a word mid-speech
  line.wait(0.3);
  assert.deepEqual(line.of('prepare'), [Prepare(1)]);
  line.say('что всё будет готово');
  line.wait(0.3);
  assert.deepEqual(line.of('prepare'), [Prepare(1), Prepare(1)]);
  assert.ok(line.floor.utterances.get(1)!.prepared.endsWith('всё будет готово'));
});

test('the judge is asked ahead at sentence ends while the person still talks', () => {
  const line = new Line();
  line.say('First sentence here. And then more words', { secondsPerWord: 0.2 });
  const asked = line.of('judge').map((j) => j.text);
  assert.ok(asked.includes('First sentence here.'));
});

test('a standalone yes when nobody talks is an answer and is translated', () => {
  const line = new Line();
  line.say('Да.');
  line.wait(0.4);
  assert.deepEqual(line.of('release').map((r) => r.utt), [1]);
  assert.equal(line.of('drop').length, 0);
});

test("the other side's backchannel in a pause is not translated and does not reset the clock", () => {
  const line = new Line();
  line.say('Я поговорил с мастером и он сказал что', { secondsPerWord: 0.25 });
  line.say('uh-huh');                             // the other side agreed in the pause
  line.wait(2.0);
  assert.deepEqual(drops(line), [[2, 'backchannel']]);
  assert.deepEqual(line.of('release').map((r) => r.utt), [1]);
});

test('the other side starting to talk for real means the first speaker yielded', () => {
  const line = new Line();
  line.say('Я поговорил с мастером и он сказал что');
  line.say('Sorry, what did he say exactly?');
  assert.equal(line.floor.utterances.get(1)!.releaseReason, 'yield');
});

function playingLine(): Line {
  const line = new Line();
  line.say('Мастер приедет завтра утром, с девяти до двенадцати.');
  line.wait(0.4);
  line.floor.translation(1, 'The technician will come tomorrow morning, between nine and twelve.');
  assert.deepEqual(line.of('play'), [Play(1)]);
  return line;
}

test('a backchannel during playback does not interrupt', () => {
  const line = playingLine();
  line.speakOver('yeah');
  line.wait(CANDIDATE_END_S + 0.1);
  assert.equal(line.of('stop').length, 0);
  assert.deepEqual(drops(line), [[2, 'backchannel']]);
});

test('four words do not interrupt, and the model decides whether to translate them after', () => {
  const line = playingLine();
  line.speakOver("No, I don't agree");
  line.wait(CANDIDATE_END_S + 0.1);
  assert.equal(line.of('stop').length, 0);
  const intents = line.of('intent');              // echo or a reply: the text cannot tell them apart
  assert.deepEqual(intents.map((i) => i.utt), [2]);
  line.take(line.floor.intent(2, ['later', 0.9]));
  assert.equal(line.floor.utterances.get(2)!.state, 'open');
  line.wait(1.0);
  assert.equal(line.floor.utterances.get(2)!.state, 'released');   // queued after the current translation
  assert.deepEqual(line.of('play'), [Play(1)]);   // the current one plays to the end
  line.take(line.floor.finished(1));
  assert.deepEqual(line.of('play').at(-1), Play(2));
});

test('a garbled echo fragment is asked about and dropped', () => {
  const line = playingLine();
  line.speakOver('My step');                      // how the transcriber hears our voice over speech
  line.wait(CANDIDATE_END_S + 0.1);
  line.take(line.floor.intent(2, ['ack', 0.4]));  // garbage: the model is not sure
  line.wait(INTENT_WAIT_S + 0.1);
  assert.ok(line.of('drop').some((d) => d.utt === 2 && d.reason === 'ack')
    || ['open', 'released'].includes(line.floor.utterances.get(2)!.state));   // not sure: not lost
  assert.equal(line.of('stop').length, 0);
});

test('a single word over our translation is dropped', () => {
  const line = playingLine();
  line.speakOver('City');
  line.wait(CANDIDATE_END_S + 0.1);
  assert.deepEqual(drops(line), [[2, 'short']]);
});

test('the original speaker continuing in the first seconds restarts the translation', () => {
  // Calls 24.09: the judge took the thought as finished, the translation started, and the person went on half a
  // second later. The translation had only begun: not a pause resuming mid-word but a restart: the sound is dropped,
  // the continuation joins the same utterance, the thought is translated anew and plays from the start.
  const line = playingLine();
  line.speakOver('И ещё одно: мастер должен позвонить заранее.');
  assert.deepEqual(line.of('restart'), [Restart(1)]);
  assert.equal(line.of('pause').length, 0);
  assert.equal(line.of('stop').length, 0);
  const u1 = line.floor.utterances.get(1)!;
  assert.equal(u1.state, 'open');
  assert.ok(u1.text.endsWith('позвонить заранее.'));
  assert.equal(u1.hasAudio, false);               // the old translation no longer holds
  assert.equal(u1.playAt, null);
  assert.equal(u1.translation, '');
  assert.ok(line.log.some((c) => c.kind === 'reopened' && c.utt === 1));
  assert.ok(line.of('drop').some((d) => d.utt === 2 && d.reason === 'merged'));
  assert.deepEqual(line.floor.events.filter((e) => e[1] === 'restart').map((e) => e.slice(1)), [['restart', '#1']]);
  line.wait(0.3);
  line.answerJudges(true);
  line.wait(1.2);
  assert.deepEqual(line.of('play').at(-1), Play(1));
  assert.equal(u1.resumedAt, null);               // plays from the start, not resumed
  const latency = line.floor.latenciesMs()[0];    // from the end of the continuation to the new sound
  assert.ok(latency > 0 && latency < 2500, String(latency));
});

test('a lone first word of the continuation is kept until the rest arrives', () => {
  // Run 24.09: "Последние" came from the transcriber alone, "две недели" 1.2 s later. One word over a translation is
  // dropped as a scrap, but for a speaker over the translation of his own words it begins the continuation: the
  // word is not lost, and the restart gets the whole phrase ("две недели" without it became "two weeks ago").
  const line = playingLine();
  line.speakOver('Последние');
  line.wait(CANDIDATE_END_S + 0.1);
  assert.deepEqual(drops(line), [[2, 'short']]);
  line.speakOver('две недели она не сливает воду.');
  assert.deepEqual(line.of('restart'), [Restart(1)]);
  assert.ok(line.floor.utterances.get(1)!.text.endsWith('Последние две недели она не сливает воду.'));
});

test('the original speaker continuing after the first seconds pauses and resumes', () => {
  // The translation has played a while: too late to restart it. A pause, the continuation joins the same utterance,
  // and after it the translation plays on (from the start of the interrupted phrase: that is playback's business).
  const line = playingLine();
  line.wait(RESTART_S + 0.5);
  line.speakOver('И ещё одно: мастер должен позвонить заранее.');
  assert.deepEqual(line.of('pause'), [Pause(1)]);
  assert.equal(line.of('restart').length, 0);
  assert.equal(line.of('stop').length, 0);
  const u1 = line.floor.utterances.get(1)!;
  assert.equal(u1.state, 'open');
  assert.ok(u1.text.endsWith('позвонить заранее.'));
  line.wait(0.3);
  line.answerJudges(true);
  line.wait(1.2);
  assert.deepEqual(line.of('play').at(-1), Play(1));
  assert.notEqual(u1.resumedAt, null);
  const latency = line.floor.latenciesMs()[0];
  assert.ok(latency > 0 && latency < 2500, String(latency));
});

test('our own stop word coming back as echo does not interrupt', () => {
  const line = new Line();
  line.say('Подождите, мастер уже едет.');
  line.wait(0.4);
  line.floor.translation(1, 'Wait, the technician is already on his way.');
  line.speakOver('Wait');
  assert.equal(line.of('stop').length, 0);
});

test('five words of agreement ask the model, and ack is dropped', () => {
  const line = playingLine();
  line.speakOver('Yeah, okay, I completely understand you');
  const intents = line.of('intent');
  assert.equal(intents.length, 1);
  assert.equal(intents[0].utt, 2);
  assert.ok(intents[0].playing.startsWith('The technician'));
  line.take(line.floor.intent(2, ['ack', 0.9]));
  line.wait(CANDIDATE_END_S + 0.1);
  assert.equal(line.of('stop').length, 0);
  assert.deepEqual(drops(line), [[2, 'ack']]);
});

test('agreement on the last second of the translation is an answer and is translated', () => {
  const line = playingLine();
  line.speakOver('Yes, that works for me fine');
  line.take(line.floor.intent(2, ['ack', 0.9]));
  line.take(line.floor.finished(1));              // the translation has just finished
  line.wait(CANDIDATE_END_S + 1.5);
  assert.equal(line.of('drop').filter((d) => d.utt === 2).length, 0);
  assert.ok(['released', 'playing'].includes(line.floor.utterances.get(2)!.state));
});

test('a real interruption stops playback and keeps the first words', () => {
  const line = playingLine();
  line.speakOver('No, I already told him that');
  line.take(line.floor.intent(2, ['interrupt', 0.93]));
  assert.deepEqual(line.of('stop'), [Stop(1)]);
  const u = line.floor.utterances.get(2)!;
  assert.equal(u.state, 'open');
  assert.ok(u.text.startsWith('No, I already'));  // the first words are intact, with punctuation
  line.speakOver('yesterday.');
  assert.ok(line.floor.utterances.get(2)!.text.endsWith('yesterday.'));
  line.wait(1.5);
  assert.ok(['released', 'playing'].includes(line.floor.utterances.get(2)!.state));
});

test('a stop word interrupts immediately without asking the model', () => {
  const line = playingLine();
  line.speakOver('Stop');
  assert.deepEqual(line.of('stop'), [Stop(1)]);
  assert.equal(line.of('intent').length, 0);
});

test('the echo of our own translation is ignored', () => {
  const line = playingLine();
  line.speakOver('the technician will come tomorrow morning');
  line.wait(CANDIDATE_END_S + 0.2);
  assert.equal(line.of('stop').length, 0);
  assert.ok(!line.of('opened').some((c) => c.candidate));
});

test('a restart does not turn what already sounded into a new speaker', () => {
  // The restart throws the translation away and the engine writes a new one, so our own words are nowhere to be
  // found in the utterance any more — while the room keeps giving them back, mixed into the continuation. Taken for
  // speech they become an utterance of the other side, and the person hears his own sentence read back to him.
  const line = playingLine();
  line.speakOver('И ещё', { secondsPerWord: 0.1 });
  assert.deepEqual(line.of('restart'), [Restart(1)]);
  line.speakOver('одно: the мастер technician должен will come позвонить tomorrow заранее. morning',
    { secondsPerWord: 0.1 });
  line.wait(CANDIDATE_END_S + 0.2);
  assert.deepEqual(line.of('opened').filter((c) => c.candidate && c.lang === 'en'), []);
  assert.equal(line.of('stop').length, 0);
  assert.deepEqual(spoken(line), [['ru', 'Мастер приедет завтра утром, с девяти до двенадцати. '
    + 'И ещё одно: мастер должен позвонить заранее.']]);
});

test('a pause does not turn what already sounded into a new speaker', () => {
  // The same on the other path: the translation has played a while, so it is paused rather than restarted. Its text
  // survives on the utterance, but the utterance is no longer playing — and the echo window outlives the sound.
  const line = playingLine();
  line.wait(RESTART_S + 0.5);
  line.speakOver('И ещё', { secondsPerWord: 0.1 });
  assert.deepEqual(line.of('pause'), [Pause(1)]);
  line.speakOver('одно: the мастер technician должен will come позвонить tomorrow заранее. morning',
    { secondsPerWord: 0.1 });
  line.wait(CANDIDATE_END_S + 0.2);
  assert.deepEqual(line.of('opened').filter((c) => c.candidate && c.lang === 'en'), []);
  assert.equal(line.of('stop').length, 0);
});

test('without echo on the line, words repeating our translation are real', () => {
  // The call's measurement showed no echo: a repeat of our words is the person, not the line. Run 24.09 lost
  // "Thursday afternoon" of "Got it, Thursday afternoon then".
  const line = playingLine();
  line.floor.setEcho(false);
  line.speakOver('the technician will come tomorrow morning');
  line.wait(CANDIDATE_END_S + 0.2);
  const candidate = line.of('opened').find((c) => c.candidate);
  assert.ok(candidate);
  assert.equal(line.floor.utterances.get(candidate.utt)!.text, 'the technician will come tomorrow morning');
  assert.deepEqual(line.floor.events.filter((e) => e[1] === 'echo').map((e) => e.slice(1)), [['echo', 'off']]);
});

test('real words mixed into echo are counted alone', () => {
  const line = playingLine();
  line.speakOver('the technician will come wait wait');
  assert.deepEqual(line.of('stop'), [Stop(1)]);
});

test('the original speaker correcting himself is never echo', () => {
  const line = playingLine();
  line.speakOver('Нет, подождите, я перепутал время');   // "нет" before the stop word does not get in the way
  assert.deepEqual(line.of('stop'), [Stop(1)]);
  assert.equal(line.floor.utterances.get(2)!.lang, 'ru');
});

test('a backchannel right as playback ends is an answer', () => {
  const line = playingLine();
  line.wait(1.0);
  line.take(line.floor.finished(1));
  line.speakOver('Okay.');
  line.wait(CANDIDATE_END_S + 1.5);
  assert.equal(line.of('drop').filter((d) => d.utt === 2).length, 0);
  assert.ok(['released', 'playing'].includes(line.floor.utterances.get(2)!.state));
});

test('no answer about intent means no interruption', () => {
  const line = playingLine();
  line.speakOver('Could you please repeat the time slot again');
  line.wait(INTENT_WAIT_S + 0.1);
  assert.equal(line.of('stop').length, 0);
  assert.ok(['open', 'released'].includes(line.floor.utterances.get(2)!.state));
});

test('interrupting drops the rest of that line of translation', () => {
  const line = new Line();
  line.floor.audio = () => [];                    // the sound comes later: utterances pile up in the queue
  line.say('Первая мысль закончена.');
  line.wait(0.4);
  line.say('Sure, what else?');                   // the other side answered: another's utterance between the thoughts
  line.wait(0.4);
  line.say('И вторая мысль тоже.');
  line.wait(0.4);
  assert.deepEqual([...line.floor.utterances].map(([id, u]) => [id, u.state]),
    [[1, 'released'], [2, 'released'], [3, 'released']]);
  Reflect.deleteProperty(line.floor, 'audio');    // the engine caught up: every utterance has sound
  for (const utt of [1, 2, 3]) line.take(line.floor.audio(utt));
  assert.deepEqual(line.of('play'), [Play(1)]);
  line.floor.translation(1, 'The first thought is finished.');
  line.speakOver('Stop');
  assert.deepEqual(line.of('stop'), [Stop(1)]);
  assert.ok(line.of('drop').some((d) => d.utt === 3 && d.reason === 'interrupted'));
  assert.ok(!line.of('drop').some((d) => d.utt === 2));   // the other side's answer stays
});

test('unknown speech holds the release, then noise is ignored, and playback waits for quiet', () => {
  const line = new Line();
  line.say('Первая мысль закончена.');
  line.take(line.floor.vadStart());               // someone speaks already and there are no words yet: maybe him
  line.wait(0.5);
  assert.equal(line.floor.utterances.get(1)!.state, 'open');
  line.wait(1.2);                                 // a wordless segment longer than 1.5 s is noise, not a speaker
  assert.equal(line.floor.utterances.get(1)!.state, 'released');
  assert.equal(line.of('play').length, 0);        // there is still sound on the line
  line.take(line.floor.vadEnd(0.35));
  line.wait(0.4);
  assert.deepEqual(line.of('play'), [Play(1)]);
});

test('late words of a released utterance are appended, not a new turn', () => {
  const line = new Line();
  line.say('Деньги вернут в пятницу.');
  line.wait(0.4);
  assert.ok(line.of('release').length);
  line.take(line.floor.text(' Точно.'));
  assert.ok(line.floor.utterances.get(1)!.text.endsWith('Точно.'));
  assert.equal(line.floor.utterances.size, 1);
});

test('an empty utterance is dropped at the hard end', () => {
  const line = new Line();
  line.take(line.floor.vadStart());
  line.wait(0.3);
  line.take(line.floor.text(' .'));               // a mark only, not a single word
  line.take(line.floor.vadEnd(0.35));
  line.wait(3.0);
  assert.equal(line.of('release').length, 0);
});

test('the greeting plays first and its text is echo', () => {
  const line = new Line();
  const [gid, cmds] = line.floor.greeting("Hi, I'm the interpreter. Здравствуйте, я переводчик.");
  line.take(cmds);
  line.take(line.floor.audio(gid));
  line.wait(0.1);
  assert.deepEqual(line.of('play'), [Play(gid)]);
  line.speakOver("I'm the interpreter");
  line.wait(CANDIDATE_END_S + 0.2);
  assert.equal(line.of('stop').length, 0);
});

test('the greeting waits for quiet, but not forever', () => {
  const line = new Line();
  line.take(line.floor.vadStart());
  line.take(line.floor.text(' Hello'));
  const [gid, cmds] = line.floor.greeting("Hi, I'm the interpreter.");
  line.take(cmds);
  line.take(line.floor.audio(gid));
  line.wait(1.0);
  assert.equal(line.of('play').length, 0);
  line.wait(GREETING_MAX_WAIT_S);
  assert.ok(line.of('play').some((p) => p.utt === gid));
});

test('an engine without audio does not block the queue forever', () => {
  const line = new Line();
  line.floor.audio = () => [];                    // the engine is silent
  line.take(line.floor.vadStart());
  for (const w of 'Первая мысль закончена.'.split(' ')) {
    line.wait(0.3);
    line.take(line.floor.text(' ' + w));
  }
  line.wait(0.35);
  line.take(line.floor.vadEnd(0.35));
  line.wait(0.6 + HEAD_TIMEOUT_S);
  assert.deepEqual(drops(line), [[1, 'no audio']]);
});

test('latency is end of speech to first sound', () => {
  const line = new Line();
  line.say('I spoke with the customer yesterday.');
  line.wait(0.4);
  const latencies = line.floor.latenciesMs();
  assert.equal(latencies.length, 1);
  assert.ok(Math.abs(latencies[0] - 750) <= 60, String(latencies[0]));
});

test('a language switch without a pause splits utterances', () => {
  const line = new Line();
  line.take(line.floor.vadStart());
  for (const w of ['Мастер', 'приедет', 'завтра.', 'Okay', 'and', 'what', 'time?']) {
    line.wait(0.3);
    line.take(line.floor.text(' ' + w));
  }
  assert.deepEqual(line.of('opened').map((c) => c.lang), ['ru', 'en']);
});

test('words without the voice detector still count as speech', () => {
  // A quiet voice below the detector's threshold: the words come, and there is "no speech". The utterance must not
  // be released in the middle of a phrase.
  const line = new Line();
  for (const word of 'Мастер приедет. Завтра утром. Скорее всего с девяти.'.split(' ')) {
    line.wait(0.3);
    line.take(line.floor.text(' ' + word));
  }
  assert.equal(line.of('release').length, 0);     // while words come, the thought has not ended
  line.wait(0.5);
  assert.deepEqual(line.of('release').map((r) => r.utt), [1]);
});

test('updates are sent so the engine can translate ahead', () => {
  const line = new Line();
  line.say('Первое предложение. Второе');
  assert.ok(line.log.some((c) => c.kind === 'updated' && c.utt === 1));
});

test('foreign script from the transcriber is ignored', () => {
  // On echo and overlaps the transcriber writes Japanese, Greek: no side speaks such a piece.
  const line = new Line();
  line.say('Мастер приедет завтра');
  line.take(line.floor.text(' あえても'));
  line.take(line.floor.text(' έν'));
  assert.ok(!line.floor.utterances.get(1)!.text.includes('あ'));
  assert.equal(line.floor.utterances.size, 1);
  assert.equal(line.floor.counts.foreign_text, 2);
});

test('a single-letter utterance is not translated', () => {
  // The scrap "З" after an utterance: it inherited the language, but there is nothing in it to translate
  // (run 24.09 said "З.").
  const line = new Line();
  line.say('Okay.');
  line.wait(0.4);
  line.take(line.floor.finished(1));
  line.wait(2.0);                                 // the echo tail is over
  line.say('З');
  line.wait(3.0);
  assert.deepEqual(line.of('release').map((r) => r.utt), [1]);
  assert.deepEqual(drops(line), [[2, 'empty']]);
});

test('mistranscribed words inside ongoing speech do not end it', () => {
  // "Мастер из" came out in Latin letters as "Master is…" in the middle of Russian speech. It is not the other
  // side's answer: the first speaker goes on, so he did not yield the floor, and the scrap is an overlap.
  const line = new Line();
  line.take(line.floor.vadStart());
  for (const word of ['Потом', 'появился', 'запах.']) {
    line.wait(0.3);
    line.take(line.floor.text(' ' + word));
  }
  for (const word of ['Master', 'is', 'from']) {
    line.wait(0.3);
    line.take(line.floor.text(' ' + word));
  }
  for (const word of ['другой', 'компании', 'приходил', 'во', 'вторник']) {
    line.wait(0.3);
    line.take(line.floor.text(' ' + word));
  }
  assert.ok(!line.of('release').some((r) => r.utt === 1));   // he did not "yield"
  line.wait(0.35);
  line.take(line.floor.vadEnd(0.35));
  line.wait(1.0);
  assert.ok(line.of('drop').some((d) => d.utt === 2 && d.reason === 'overlap'));
});

test('a candidate that began in the echo window keeps its words after it', () => {
  // The listener spoke right after our translation, while the echo window still held, and finished after it.
  // Run 24.09 tore such an utterance in two: "Okay." as a candidate, "can you ask him…" as a new one.
  const line = playingLine();
  line.wait(1.0);
  line.take(line.floor.finished(1));
  line.speakOver('Okay. Can you ask him what time on Friday?', { secondsPerWord: 0.35 });
  line.wait(3.0);
  const said = [...line.floor.utterances.values()].filter((u) => u.id !== 1 && u.state !== 'dropped');
  assert.equal(said.length, 1);
  assert.ok(said[0].text.startsWith('Okay. Can you ask him'), said[0].text);
});

test('the next candidate does not repeat the words of the previous one', () => {
  // After "Stop." the listener said one more phrase: the "Stop." said already must not get into it.
  const line = playingLine();
  line.speakOver('Stop.');
  assert.deepEqual(line.of('stop'), [Stop(1)]);
  line.wait(0.8);
  line.answerJudges(true);
  line.wait(0.3);
  line.speakOver('Sorry, could you repeat the price?');
  line.wait(2.0);
  // he went on over the translation of his own "Stop.": one thought; what matters is that "Stop." is not doubled
  const texts = [...line.floor.utterances.values()]
    .filter((u) => u.id !== 1 && u.state !== 'dropped').map((u) => u.text).join(' | ');
  assert.equal(texts.split('Stop').length - 1, 1, texts);
  assert.ok(texts.includes('repeat the price?'), texts);
});

test('a single word right after our translation is not taken for an answer', () => {
  const line = playingLine();
  line.wait(1.0);
  line.take(line.floor.finished(1));
  line.speakOver('time');                         // an echo scrap right after the translation
  line.wait(CANDIDATE_END_S + 0.2);
  assert.deepEqual(drops(line), [[2, 'short']]);
});

test("the listener's hmm while the translation is being prepared is not translated", () => {
  // Call 24.09 21:29: the Russian phrase is released, its sound is still being prepared, and the English side said
  // "Hmm". "Hmm" counted as a full utterance: it waited 2.2 s for the hard limit, held the ready translation
  // "Всё отлично" all that time and then sounded itself as "Хм.".
  const line = new Line();
  line.floor.audio = () => [];                    // the translation's sound is still being prepared
  line.say('Всё отлично.');
  line.wait(0.4);
  assert.equal(line.floor.utterances.get(1)!.state, 'released');
  line.say('Hmm');
  Reflect.deleteProperty(line.floor, 'audio');
  line.take(line.floor.audio(1));                 // the first phrase's sound is ready
  line.wait(1.0);
  assert.deepEqual(drops(line), [[2, 'backchannel']]);
  assert.deepEqual(line.of('play'), [Play(1)]);
  assert.deepEqual(line.of('release').map((r) => r.utt), [1]);
});

test('okay before our greeting sounded is not translated', () => {
  // Call 24.09 21:29: "Okay" said before our introduction sounded as "Хорошо." 5.4 s later.
  const line = new Line();
  const [, cmds] = line.floor.greeting("Hi, I'm the AI interpreter. Please go ahead.");
  line.take(cmds);                                // the introduction's sound is still being synthesized
  line.say('Okay');
  line.wait(1.0);
  assert.deepEqual(drops(line), [[2, 'backchannel']]);
});

test('a real answer while the translation is being prepared is still translated', () => {
  const line = new Line();
  line.floor.audio = () => [];
  line.say('Всё отлично.');
  line.wait(0.4);
  line.say('Great, see you tomorrow then.');
  line.wait(1.0);
  assert.equal(line.of('drop').length, 0);
  assert.deepEqual(line.of('release').map((r) => r.utt), [1, 2]);
});

const LONG_EN = 'No, this is because when you say what you want to help with the boxes you are in a place '
  + 'where it is very noisy and loud, so maybe that is why';

test("a short reply that waited out the other side's long turn is not translated late", () => {
  // Call 24.09 20:08: "теперь правильно" was said at the start of a long English utterance, waited 18.5 s for
  // silence and sounded "Now it's correct." out of place: the conversation had moved on.
  const line = new Line();
  line.take(line.floor.vadStart());
  for (const word of ['No,', 'this', 'Теперь', 'правильно.']) {   // said over the start of the English utterance
    line.wait(0.3);
    line.take(line.floor.text(' ' + word));
  }
  line.wait(0.35);
  line.take(line.floor.vadEnd(0.35));
  line.wait(1.0);                                 // the English side stumbled, the Russian one is released already
  assert.equal(line.floor.utterances.get(2)!.state, 'released');
  assert.equal(line.floor.utterances.get(1)!.state, 'open');
  line.say(LONG_EN, { secondsPerWord: 0.35 });   // and went on for 10 s more
  line.answerJudges(true);
  line.wait(1.0);
  assert.ok(line.of('drop').some((d) => d.utt === 2 && d.reason === 'stale'));
  assert.deepEqual(line.of('play'), [Play(1)]);
});

test('a longer reply is translated even after a long wait', () => {
  const line = new Line();
  line.say('Нет, завтра в десять я не смогу.');
  line.say(LONG_EN, { secondsPerWord: 0.35 });
  line.answerJudges(true);
  line.wait(1.0);
  assert.equal(line.of('drop').length, 0);
  assert.deepEqual(line.of('play'), [Play(1)]);
});

test('a short reply that waited a little is still translated', () => {
  const line = new Line();
  line.say('Теперь правильно.');
  line.say('Okay, so what is next for us?');
  line.answerJudges(true);
  line.wait(1.0);
  assert.equal(line.of('drop').length, 0);
  assert.deepEqual(line.of('play'), [Play(1)]);
});

/** One continuous speech: the detector sees no pause between the words. */
function speakOneStretch(line: Line, words: string[], firstAfter = 0.4, step = 0.3): void {
  line.take(line.floor.vadStart());
  line.wait(firstAfter - step);
  for (const word of words) {
    line.wait(step);
    line.take(line.floor.text(' ' + word));
  }
  line.wait(0.35);
  line.take(line.floor.vadEnd(0.35));
}

test('a word in the other script at the start of speech belongs to that speech', () => {
  // Call 24.09 20:02: "Что такое говорите?" was transcribed "What такое говорите?". The core split it by alphabet:
  // "What" went back to the Russian side as "Что?", and "такое говорите?" was translated "Is that what you're
  // saying?". One continuous speech is one utterance: the translator gets it whole and understands it.
  const line = new Line();
  speakOneStretch(line, ['What', 'такое', 'говорите?']);
  line.wait(1.0);
  const said = [...line.floor.utterances.values()].filter((u) => u.state !== 'dropped');
  assert.deepEqual(said.map((u) => [u.lang, u.text]), [['ru', 'What такое говорите?']]);
  assert.deepEqual(line.of('release').map((r) => r.utt), [said[0].id]);
});

test('a short word before a pause stays its own utterance', () => {
  const line = new Line();
  line.say('What?');
  line.say('Я говорю, что мастер приедет завтра.');
  line.wait(1.0);
  assert.deepEqual(spoken(line), [['en', 'What?'], ['ru', 'Я говорю, что мастер приедет завтра.']]);
});

test('a real phrase in the other language is not swallowed by the next speaker', () => {
  const line = new Line();
  speakOneStretch(line, ['Okay,', 'see', 'you', 'Хорошо,', 'до', 'завтра.']);
  line.wait(1.0);
  assert.deepEqual(spoken(line), [['en', 'Okay, see you'], ['ru', 'Хорошо, до завтра.']]);
});

test('a short complete answer is not swallowed by the other side starting right after', () => {
  // Review: "No, Friday." and at once, with no detector pause, the other person's Russian speech. A finished phrase is
  // not the start of someone else's speech: the Russian side must hear "Нет, в пятницу".
  const line = new Line();
  speakOneStretch(line, ['No,', 'Friday.', 'Хорошо,', 'тогда', 'до', 'пятницы.']);
  line.wait(2.0);
  assert.deepEqual(spoken(line), [['en', 'No, Friday.'], ['ru', 'Хорошо, тогда до пятницы.']]);
});

test('words after a pause the detector saw are not a lead-in', () => {
  // Review: after "What" a pause, and a quiet voice the detector did not pick up spoke a second later: that is
  // another speech already, not the continuation of this one (LEAD_GAP_S).
  const line = new Line();
  line.say('What');
  line.wait(1.0);
  line.take(line.floor.text(' Я'));
  line.take(line.floor.text(' говорю,'));
  line.wait(3.0);
  assert.deepEqual(spoken(line), [['en', 'What'], ['ru', 'Я говорю,']]);
});

test('a lead-in before a continuation joins the continued utterance', () => {
  // The same speaker's utterance has not sounded yet and he went on: "What" at the start of the continuation goes
  // there too.
  const line = new Line();
  line.floor.audio = () => [];
  line.say('Я говорю.');
  line.wait(0.4);
  assert.equal(line.floor.utterances.get(1)!.state, 'released');
  speakOneStretch(line, ['What', 'такое', 'говорите?']);
  line.wait(1.0);
  assert.deepEqual(spoken(line), [['ru', 'Я говорю. What такое говорите?']]);
});

test('a short answer is not stale when the other side only started talking after it', () => {
  // Review: "Do you have a dog at home?" was answered "Нет, собаки нет.", and the asker, not waiting for the
  // translation, went on about something else. The answer must still reach him: it was said before he spoke.
  const line = new Line();
  line.say('Do you have a dog at home?');
  line.wait(1.0);
  line.take(line.floor.finished(1));
  line.wait(2.0);
  line.say('Нет, собаки нет.');
  line.say(LONG_EN, { secondsPerWord: 0.35 });
  line.answerJudges(true);
  line.wait(1.5);
  assert.ok(!line.of('drop').some((d) => d.reason === 'stale'));
  assert.ok(line.of('play').some((p) => p.utt === 2));
});

test('an objection over our translation is not stale because our own playback took long', () => {
  // Second review round: "No, not tomorrow." was said over our translation, and the model said to translate it after.
  // The speaker went on over his own translation, which then played whole: the objection waited 10 s, but only 5 of
  // them were the other's speech, the rest was our sound. Such an objection is to the point and must sound.
  const line = playingLine();
  line.wait(3.5);
  line.speakOver('No, not tomorrow.');
  line.wait(CANDIDATE_END_S + 0.1);
  assert.deepEqual(line.of('intent').map((i) => i.utt), [2]);
  line.take(line.floor.intent(2, ['later', 0.9]));
  line.wait(1.0);
  assert.equal(line.floor.utterances.get(2)!.state, 'released');
  line.speakOver('И ещё он обязательно позвонит вам за час до приезда, чтобы вы успели подготовиться.');
  line.wait(0.3);
  line.answerJudges(true);
  line.wait(4.5);
  line.take(line.floor.finished(1));
  line.wait(0.5);
  assert.ok(!line.of('drop').some((d) => d.utt === 2));
  assert.deepEqual(line.of('play').at(-1), Play(2));
});

test('an answer to a question that was then continued is not stale', () => {
  // Second review round: "Can you come on Thursday?" was answered at once "Да, могу.", and the asker added a couple
  // of seconds: his utterance reopened and played 6 s. After the answer he spoke 2 s, not 8: the answer is awaited.
  const line = new Line();
  const held = new Set([1]);
  const give = line.floor.audio.bind(line.floor);
  line.floor.audio = (utt) => (held.has(utt) ? [] : give(utt));
  line.say('Can you come on Thursday?');
  line.wait(0.4);
  line.say('Да, могу.');
  line.wait(0.4);
  assert.equal(line.floor.utterances.get(2)!.state, 'released');
  line.say('Or maybe on Friday morning instead?');
  line.wait(0.4);
  line.answerJudges(true);
  line.wait(0.3);
  held.clear();
  line.take(give(1));
  line.wait(6.0);
  line.take(line.floor.finished(1));
  line.wait(0.5);
  assert.ok(!line.of('drop').some((d) => d.utt === 2));
  assert.deepEqual(line.of('play').at(-1), Play(2));
});

test('a two-word answer is not swallowed by speech that followed without a pause', () => {
  // Second review round: "Not Thursday" (no period: on the mixed line the transcriber need not put one) and at once,
  // with no detector pause, the Russian "А когда тогда?". The Russian side must hear "Не в четверг".
  const line = new Line();
  speakOneStretch(line, ['Not', 'Thursday', 'А', 'когда', 'тогда?']);
  line.wait(2.0);
  assert.deepEqual(spoken(line), [['en', 'Not Thursday'], ['ru', 'А когда тогда?']]);
});

// --- caller additions ---------------------------------------------------------------------------------------------

test('one-way: the other side is released but never queued for playback, and textDone closes it', () => {
  const line = new Line({ silentLangs: ['en'] });
  line.say('I spoke with the customer yesterday.');
  line.wait(1.0);
  const release = line.of('release').at(-1)!;
  assert.equal(line.of('play').length, 0);
  line.take(line.floor.textDone(release.utt));
  assert.equal(line.floor.utterances.get(release.utt)!.state, 'done');
  assert.equal(line.floor.utterances.get(release.utt)!.finishedAt, null);
  assert.deepEqual(line.floor.events.filter((e) => e[1] === 'text').map((e) => e.slice(1)),
    [['text', `#${release.utt}`]]);
});

test('pauseAll stops what plays and drops everything in flight', () => {
  const line = new Line();
  line.say('Я вчера разговаривал с менеджером.');
  line.wait(1.0);
  assert.ok(line.of('play').length);
  line.say('I see, and what did he say');
  line.take(line.floor.text(' I'));               // a single letter waits for the next word to show its language
  const cmds = line.take(line.floor.pauseAll('paused'));
  assert.ok(cmds.some((c) => c.kind === 'stop'));
  assert.ok(cmds.some((c) => c.kind === 'drop' && c.reason === 'paused'));
  const opened = line.of('opened').length;
  line.wait(1.0);
  assert.equal(line.of('opened').length, opened);   // the held letter is forgotten too: nothing said before surfaces
  line.wait(2.0);
  assert.equal(line.of('play').length, 1);
});

test('Japanese pair routes kana and ideographs to one side', () => {
  const line = new Line({ langA: 'en', langB: 'ja' });
  line.say('今日は 大丈夫です。');
  const opened = line.of('opened');
  assert.equal(opened.length, 1);
  assert.equal(opened[0].lang, 'ja');
});

test('pauseAll drops the open reply, the one waiting its turn and the greeting, and the floor works after it', () => {
  const line = playingLine();                     // #1 plays
  const [gid, greeting] = line.floor.greeting("Hi, I'm the interpreter.");   // #2 waits for its turn
  line.take(greeting);
  line.take(line.floor.audio(gid));
  line.speakOver("No, I don't agree.");           // #3: said over the translation, to be translated after it
  line.wait(CANDIDATE_END_S + 0.1);
  line.take(line.floor.intent(3, ['later', 0.9]));
  assert.equal(line.floor.utterances.get(3)!.state, 'released');
  line.speakOver('Последние');                    // #4: the speaker's lone word, kept for his continuation
  line.wait(CANDIDATE_END_S + 0.1);
  assert.deepEqual(drops(line), [[4, 'short']]);
  line.speakOver('Could you please call me later');   // #5: accepted, still being said
  line.take(line.floor.intent(5, ['later', 0.9]));
  assert.equal(line.floor.utterances.get(5)!.state, 'open');

  const cmds = line.take(line.floor.pauseAll('paused'));
  assert.deepEqual(cmds.filter((c) => c.kind === 'stop' || c.kind === 'drop'),
    [Stop(1), Drop(2, 'paused'), Drop(3, 'paused'), Drop(5, 'paused')]);
  const u1 = line.floor.utterances.get(1)!;
  assert.equal(u1.state, 'interrupted');          // cut off, not played to the end
  assert.notEqual(u1.finishedAt, null);           // it did sound: its words stay in the echo filter's memory
  assert.deepEqual(line.floor.events.filter((e) => e[1] === 'stop').map((e) => e.slice(1)),
    [['stop', '#1 (paused)']]);
  line.take(line.floor.text(' две'));             // resumed at once: the kept word is gone from the listen buffer
  assert.equal(line.floor.utterances.get(6)!.text, 'две');
  line.wait(3.0);
  assert.deepEqual(line.of('play'), [Play(1)]);   // nothing that was in flight plays
  line.say('Хорошо, тогда до завтра.');           // and the floor works as before
  line.wait(1.0);
  assert.deepEqual(line.of('play').at(-1), Play(7));
});

test('textDone leaves a greeting and an utterance still being said alone', () => {
  const line = new Line({ silentLangs: ['en'] });
  line.say('I spoke with the customer yesterday.');
  assert.equal(line.floor.utterances.get(1)!.state, 'open');   // not released yet
  line.take(line.floor.textDone(1));
  assert.equal(line.floor.utterances.get(1)!.state, 'open');
  const [gid, cmds] = line.floor.greeting("Hi, I'm the interpreter.");
  line.take(cmds);
  line.take(line.floor.textDone(gid));
  assert.equal(line.floor.utterances.get(gid)!.state, 'released');
});

test('a language switch routes by the new pair and forgets the old last language', () => {
  const line = new Line();                        // en/ru
  line.say('Я вчера разговаривал с менеджером.');
  line.wait(1.0);
  line.take(line.floor.finished(1));
  line.wait(2.0);                                 // the echo tail is over
  line.floor.setLanguages('en', 'zh');
  const opened = line.of('opened').length;
  line.take(line.floor.text(' 15'));              // no alphabet: it must not fall to Russian, the last language heard
  assert.equal(line.of('opened').length, opened);
  line.take(line.floor.text(' 我们明天见'));
  assert.equal(line.of('opened').at(-1)!.lang, 'zh');
  line.take(line.floor.text(' Привет'));          // Russian is no side of the call any more
  assert.equal(line.floor.counts.foreign_text, 1);
  line.floor.setLanguages('en', 'ja');
  line.take(line.floor.text(' 今日は'));          // kana with ideographs is Japanese now, not a foreign script
  assert.equal(line.of('opened').at(-1)!.lang, 'ja');
});

test('one-way mode can be switched on and off mid-call', () => {
  const line = new Line();
  line.floor.setSilentLangs(['en']);
  line.say('I spoke with the customer yesterday.');
  line.wait(1.0);
  const first = line.of('release').at(-1)!.utt;
  assert.equal(line.of('play').length, 0);        // English is text only
  line.take(line.floor.textDone(first));          // its text translation is out
  line.floor.setSilentLangs([]);
  line.say('He promised a refund on Friday.');
  line.wait(1.0);
  const second = line.of('release').at(-1)!.utt;
  assert.notEqual(second, first);
  assert.deepEqual(line.of('play'), [Play(second)]);   // two-way again: the next English reply is voiced
});
