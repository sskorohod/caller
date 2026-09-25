/**
 * What the interpreter hears but must neither translate nor obey.
 *
 * "Uh-huh" over a translation does not interrupt it, "stop" interrupts at once, and the echo of our own
 * voice is not speech at all. Plus the alphabet: on the speakerphone line both people arrive mixed on one
 * audio stream, and who is speaking shows only in the alphabet the transcriber wrote their words in.
 * The lists are constants: nobody edits them per workspace, and rewriting a line here is simpler than
 * adding yet another setting.
 *
 * Port of aidispatch agent/consecutive/policy.py (9e4b1eb), extended to the 13 caller languages.
 */

export const SENTENCE_END: readonly string[] = ['.', '?', '!', '…', '。', '？', '！', '؟', '।'];

export type Script = 'latin' | 'cyrillic' | 'armenian' | 'arabic' | 'hebrew' | 'han' | 'kana' | 'hangul' | 'devanagari' | 'other';

/** Script group of each caller language; a pair must have two different groups. */
export const LANGUAGE_GROUPS: Record<string, string> = {
  en: 'latin', es: 'latin', de: 'latin', fr: 'latin', pt: 'latin', it: 'latin',
  ru: 'cyrillic', uk: 'cyrillic',
  zh: 'han', ja: 'japanese', ko: 'hangul', ar: 'arabic', hi: 'devanagari',
};

const SCRIPT_TESTS: Array<[Script, RegExp]> = [
  ['latin', /\p{Script=Latin}/u], ['cyrillic', /\p{Script=Cyrillic}/u], ['armenian', /\p{Script=Armenian}/u],
  ['arabic', /\p{Script=Arabic}/u], ['hebrew', /\p{Script=Hebrew}/u], ['han', /\p{Script=Han}/u],
  // After han: by Script_Extensions, so the prolonged sound mark ー (Common by Script) counts as kana.
  ['kana', /[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]/u], ['hangul', /\p{Script=Hangul}/u],
  ['devanagari', /\p{Script=Devanagari}/u],
];
const LETTER = /\p{L}/u;
const MARK = /\p{M}/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const SURROGATE = /[\uD800-\uDFFF]/;   // no u flag: it has to see the halves of a pair
// Chinese and Japanese write no spaces: one ideograph or kana is one token, or a whole
// Chinese sentence would count as one "word" against every word threshold in the core.
const CJK = /^[\p{Script=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]$/u;
// Exactly one CJK letter or digit (anchored, so it also tells a CJK word from a longer one):
// Script_Extensions also takes in punctuation (、 。 「 」 ・) and a few combining marks shared
// with Latin, which must not become tokens of their own.
const isCjk = (ch: string) => CJK.test(ch) && LETTER_OR_DIGIT.test(ch);

/** Lower-case words without punctuation: "Uh-huh" and "uh huh" from the transcriber must match the lists. */
export function words(text: string): string[] {
  const out: string[] = [];
  let word = '';
  for (const ch of (text || '').normalize('NFC').toLowerCase().replace(/ё/g, 'е')) {
    if (isCjk(ch)) {
      if (word) { out.push(word); word = ''; }
      out.push(ch);
    } else if (LETTER_OR_DIGIT.test(ch) || (word !== '' && MARK.test(ch))) {
      // A combining mark extends a word and never starts one: a Hindi vowel sign carries the vowel
      // (है, हाँ and हो are different words), while the U+FE0F of "❤️" is no word at all.
      word += ch;
    } else if ("-'’".includes(ch) && word) {
      continue;                                   // "uh-huh", "that's" stay one word
    } else if (word) {
      out.push(word);
      word = '';
    }
  }
  if (word) out.push(word);
  return out;
}

// Phrases are written naturally («d'accord», «好的», «ठीक है») and normalised once, here, by words()
// itself, so they compare equal to whatever words() makes of the transcript.
const norm = (p: string) => words(p).join(' ');

// Agreement without content: said while a translation plays, it is no reason to cut it off and no
// reason to translate it.
const BACKCHANNELS: Record<string, string[]> = {
  en: ['yes', 'yeah', 'yep', 'yup', 'right', 'okay', 'ok', 'mm', 'mhm', 'mmhmm', 'uhhuh', 'hmm', 'sure',
    'got it', 'i see', 'i understand', 'understood', 'makes sense', 'alright', 'all right', 'cool', 'great',
    'fine', 'exactly', 'true', 'of course', 'go on', 'go ahead', 'uh', 'um', 'oh', 'ah', 'thanks',
    'thank you', 'perfect', 'good'],
  ru: ['да', 'ага', 'угу', 'ну', 'так', 'понятно', 'хорошо', 'ясно', 'точно', 'ладно', 'конечно', 'верно',
    'окей', 'ок', 'понял', 'поняла', 'спасибо', 'отлично', 'хм', 'ммм', 'мм', 'ну да', 'так так', 'а',
    'ааа', 'угу угу', 'вот', 'да да', 'всё ясно', 'все ясно', 'понятно понятно'],
  es: ['si', 'sí', 'vale', 'claro', 'bueno', 'ya', 'aja', 'ajá', 'entiendo', 'de acuerdo', 'okay', 'ok'],
  uk: ['так', 'ага', 'угу', 'зрозуміло', 'добре', 'ясно', 'гаразд', 'звісно'],
  de: ['ja', 'jaja', 'genau', 'okay', 'ok', 'gut', 'stimmt', 'klar', 'mhm', 'hm', 'aha', 'richtig', 'verstehe',
    'alles klar', 'danke', 'super', 'sehr gut', 'ach so'],
  fr: ['oui', 'ouais', "d'accord", 'ok', 'okay', 'bien', 'très bien', 'entendu', 'je vois', 'voilà', 'exactement',
    'bon', 'ah', 'euh', 'merci', 'parfait', "c'est ça"],
  pt: ['sim', 'tá', 'certo', 'claro', 'ok', 'okay', 'entendi', 'beleza', 'isso', 'exato', 'tudo bem', 'uhum',
    'aham', 'obrigado', 'obrigada', 'perfeito'],
  it: ['sì', 'si', 'certo', 'ok', 'okay', 'va bene', 'capito', 'esatto', 'giusto', 'bene', 'grazie', 'perfetto',
    "d'accordo", 'già'],
  zh: ['嗯', '对', '是', '好', '好的', '对的', '是的', '明白', '知道', '知道了', '行', '没问题', '谢谢', '哦', '啊'],
  ja: ['はい', 'うん', 'ええ', 'そう', 'はあ'],
  ko: ['네', '예', '응', '그래요', '그래', '알겠어요', '맞아요', '좋아요', '음', '아', '감사합니다', '오케이'],
  ar: ['نعم', 'أيوه', 'ايوه', 'طيب', 'تمام', 'حسنا', 'حسناً', 'شكرا', 'شكراً'],
  hi: ['हाँ', 'हां', 'जी', 'अच्छा', 'ठीक है', 'ठीक', 'धन्यवाद', 'बिल्कुल'],
};
// Commands to the interpreter itself: they count only when what was said starts with them.
const STOP_PHRASES: Record<string, string[]> = {
  en: ['stop', 'wait', 'hold on', 'hang on', 'pause', 'one second', 'one sec', 'just a second', 'just a sec'],
  ru: ['стоп', 'стой', 'стойте', 'подожди', 'подождите', 'постой', 'постойте', 'погоди', 'погодите',
    'секунду', 'секундочку', 'минутку', 'минуточку'],
  es: ['espera', 'espere', 'un momento', 'un segundo'],   // no "para": it also means "for"
  uk: ['стоп', 'зачекай', 'зачекайте', 'почекай', 'почекайте', 'секунду'],
  de: ['stopp', 'stop', 'warte', 'warten sie', 'moment', 'einen moment', 'sekunde', 'halt'],
  fr: ['stop', 'attends', 'attendez', 'un instant', 'une seconde', 'un moment', 'arrête', 'arrêtez'],
  pt: ['pare', 'espera', 'espere', 'um momento', 'um segundo', 'calma'],   // "para" is also "for"
  it: ['stop', 'aspetta', 'aspetti', 'un momento', 'un attimo', 'un secondo', 'fermo', 'ferma'],
  zh: ['停', '等一下', '等等', '稍等', '暂停'],
  ja: ['待って', '止めて'],
  ko: ['잠깐', '잠깐만', '잠깐만요', '멈춰', '스톱', '기다려', '기다려요'],
  ar: ['توقف', 'انتظر', 'لحظة', 'استنى'],
  hi: ['रुको', 'रुकिए', 'रुकिये', 'एक मिनट', 'एक सेकंड', 'स्टॉप'],
};
// May come before a stop word without cancelling it: "No, wait".
// Single tokens only: Japanese いいえ is three of them and cannot pass as one word.
const LEADING_WORDS = new Set(
  ['no', 'oh', 'hey', 'okay', 'ok', 'нет', 'ой', 'эй', 'ну', 'так', 'ні', 'nein', 'non', 'não', 'nao',
    '不', '아니요', '아니', 'لا', 'नहीं'].map(norm),
);
const ALL_BACKCHANNELS = new Set(Object.values(BACKCHANNELS).flat().map(norm));
const ALL_STOPS = [...new Set(Object.values(STOP_PHRASES).flat().map(norm))].sort((a, b) => b.length - a.length);
// A one-character Chinese stop word counts only on its own: 停 is "stop", but 停车场 is a car park
// and 停电了 a power cut.
const ONE_CHAR_STOPS = new Set(ALL_STOPS.filter(isCjk));

/** What was said (after a leading "no") begins with this stop phrase, or, for 停, is nothing else. */
function stopMatches(phrase: string, seq: string[], head: string): boolean {
  if (ONE_CHAR_STOPS.has(phrase)) return seq.length > 0 && seq.every((w) => w === phrase);
  return head === phrase || head.startsWith(phrase + ' ');
}

/**
 * Majority script of the letters; with `japanese`, kana and ideographs count as one group.
 * 'other' is a script not in the list (Greek, say: the transcriber sometimes writes echo that way);
 * null when there are hardly any letters (punctuation, digits, a single letter).
 */
export function scriptOf(text: string, japanese = false): string | null {
  const counts = new Map<string, number>();
  for (const ch of text || '') {
    if (!LETTER.test(ch)) continue;
    let script: string = SCRIPT_TESTS.find(([, re]) => re.test(ch))?.[0] ?? 'other';
    if (japanese && (script === 'han' || script === 'kana')) script = 'japanese';
    counts.set(script, (counts.get(script) ?? 0) + 1);
  }
  let total = 0;
  let best = '';
  let bestCount = -1;
  for (const [script, count] of counts) {
    total += count;
    if (count > bestCount) { best = script; bestCount = count; }
  }
  if (!total) return null;
  if (total < 2 && !['han', 'kana', 'japanese', 'hangul', 'other'].includes(best)) return null;   // one letter may start a word
  return bestCount / total >= 0.6 ? best : null;
}

/** Own keys only: a code such as "constructor" must not find what every object inherits. */
function groupOf(lang: string): string | undefined {
  return Object.hasOwn(LANGUAGE_GROUPS, lang) ? LANGUAGE_GROUPS[lang] : undefined;
}

/** Which side of the pair said it. A pair sharing one script never gets here: it runs on the cascade. */
export function languageOf(text: string, langA: string, langB: string): string | null {
  const script = scriptOf(text, langA === 'ja' || langB === 'ja');
  if (script === null) return null;
  for (const lang of [langA, langB]) if (groupOf(lang) === script) return lang;
  return null;
}

export function pairScripts(langA: string, langB: string): Set<string> {
  return new Set([groupOf(langA), groupOf(langB)].filter((group): group is string => Boolean(group)));
}

export function isCrossScriptPair(langA: string, langB: string): boolean {
  const a = groupOf(langA);
  const b = groupOf(langB);
  if (!a || !b || a === b) return false;
  // Chinese and Japanese share the ideographs: a Han-only phrase belongs to either side.
  return !((langA === 'zh' && langB === 'ja') || (langA === 'ja' && langB === 'zh'));
}

/** The whole phrase is made of vocabulary expressions (one, two or three words in a row). */
function phrases(seq: string[], vocabulary: Set<string>): boolean {
  let i = 0;
  while (i < seq.length) {
    const size = [3, 2, 1].find((n) => i + n <= seq.length && vocabulary.has(seq.slice(i, i + n).join(' ')));
    if (size === undefined) return false;
    i += size;
  }
  return true;
}

export function isBackchannel(text: string): boolean {
  const seq = words(text);
  return seq.length > 0 && phrases(seq, ALL_BACKCHANNELS);
}

export function startsWithStop(text: string): boolean {
  let seq = words(text);
  if (seq.length > 1 && LEADING_WORDS.has(seq[0])) {
    seq = seq.slice(1);             // "No, wait" is still a command to stop
  }
  const head = seq.slice(0, 3).join(' ');
  return ALL_STOPS.some((phrase) => stopMatches(phrase, seq, head));
}

/**
 * A stop word we said ourselves a moment ago: we translated someone's "hold on" and heard our own
 * "wait" come back. We must not interrupt ourselves with our own echo.
 */
export function echoesStop(text: string, played: Iterable<string>): boolean {
  let seq = words(text);
  if (seq.length > 1 && LEADING_WORDS.has(seq[0])) seq = seq.slice(1);
  const ours = [...played].filter(Boolean).map((p) => words(p).join(' '));
  const head = seq.slice(0, 3).join(' ');
  for (const phrase of ALL_STOPS) {
    if (stopMatches(phrase, seq, head)) {
      return ours.some((said) => ` ${said} `.includes(` ${phrase} `));
    }
  }
  return false;
}

export function endsSentence(text: string): boolean {
  const trimmed = (text || '').trimEnd();
  return SENTENCE_END.some((end) => trimmed.endsWith(end));
}

/** One edit in a long word is still the same word: our voice is not always transcribed verbatim. */
function close(a: string, b: string): boolean {
  if (a === b) return true;
  // Lengths first, before any array is built: UTF-16 length never undercounts code points, and without
  // a surrogate pair it is the code point count.
  if (Math.min(a.length, b.length) < 5) return false;
  if (Math.abs(a.length - b.length) > 1 && !SURROGATE.test(a) && !SURROGATE.test(b)) return false;
  const x = [...a];   // code points, as Python's len() and indexing count them
  const y = [...b];
  if (Math.min(x.length, y.length) < 5 || Math.abs(x.length - y.length) > 1) return false;
  if (x.length === y.length) return x.filter((ch, i) => ch !== y[i]).length <= 1;
  const [short, long] = x.length < y.length ? [x, y] : [y, x];
  const target = short.join('');
  return long.some((_, i) => [...long.slice(0, i), ...long.slice(i + 1)].join('') === target);
}

// A Chinese or Japanese character is not a word, so a run made only of them is echo from about two words
// on: shorter, 可以 or 明天 shared with our translation would be cut out of a real reply.
const CJK_ECHO_RUN = 4;

/**
 * Echo is a run of our translation, not a single shared word: "I" and "said" are in almost any English
 * translation, and dropping them would mean not hearing a real "No, that's not what I said".
 */
function echoFlags(seq: string[], ours: string[][]): boolean[] {
  const echo: boolean[] = new Array(seq.length).fill(false);
  const cjk = seq.map(isCjk);
  for (let i = 0; i < seq.length; i++) {
    for (const ref of ours) {
      for (let j = 0; j < ref.length; j++) {
        let k = 0;
        while (i + k < seq.length && j + k < ref.length && close(seq[i + k], ref[j + k])) k += 1;
        if (k >= 2 && (k >= CJK_ECHO_RUN || !cjk.slice(i, i + k).every(Boolean))) {
          for (let m = i; m < i + k; m++) echo[m] = true;
        }
      }
    }
  }
  // A single word is not echo, however long: a listener repeats what they heard ("Thursday afternoon
  // then"), and that is how a run once lost a real "Thursday". One-word echo fragments are the core's job.
  return echo;
}

/** Words the person said, not our echo. */
export function realWords(text: string, played: Iterable<string>): string[] {
  const seq = words(text);
  const echo = echoFlags(seq, [...played].filter(Boolean).map((p) => words(p)));
  return seq.filter((_, i) => !echo[i]);
}

/**
 * What was said without our echo, in its original spelling and punctuation, and the number of real words.
 *
 * The punctuation is needed downstream: a full stop decides the end of a thought, and the text is what
 * gets translated. While the person is still speaking (final=false), a last word that could begin a piece
 * of our translation is not counted yet: the next word shows whether it is echo. Otherwise the very first
 * "the" of an echo would start an interruption.
 */
export function stripEcho(text: string, played: Iterable<string>, { final = false }: { final?: boolean } = {}): [string, number] {
  const tokens = echoTokens(text);
  const ours = [...played].filter(Boolean).map((p) => words(p));
  const flat: string[] = [];
  const owner: number[] = [];
  tokens.forEach((token, index) => {
    for (const w of words(token.text)) {
      flat.push(w);
      owner.push(index);
    }
  });
  const echo = echoFlags(flat, ours);
  const last = flat.length - 1;
  if (!final && flat.length && !echo[last] && ours.some((ref) => ref.some((w) => close(flat[last], w)))) {
    echo[last] = true;
  }
  const keep = new Set(owner.filter((_, k) => !echo[k]));
  // Back the way it was written: a space only where there was whitespace, and between two non-CJK
  // tokens, which can only meet once the echo between them is cut ("OK明天下午三点thanks").
  let said = '';
  let prev: EchoToken | null = null;
  for (const [i, token] of tokens.entries()) {
    if (!keep.has(i)) continue;
    if (prev && (token.spaced || (!prev.cjk && !token.cjk))) said += ' ';
    said += token.text;
    prev = token;
  }
  return [said, echo.filter((e) => !e).length];
}

interface EchoToken {
  text: string;
  spaced: boolean;   // whitespace came before it
  cjk: boolean;      // it holds a Chinese or Japanese character
}

/**
 * stripEcho's tokens: whitespace chunks, except that each Chinese or Japanese character is a token of its
 * own ("OK好的" is OK, 好, 的), so our echo can be cut out of unspaced text. Punctuation stays with the
 * token it follows: 好的。 keeps the full stop that endsSentence looks for. One pass with flags, never
 * rescanning the token, or a long unspaced chunk would take quadratic time.
 */
function echoTokens(text: string): EchoToken[] {
  const tokens: EchoToken[] = [];
  for (const chunk of (text || '').normalize('NFC').split(/\s+/).filter(Boolean)) {
    let token: EchoToken = { text: '', spaced: true, cjk: false };
    let hasWord = false;   // the token holds a letter or digit, not only punctuation
    for (const ch of chunk) {
      // A CJK character starts a token unless only punctuation precedes it in the chunk,
      // and so does a letter or digit right after a CJK character.
      const cjk = isCjk(ch);
      const wordChar = cjk || LETTER_OR_DIGIT.test(ch);
      if ((cjk && hasWord) || (wordChar && !cjk && token.cjk)) {
        tokens.push(token);
        token = { text: '', spaced: false, cjk: false };
        hasWord = false;
      }
      token.text += ch;
      token.cjk ||= cjk;
      hasWord ||= wordChar;
    }
    tokens.push(token);
  }
  return tokens;
}
