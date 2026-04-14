export interface TranscriptEntry {
  speaker: 'caller' | 'operator' | 'system';
  text: string;
  timestamp: string;
  isFinal: boolean;
  translated?: string;
  correction?: string;
  correctionExplanation?: string;
}

export type CallState = 'idle' | 'connecting' | 'ringing' | 'in_call' | 'ended';

export const STT_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
];

// Map timezone prefix to phone placeholder and default STT language
export function getRegionDefaults(timezone: string, languages: string[]): { placeholder: string; defaultSttLang: string } {
  const tz = timezone.toLowerCase();
  if (tz.startsWith('america/')) return { placeholder: '+1', defaultSttLang: languages.includes('es') ? 'es' : 'en' };
  if (tz.startsWith('europe/moscow') || tz.startsWith('europe/samara') || tz.startsWith('asia/yekaterinburg') || tz.startsWith('asia/novosib') || tz.startsWith('asia/vladivostok'))
    return { placeholder: '+7', defaultSttLang: 'ru' };
  if (tz.startsWith('europe/berlin') || tz.startsWith('europe/vienna') || tz.startsWith('europe/zurich'))
    return { placeholder: '+49', defaultSttLang: 'de' };
  if (tz.startsWith('europe/paris')) return { placeholder: '+33', defaultSttLang: 'fr' };
  if (tz.startsWith('europe/madrid')) return { placeholder: '+34', defaultSttLang: 'es' };
  if (tz.startsWith('europe/london')) return { placeholder: '+44', defaultSttLang: 'en' };
  return { placeholder: '+1', defaultSttLang: languages[0] || 'en' };
}

export const TRANSLATE_LANGUAGES = [
  { value: '', label: 'Off' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
];

// ─── Pricing (mirrors backend pricing.ts) ──────────────────────────────────

export const PRICING = {
  telephony: { twilio: 0.013 }, // per minute per leg
  stt: { deepgram: 0.0043, openai: 0.006 }, // per minute per stream
  tts: { openai: 0.015, xai: 0.015, elevenlabs: 0.30 }, // per 1K chars
  llm_translation: 0.00003, // ~estimate per translation (50 in + 150 out tokens at gpt-4o-mini rates)
};

export const GROK_VOICES = [
  { value: 'ara', label: 'Ara', gender: 'Female' },
  { value: 'eve', label: 'Eve', gender: 'Female' },
  { value: 'rex', label: 'Rex', gender: 'Male' },
  { value: 'sal', label: 'Sal', gender: 'Male' },
  { value: 'leo', label: 'Leo', gender: 'Male' },
];
