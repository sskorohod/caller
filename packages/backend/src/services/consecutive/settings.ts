import { z } from 'zod';

/** platform_settings key with the consecutive translator's thresholds (admin → Settings → Translator). */
export const CONSECUTIVE_SETTINGS_KEY = 'translator_consecutive';
export const TRANSLATION_MODELS = ['gpt-6-luna', 'gpt-6-sol'] as const;
export type TranslationModel = (typeof TRANSLATION_MODELS)[number];

export interface ConsecutiveSettings {
  model: TranslationModel;
  endSilenceMs: number;       // silence after which a finished thought is released
  hardEndMs: number;          // released even if the judge never said "complete"
  semanticThreshold: number;  // judge confidence needed to act on its verdict
  bargeInWords: number;       // real words over our playback before the intent judge is asked
}

export const DEFAULT_CONSECUTIVE_SETTINGS: ConsecutiveSettings = {
  model: 'gpt-6-luna', endSilenceMs: 700, hardEndMs: 2200, semanticThreshold: 0.8, bargeInWords: 5,
};

// Ranges are aidispatch's (agent/config_store.py).
const FIELDS = {
  model: z.enum(TRANSLATION_MODELS),
  end_silence_ms: z.number().int().min(300).max(3000),
  hard_end_ms: z.number().int().min(800).max(8000),
  semantic_threshold: z.number().min(0.5).max(0.99),
  barge_in_words: z.number().int().min(1).max(15),
};

/** Admin PUT body for the key: every field optional, nothing unknown. The two silence thresholds overlap in
 *  range, and the hard limit is meant to be the LAST gate — with it at or below the end-of-thought pause the
 *  order inverts and everything releases by the hard limit, so backchannels and transcription garbage get
 *  spoken aloud. The schema is partial, so a PUT of one field alone skips this; parseConsecutiveSettings
 *  repairs that case. */
export const consecutiveSettingsSchema = z.object(FIELDS).partial().strict()
  .refine(v => v.hard_end_ms === undefined || v.end_silence_ms === undefined || v.hard_end_ms > v.end_silence_ms,
    { message: 'hard_end_ms must be greater than end_silence_ms', path: ['hard_end_ms'] });

/** Stored value → settings. A missing or out-of-range field falls back to its default; never throws. */
export function parseConsecutiveSettings(raw: unknown): ConsecutiveSettings {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { value = null; }
  }
  const obj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const d = DEFAULT_CONSECUTIVE_SETTINGS;
  const model = FIELDS.model.safeParse(obj.model);
  const endSilence = FIELDS.end_silence_ms.safeParse(obj.end_silence_ms);
  const hardEnd = FIELDS.hard_end_ms.safeParse(obj.hard_end_ms);
  const threshold = FIELDS.semantic_threshold.safeParse(obj.semantic_threshold);
  const bargeIn = FIELDS.barge_in_words.safeParse(obj.barge_in_words);
  const endSilenceMs = endSilence.success ? endSilence.data : d.endSilenceMs;
  return {
    model: model.success ? model.data : d.model,
    endSilenceMs,
    // The hard limit is the last gate: at or below the end-of-thought pause every release reason but 'hard'
    // goes dead and the drops that hold back backchannels and garbage stop firing. A no-op on any sane pair,
    // and in range at the worst case (3000 + 100).
    hardEndMs: Math.max(hardEnd.success ? hardEnd.data : d.hardEndMs, endSilenceMs + 100),
    semanticThreshold: threshold.success ? threshold.data : d.semanticThreshold,
    bargeInWords: bargeIn.success ? bargeIn.data : d.bargeInWords,
  };
}

const SETTINGS_TIMEOUT_MS = 1000;

export async function loadConsecutiveSettings(): Promise<ConsecutiveSettings> {
  try {
    const { getPlatformSetting } = await import('../platform-settings.service.js');
    // A stuck settings query must not hold up a live call: after a second, defaults.
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), SETTINGS_TIMEOUT_MS).unref());
    return parseConsecutiveSettings(await Promise.race([getPlatformSetting(CONSECUTIVE_SETTINGS_KEY), timeout]));
  } catch {
    return { ...DEFAULT_CONSECUTIVE_SETTINGS };   // settings unreachable: the call still runs
  }
}
