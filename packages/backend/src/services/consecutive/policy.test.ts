// What the interpreter hears but must neither translate nor obey: "uh-huh" over a translation, stop words,
// the echo of its own voice. And the alphabet: on the mixed line it is the only sign of who is speaking.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  echoesStop, endsSentence, isBackchannel, isCrossScriptPair, LANGUAGE_GROUPS, languageOf, pairScripts, realWords,
  scriptOf, startsWithStop, stripEcho, words,
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
  for (const [code, text] of Object.entries(samples)) {
    assert.notEqual(scriptOf(text), null, code);
    assert.equal(scriptOf(text, code === 'ja'), LANGUAGE_GROUPS[code], code);
  }
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

test('a combining mark extends a word but never starts one, and text is compared in NFC', () => {
  assert.deepEqual(words('❤️'), []);                    // U+FE0F is a mark with no word to extend
  assert.equal(isBackchannel('ok ❤️'), true);
  // "très" typed decomposed, with a combining grave accent
  assert.deepEqual(words('Très bien'), ['très', 'bien']);
  assert.equal(isBackchannel('Très bien'), true);
  assert.deepEqual(stripEcho('très bien', [], { final: true }), ['très bien', 2]);
});

test('Japanese mixes kana and ideographs and is still one side', () => {
  assert.equal(languageOf('今日は', 'en', 'ja'), 'ja');
  assert.equal(languageOf('Hello there', 'en', 'ja'), 'en');
  // without the Japanese grouping the two ideographs outvote the kana 2:1 and it reads as Chinese
  assert.equal(scriptOf('今日は'), 'han');
  // the prolonged sound mark ー is Common by Script and kana only by Script_Extensions
  assert.equal(scriptOf('コーヒー'), 'kana');
  assert.equal(languageOf('コーヒー', 'en', 'ja'), 'ja');
  // a lone kana still names its script: outside a Japanese pair that makes it foreign text
  assert.equal(scriptOf('は'), 'kana');
});

test('stripEcho cuts our echo out of unspaced Chinese too, keeping the original spelling', () => {
  const played = ['I spoke with the manager yesterday, and he said they would refund the repair on Friday.'];
  assert.deepEqual(stripEcho('the manager yesterday. No, Friday!', played, { final: true }), ['No, Friday!', 2]);
  // while the person still speaks, a last word that may begin our echo waits for the next one
  assert.deepEqual(stripEcho('the manager yesterday. No, Friday!', played), ['No,', 1]);
  assert.deepEqual(stripEcho('好的明天下午见', ['明天下午见'], { final: true }), ['好的', 2]);
  // punctuation stays with its character, so endsSentence still sees the full stop
  assert.deepEqual(stripEcho('好的。明天下午见', ['明天下午见'], { final: true }), ['好的。', 2]);
  assert.deepEqual(stripEcho('OK明天下午见', ['明天下午见'], { final: true }), ['OK', 1]);
});

test('a Chinese or Japanese word shared with our translation is not echo, four characters in a row are', () => {
  // the reply repeats a word of our translation, and it is still the reply
  assert.deepEqual(stripEcho('可以。', ['明天下午三点可以吗？'], { final: true }), ['可以。', 2]);
  assert.deepEqual(stripEcho('好的，明天见。', ['好的，我明天下午三点到医院。'], { final: true }), ['好的，明天见。', 5]);
  assert.deepEqual(stripEcho('そうですね、わかりました', ['明日は会議があります'], { final: true }), ['そうですね、わかりました', 11]);
  // four characters of our translation in a row, about two words, are echo
  assert.deepEqual(stripEcho('好的，明天下午三点', ['明天下午三点可以吗？'], { final: true }), ['好的，', 2]);
  assert.deepEqual(realWords('好的明天下午', ['明天下午三点']), ['好', '的']);
  assert.deepEqual(realWords('好的明天下', ['明天下午三点']), ['好', '的', '明', '天', '下']);
  // a run with anything but CJK characters in it keeps the two-word rule
  assert.deepEqual(realWords('OK好', ['OK好的']), []);
});

test('stripEcho gives back the spacing the text was written with', () => {
  for (const t of ['下午3点见', '我用iPhone打电话', '好的 明天见', "No, that's not what I said.", 'Я вчера говорил']) {
    assert.deepEqual(stripEcho(t, [], { final: true }), [t, words(t).length], t);
  }
  // two Latin words that met only because the echo between them was cut stay two words
  assert.deepEqual(stripEcho('OK明天下午三点thanks', ['明天下午三点'], { final: true }), ['OK thanks', 2]);
});

test('a one-character Chinese stop word counts only on its own', () => {
  for (const t of ['停！', '停，停！', '不，停']) assert.equal(startsWithStop(t), true, t);
  // 停车场 is a car park, 停电了 a power cut
  for (const t of ['停车场在哪里', '停电了']) assert.equal(startsWithStop(t), false, t);
  assert.equal(echoesStop('停！', ['停！']), true);
  assert.equal(echoesStop('停车场在哪里', ['停！']), false);
});

test('echoesStop tells our own stop word coming back from a real one', () => {
  // we translated someone's "hold on" as "Wait, ..." and hear our own "wait": that must not stop us
  assert.equal(echoesStop('Wait.', ['Wait, I will check the schedule.']), true);
  // nothing we played said "wait": the person really asks us to stop
  assert.equal(echoesStop('Wait.', ['I will check the schedule.']), false);
  assert.equal(echoesStop('No, hold on', ['Hold on, please.']), true);
});

test('endsSentence knows the full stops of the caller languages', () => {
  for (const t of ['Hello.', 'Really?', 'Wait…  ', '好的。', '本当？', 'ठीक है।', 'حقا؟']) assert.equal(endsSentence(t), true, t);
  for (const t of ['Hello', 'Hello,', '']) assert.equal(endsSentence(t), false, t);
});

test('backchannels and stop phrases of the other caller languages', () => {
  for (const t of ['Ja, genau', "D'accord.", 'Tá', 'Va bene', '好的', 'はい', '네', 'تمام', 'شكراً', 'अच्छा']) assert.equal(isBackchannel(t), true, t);
  for (const t of ['Warte mal', 'Attendez, non', 'Non, attendez', 'Espera aí', 'Aspetta un attimo', '等一下', '不，等一下',
    '待って', '잠깐만요', '아니요, 잠깐만요', 'انتظر', 'لا، انتظر', 'रुको', 'नहीं, रुको']) {
    assert.equal(startsWithStop(t), true, t);
  }
});
