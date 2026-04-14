/**
 * Shared constants used across multiple frontend pages.
 * Eliminates duplication of LANGUAGES, VOICES, STATUS_COLORS, etc.
 */

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Russian' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ar', label: 'Arabic' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'hi', label: 'Hindi' },
] as const;

export const LANGUAGE_MAP: Record<string, string> = Object.fromEntries(
  LANGUAGES.map(l => [l.value, l.label])
);

export const TTS_VOICES = [
  { value: 'ara', label: 'Ara', gender: 'Female' },
  { value: 'eve', label: 'Eve', gender: 'Female' },
  { value: 'tara', label: 'Tara', gender: 'Female' },
  { value: 'rex', label: 'Rex', gender: 'Male' },
  { value: 'sal', label: 'Sal', gender: 'Male' },
  { value: 'leo', label: 'Leo', gender: 'Male' },
] as const;

export const TRANSLATION_MODES = [
  { value: 'voice', label: 'Voice' },
  { value: 'text', label: 'Text' },
  { value: 'both', label: 'Both' },
] as const;

export const WHO_HEARS_OPTIONS = [
  { value: 'subscriber', label: 'Subscriber only' },
  { value: 'both', label: 'Both parties' },
] as const;

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'rgba(74, 222, 128, 0.1)', text: 'var(--th-success-text)' },
  blocked: { bg: 'rgba(248, 113, 113, 0.1)', text: '#f87171' },
  disabled: { bg: 'rgba(156, 163, 175, 0.1)', text: '#9ca3af' },
  completed: { bg: 'rgba(74, 222, 128, 0.1)', text: 'var(--th-success-text)' },
  in_progress: { bg: 'rgba(173, 198, 255, 0.1)', text: 'var(--th-primary-light)' },
  failed: { bg: 'rgba(248, 113, 113, 0.1)', text: '#f87171' },
  pending: { bg: 'rgba(250, 204, 21, 0.1)', text: 'var(--th-warning-text)' },
};
