/**
 * Shared constants used across multiple frontend pages.
 * Eliminates duplication of LANGUAGES, VOICES, STATUS_COLORS, etc.
 */

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Russian' },
  { value: 'uk', label: 'Ukrainian' },
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

// Voices of the realtime model that actually speaks the translation. The old
// list (ara/eve/rex/sal/leo) belonged to xAI TTS, which no longer runs the voice
// path — picking one of those did nothing you could hear.
export const TTS_VOICES = [
  { value: 'marin', label: 'Marin', gender: 'Female' },
  { value: 'coral', label: 'Coral', gender: 'Female' },
  { value: 'shimmer', label: 'Shimmer', gender: 'Female' },
  { value: 'cedar', label: 'Cedar', gender: 'Male' },
  { value: 'ash', label: 'Ash', gender: 'Male' },
  { value: 'verse', label: 'Verse', gender: 'Male' },
] as const;

export const DEFAULT_TTS_VOICE = 'marin';

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
