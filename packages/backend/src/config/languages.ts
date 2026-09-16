/**
 * Centralized language names, tone instructions, and filler phrases.
 * Used by conference-translator, media-stream, call-orchestrator, post-call worker.
 */

// Last-resort fallback; the admin-configurable platform default lives in
// platform_settings.default_greeting (resolved at the media-stream
// construction site).
export const DEFAULT_GREETING = `Hi, I'm your AI interpreter. Please go ahead.`;

export const LANG_NAMES: Record<string, string> = {
  en: 'English',
  ru: 'Russian',
  uk: 'Ukrainian',
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
  // Deliberately empty: this is the "no intervention" setting. Both callers
  // check the value for truthiness, so an empty string appends nothing to the
  // prompt at all — the model translates with no register instruction of any
  // kind. Even "translate naturally, preserving tone" is still a nudge.
  neutral: '',
  business: 'Professional, formal register suited to a business meeting: precise wording, with hesitations, false starts and repetitions smoothed out.',
  friendly: 'Use a warm, casual, friendly tone. Keep the conversational feel natural and relaxed.',
  medical: 'Use precise medical terminology. Translate accurately without simplifying medical terms. Maintain a calm, professional tone.',
  legal: 'Use precise legal terminology. Translate accurately without paraphrasing legal concepts. Maintain a formal, authoritative tone.',
  intelligent: 'Polished, articulate register: well-formed sentences and courteous phrasing, free of hesitation, while keeping the speaker\'s meaning and intent exactly.',
};

export const FILLER_PHRASES: Record<string, string[]> = {
  en: ['One moment...', 'Let me check...', 'Just a second...'],
  ru: ['Одну секунду...', 'Сейчас проверю...', 'Минуточку...'],
};

/**
 * Bridging phrases — said BEFORE a slow lookup/RAG/tool call to fill the silence
 * while the agent thinks. Distinct from FILLER_PHRASES (which fire when the agent
 * is unexpectedly slow). Used by the call orchestrator's RAG bridging timer.
 */
export const BRIDGING_PHRASES: Record<string, string[]> = {
  en: ['One moment, let me check', 'Let me pull that up', 'Just a second, looking that up'],
  ru: ['Секунду, посмотрю', 'Минутку, сейчас уточню', 'Подождите немного, проверю'],
};

export function pickBridgingPhrase(lang: string, customPhrases?: string[]): string {
  const pool = customPhrases?.length ? customPhrases : (BRIDGING_PHRASES[lang] || BRIDGING_PHRASES.en);
  return pool[Math.floor(Math.random() * pool.length)];
}
