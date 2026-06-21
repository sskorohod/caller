import { detect as detectLang } from 'tinyld';

/** Languages written in Cyrillic — used for the script-difference heuristic. */
export const CYRILLIC_LANGS = new Set(['ru', 'uk', 'bg', 'sr']);

// Languages we treat as "close enough" to a configured language for direction
// detection. Phone-call STT is short and noisy and tinyld will often
// misclassify within these families (e.g. ru ↔ uk on a Russian phrase with
// a Ukrainian-looking name).
export const LANG_FAMILIES: Record<string, string[]> = {
  ru: ['ru', 'uk', 'bg', 'sr', 'be', 'mk'],
  en: ['en'],
  es: ['es', 'gl', 'ca'],
  pt: ['pt', 'gl'],
  fr: ['fr'],
  de: ['de', 'nl'],
  it: ['it'],
};

/** Whether the configured language pair uses different scripts (Cyrillic vs Latin). */
export function languagesUseDifferentScripts(myLang: string, targetLang: string): boolean {
  return CYRILLIC_LANGS.has(myLang) !== CYRILLIC_LANGS.has(targetLang);
}

/**
 * Decide whether transcribed input belongs to myLang or targetLang.
 * Uses tinyld (a real language detector) and falls back to the older
 * cyrillic-only heuristic if tinyld can't decide. The cyrillic heuristic
 * is what existed before — fine for ru↔en, useless for ES↔EN, FR↔EN, etc.
 *
 * Shared by ConferenceTranslator (Grok Voice) and StealthTranslator (Deepgram).
 */
export function detectTranslationDirection(
  text: string,
  myLang: string,
  targetLang: string,
): { isMyLang: boolean; detectedLang: string } {
  const myFamily = LANG_FAMILIES[myLang] ?? [myLang];
  const targetFamily = LANG_FAMILIES[targetLang] ?? [targetLang];

  if (text && text.length >= 4) {
    const detected = detectLang(text);
    if (detected) {
      if (myFamily.includes(detected)) {
        return { isMyLang: true, detectedLang: myLang };
      }
      if (targetFamily.includes(detected)) {
        return { isMyLang: false, detectedLang: targetLang };
      }
    }
  }

  // Fallback: legacy cyrillic-ratio heuristic. Only meaningful when one of
  // the configured languages uses Cyrillic and the other doesn't.
  const cyrillicRatio = (text.match(/[Ѐ-ӿ]/g) || []).length / Math.max(text.length, 1);
  const myIsCyrillic = CYRILLIC_LANGS.has(myLang);
  const targetIsCyrillic = CYRILLIC_LANGS.has(targetLang);
  if (myIsCyrillic !== targetIsCyrillic) {
    const inputIsCyrillic = cyrillicRatio > 0.3;
    const isMyLang = inputIsCyrillic === myIsCyrillic;
    return { isMyLang, detectedLang: isMyLang ? myLang : targetLang };
  }

  // Same-script pair and no detection signal — assume myLang as a stable
  // default (better than coin-flipping per turn).
  return { isMyLang: true, detectedLang: myLang };
}
