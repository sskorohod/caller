/**
 * Centralized language names, tone instructions, and filler phrases.
 * Used by conference-translator, media-stream, call-orchestrator, post-call worker.
 */

export const LANG_NAMES: Record<string, string> = {
  en: 'English',
  ru: 'Russian',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  pt: 'Portuguese',
  it: 'Italian',
  ar: 'Arabic',
  hi: 'Hindi',
};

export function getLangName(code: string): string {
  return LANG_NAMES[code] || code;
}

export const TONE_INSTRUCTIONS: Record<string, string> = {
  neutral: 'Translate naturally, preserving the original tone and meaning.',
  business: 'Use a professional, formal business tone. Remove filler words (um, uh, er, hmm). Use clear, precise language appropriate for business meetings and appointments.',
  friendly: 'Use a warm, casual, friendly tone. Keep the conversational feel natural and relaxed.',
  medical: 'Use precise medical terminology. Translate accurately without simplifying medical terms. Maintain a calm, professional tone.',
  legal: 'Use precise legal terminology. Translate accurately without paraphrasing legal concepts. Maintain a formal, authoritative tone.',
  intelligent: 'Before translating, mentally clean up the speaker\'s words: remove ALL filler words (um, uh, er, hmm, М, Э, ну, типа, как бы), remove false starts and repetitions. Then translate the cleaned-up version into the OTHER language. The output MUST be in a DIFFERENT language than the input — NEVER output in the same language as was spoken.',
};

export const FILLER_PHRASES: Record<string, string[]> = {
  en: ['One moment...', 'Let me check...', 'Just a second...'],
  ru: ['Одну секунду...', 'Сейчас проверю...', 'Минуточку...'],
};
