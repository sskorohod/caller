// What the interpreter hears but must neither translate nor obey: "uh-huh" over a translation, stop words,
// the echo of its own voice. And the alphabet: on the mixed line it is the only sign of who is speaking.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isBackchannel, isCrossScriptPair, LANGUAGE_GROUPS, languageOf, pairScripts, realWords, scriptOf, startsWithStop,
  stripEcho, words,
} from './policy.js';

test('words are normalized so lists match whatever the transcriber wrote', () => {
  assert.deepEqual(words('Uh-huh, OK!'), ['uhhuh', 'ok']);
  assert.deepEqual(words('  Ну, ёлки… ДА. '), ['ну', 'елки', 'да']);
  assert.deepEqual(words(''), []);
});

test('script covers every language the admin offers', () => {
  const samples: Record<string, string> = {
    en: 'hello there', ru: 'привет', uk: 'привіт', es: 'hola', de: 'hallo', fr: 'bonjour', pt: 'olá', it: 'ciao',
    zh: '你好', ja: 'こんにちは', ko: '안녕하세요', ar: 'مرحبا', hi: 'नमस्ते',
  };
  for (const [code, text] of Object.entries(samples)) assert.notEqual(scriptOf(text), null, code);
  assert.deepEqual(new Set(Object.keys(samples)), new Set(Object.keys(LANGUAGE_GROUPS)));
  // punctuation and digits do not give the language away
  assert.equal(scriptOf('. , ?'), null);
  assert.equal(scriptOf('310'), null);
});

test('languageOf picks the side of the pair by alphabet', () => {
  assert.equal(languageOf('Я вчера говорил', 'en', 'ru'), 'ru');
  assert.equal(languageOf(' Okay', 'en', 'ru'), 'en');
  assert.equal(languageOf('.', 'en', 'ru'), null);
  assert.equal(languageOf('hola', 'en', 'ru'), 'en');   // Latin letters are the English side of en↔ru
});

test('backchannel is only acknowledgement and nothing else', () => {
  for (const text of ['yeah', 'Yeah, okay.', 'mm-hmm', 'uh-huh', 'got it', 'I see.', 'Угу', 'ага, понятно', 'да да да',
    'Хорошо.', 'Okay, makes sense.']) {
    assert.equal(isBackchannel(text), true, text);
  }
  for (const text of ["No, that's wrong", 'yeah but the price', 'Да, но цена другая', '', 'Я не согласен']) {
    assert.equal(isBackchannel(text), false, text);
  }
});

test('stop phrase counts only at the start of what was said', () => {
  for (const text of ['Stop.', 'wait, wait', 'Hold on a second', 'Стоп!', 'подождите, пожалуйста', 'Секунду']) {
    assert.equal(startsWithStop(text), true, text);
  }
  for (const text of ["Please don't stop", 'Я не могу ждать', '', 'yeah']) {
    assert.equal(startsWithStop(text), false, text);
  }
});

test('echo is a run of our words not a shared common word', () => {
  const played = ['I spoke with the manager yesterday, and he said they would refund the repair on Friday.'];
  assert.deepEqual(realWords('the manager yesterday and', played), []);
  // "I" and "said" were in our translation too, but one at a time they are ordinary speech, not echo
  assert.deepEqual(realWords("No, that's not what I said", played), ['no', 'thats', 'not', 'what', 'i', 'said']);
  // one letter off in a long word is still echo: the transcriber does not always hear our voice verbatim
  assert.deepEqual(realWords('refund the repairs', played), []);
  // a single word of the translation is not echo: the listener repeats what they heard ("Friday then")
  assert.deepEqual(realWords('Friday then', played), ['friday', 'then']);
  assert.deepEqual(realWords('anything', []), ['anything']);
});

test('every caller language has a script group and pairs are judged by it', () => {
  for (const lang of ['en', 'ru', 'uk', 'es', 'de', 'fr', 'zh', 'ja', 'ko', 'pt', 'it', 'ar', 'hi']) assert.ok(LANGUAGE_GROUPS[lang], lang);
  assert.equal(isCrossScriptPair('ru', 'en'), true);
  assert.equal(isCrossScriptPair('en', 'zh'), true);
  assert.equal(isCrossScriptPair('ru', 'ar'), true);
  assert.equal(isCrossScriptPair('en', 'it'), false);
  assert.equal(isCrossScriptPair('ru', 'uk'), false);
  assert.equal(isCrossScriptPair('zh', 'ja'), false);
  assert.equal(isCrossScriptPair('en', 'xx'), false);
  // keys every object inherits are not languages
  assert.equal(isCrossScriptPair('en', 'constructor'), false);
  assert.equal(isCrossScriptPair('toString', 'ru'), false);
  assert.deepEqual(pairScripts('en', 'constructor'), new Set(['latin']));
});

test('Chinese and Japanese are counted by character, marks stay inside words', () => {
  assert.deepEqual(words('好的，我们明天见'), ['好', '的', '我', '们', '明', '天', '见']);
  // ー is a Japanese character; 、 and 。 share its script extensions but are still punctuation
  assert.deepEqual(words('コーヒー、ください。'), ['コ', 'ー', 'ヒ', 'ー', 'く', 'だ', 'さ', 'い']);
  assert.equal(isBackchannel('はい。'), true);
  assert.deepEqual(words('ठीक है'), ['ठीक', 'है']);   // a vowel sign carries the vowel: है, हाँ and हो are different words
  assert.equal(isBackchannel('ठीक है'), true);
  assert.equal(isBackchannel('है'), false);
});

test('Japanese mixes kana and ideographs and is still one side', () => {
  assert.equal(languageOf('今日は', 'en', 'ja'), 'ja');
  assert.equal(languageOf('Hello there', 'en', 'ja'), 'en');
  // without the Japanese grouping the two ideographs outvote the kana 2:1 and it reads as Chinese
  assert.equal(scriptOf('今日は'), 'han');
  // the prolonged sound mark ー is Common by Script and kana only by Script_Extensions
  assert.equal(scriptOf('コーヒー'), 'kana');
  assert.equal(languageOf('コーヒー', 'en', 'ja'), 'ja');
});

test('stripEcho cuts our echo out of unspaced Chinese too, keeping the original spelling', () => {
  const played = ['I spoke with the manager yesterday, and he said they would refund the repair on Friday.'];
  assert.deepEqual(stripEcho('the manager yesterday. No, Friday!', played, { final: true }), ['No, Friday!', 2]);
  // while the person still speaks, a last word that may begin our echo waits for the next one
  assert.deepEqual(stripEcho('the manager yesterday. No, Friday!', played), ['No,', 1]);
  assert.deepEqual(stripEcho('好的明天见', ['明天见'], { final: true }), ['好的', 2]);
  // punctuation stays with its character, so endsSentence still sees the full stop
  assert.deepEqual(stripEcho('好的。明天见', ['明天见'], { final: true }), ['好的。', 2]);
  assert.deepEqual(stripEcho('OK明天见', ['明天见'], { final: true }), ['OK', 1]);
});

test('backchannels and stop phrases of the other caller languages', () => {
  for (const t of ['Ja, genau', "D'accord.", 'Tá', 'Va bene', '好的', 'はい', '네', 'تمام', 'अच्छा']) assert.equal(isBackchannel(t), true, t);
  for (const t of ['Warte mal', 'Attendez, non', 'Espera aí', 'Aspetta un attimo', '等一下', '待って', '잠깐만요', 'انتظر', 'रुको']) assert.equal(startsWithStop(t), true, t);
});
