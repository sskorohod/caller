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
  ['kana', /[\p{Script=Hiragana}\p{Script=Katakana}]/u], ['hangul', /\p{Script=Hangul}/u],
  ['devanagari', /\p{Script=Devanagari}/u],
];
const LETTER = /\p{L}/u;
const MARK = /\p{M}/u;
const ALNUM = /[\p{L}\p{N}]/u;
// Chinese and Japanese write no spaces: one ideograph or kana is one token, or a whole
// Chinese sentence would count as one "word" against every word threshold in the core.
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** Lower-case words without punctuation: "Uh-huh" and "uh huh" from the transcriber must match the lists. */
export function words(text: string): string[] {
  const out: string[] = [];
  let word = '';
  for (const ch of (text || '').toLowerCase().replace(/ё/g, 'е')) {
    if (MARK.test(ch)) continue;                  // vowel signs and diacritics stay inside the word
    if (CJK.test(ch)) {
      if (word) { out.push(word); word = ''; }
      out.push(ch);
    } else if (ALNUM.test(ch)) {
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
  ar: ['نعم', 'أيوه', 'ايوه', 'طيب', 'تمام', 'حسنا', 'شكرا'],
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
const LEADING_WORDS = new Set(
  ['no', 'oh', 'hey', 'okay', 'ok', 'нет', 'ой', 'эй', 'ну', 'так', 'ні', 'nein', 'non', 'não', 'nao'].map(norm),
);
const ALL_BACKCHANNELS = new Set(Object.values(BACKCHANNELS).flat().map(norm));
const ALL_STOPS = [...new Set(Object.values(STOP_PHRASES).flat().map(norm))].sort((a, b) => b.length - a.length);

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
  if (total < 2 && !['han', 'japanese', 'hangul', 'other'].includes(best)) return null;   // one letter may start a word
  return bestCount / total >= 0.6 ? best : null;
}

/** Which side of the pair said it. A pair sharing one script never gets here: it runs on the cascade. */
export function languageOf(text: string, langA: string, langB: string): string | null {
  const script = scriptOf(text, langA === 'ja' || langB === 'ja');
  if (script === null) return null;
  for (const lang of [langA, langB]) if (LANGUAGE_GROUPS[lang] === script) return lang;
  return null;
}

export function pairScripts(langA: string, langB: string): Set<string> {
  return new Set([LANGUAGE_GROUPS[langA], LANGUAGE_GROUPS[langB]].filter(Boolean));
}

export function isCrossScriptPair(langA: string, langB: string): boolean {
  const a = LANGUAGE_GROUPS[langA];
  const b = LANGUAGE_GROUPS[langB];
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
  return ALL_STOPS.some((phrase) => head === phrase || head.startsWith(phrase + ' '));
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
    if (head === phrase || head.startsWith(phrase + ' ')) {
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
  const x = [...a];   // code points, as Python's len() and indexing count them
  const y = [...b];
  if (Math.min(x.length, y.length) < 5 || Math.abs(x.length - y.length) > 1) return false;
  if (x.length === y.length) return x.filter((ch, i) => ch !== y[i]).length <= 1;
  const [short, long] = x.length < y.length ? [x, y] : [y, x];
  const target = short.join('');
  return long.some((_, i) => [...long.slice(0, i), ...long.slice(i + 1)].join('') === target);
}

/**
 * Echo is a run of our translation, not a single shared word: "I" and "said" are in almost any English
 * translation, and dropping them would mean not hearing a real "No, that's not what I said".
 */
function echoFlags(seq: string[], ours: string[][]): boolean[] {
  const echo: boolean[] = new Array(seq.length).fill(false);
  for (let i = 0; i < seq.length; i++) {
    for (const ref of ours) {
      for (let j = 0; j < ref.length; j++) {
        let k = 0;
        while (i + k < seq.length && j + k < ref.length && close(seq[i + k], ref[j + k])) k += 1;
        if (k >= 2) {
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
  const tokens = (text || '').split(/\s+/).filter(Boolean);
  const ours = [...played].filter(Boolean).map((p) => words(p));
  const flat: string[] = [];
  const owner: number[] = [];
  tokens.forEach((token, index) => {
    for (const w of words(token)) {
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
  return [tokens.filter((_, i) => keep.has(i)).join(' '), echo.filter((e) => !e).length];
}
