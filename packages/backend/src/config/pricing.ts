/**
 * Pricing configuration for all providers.
 * Prices are in USD per unit.
 *
 * PRICING_DEFAULTS holds the pristine hardcoded values; the live tables
 * below are clones that loadPricingOverrides() resets to defaults and then
 * applies platform_settings.pricing overrides onto — so removing an
 * override takes effect without a server restart.
 */

export interface LlmModelPrice {
  inputPer1M: number;
  outputPer1M: number;
}

export interface PricingOverrides {
  llm?: Record<string, LlmModelPrice>;
  tts?: Record<string, number>;
  stt?: Record<string, number>;
  telephony?: Record<string, number>;
}

export const PRICING_DEFAULTS = {
  // ─── LLM (per 1M tokens) ───────────────────────────────────────────────
  llm: {
    // Anthropic
    'claude-sonnet-4-6-20250827': { inputPer1M: 3, outputPer1M: 15 },
    'claude-sonnet-4-5-20250514': { inputPer1M: 3, outputPer1M: 15 },
    'claude-opus-4-6-20250827': { inputPer1M: 15, outputPer1M: 75 },
    'claude-opus-4-5-20250514': { inputPer1M: 15, outputPer1M: 75 },
    'claude-haiku-4-5-20251001': { inputPer1M: 0.80, outputPer1M: 4.00 },
    'claude-haiku-3-5': { inputPer1M: 0.25, outputPer1M: 1.25 },
    // OpenAI
    'gpt-4.1': { inputPer1M: 2.00, outputPer1M: 8.00 },
    'gpt-4.1-mini': { inputPer1M: 0.40, outputPer1M: 1.60 },
    'gpt-4.1-nano': { inputPer1M: 0.10, outputPer1M: 0.40 },
    'o3': { inputPer1M: 10.00, outputPer1M: 40.00 },
    'o4-mini': { inputPer1M: 1.10, outputPer1M: 4.40 },
    'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10 },
    'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
    // xAI
    'grok-3-mini-fast': { inputPer1M: 0.30, outputPer1M: 0.50 },
    'grok-3-fast': { inputPer1M: 5, outputPer1M: 25 },
  } as Record<string, LlmModelPrice>,
  // ─── TTS (per 1K characters) ───────────────────────────────────────────
  tts: {
    elevenlabs: 0.30,  // ~$0.30 per 1K chars
    openai: 0.015,     // $15 per 1M chars
    xai: 0.015,        // approximate
  } as Record<string, number>,
  // ─── STT (per minute) ──────────────────────────────────────────────────
  stt: {
    deepgram: 0.0059,  // Nova-2 pay-as-you-go (updated Apr 2026)
    openai: 0.006,     // Whisper
  } as Record<string, number>,
  // ─── Telephony (per minute) ────────────────────────────────────────────
  telephony: {
    twilio: 0.013,     // US inbound/outbound average
  } as Record<string, number>,
} as const;

// Fallback for unknown models — use Claude Sonnet pricing
const DEFAULT_LLM_PRICING: LlmModelPrice = { inputPer1M: 3, outputPer1M: 15 };

// Live tables: defaults + applied overrides (mutated by loadPricingOverrides)
const LLM_PRICING: Record<string, LlmModelPrice> = structuredClone(PRICING_DEFAULTS.llm);
const TTS_PRICING: Record<string, number> = { ...PRICING_DEFAULTS.tts };
const STT_PRICING: Record<string, number> = { ...PRICING_DEFAULTS.stt };
const TELEPHONY_PRICING: Record<string, number> = { ...PRICING_DEFAULTS.telephony };

// ─── Calculator Functions ──────────────────────────────────────────────────

export function calculateLLMCost(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = LLM_PRICING[model] ?? DEFAULT_LLM_PRICING;
  return (tokensIn * pricing.inputPer1M + tokensOut * pricing.outputPer1M) / 1_000_000;
}

export function calculateTTSCost(provider: string, characters: number): number {
  const perK = TTS_PRICING[provider] ?? TTS_PRICING.elevenlabs;
  return (characters / 1000) * perK;
}

export function calculateSTTCost(provider: string, durationMinutes: number): number {
  const perMin = STT_PRICING[provider] ?? STT_PRICING.deepgram;
  return durationMinutes * perMin;
}

export function calculateTelephonyCost(provider: string, durationMinutes: number): number {
  const perMin = TELEPHONY_PRICING[provider] ?? TELEPHONY_PRICING.twilio;
  return durationMinutes * perMin;
}

// ─── Platform Markup ──────────────────────────────────────────────────────

/** Default markup multiplier (our cost × markup = client price). Overridden by platform_settings.billing_markup */
export const DEFAULT_PLATFORM_MARKUP = 3.0;

/** Calculate client-facing cost from provider cost using markup */
export function calculateClientCost(providerCost: number, markup: number = DEFAULT_PLATFORM_MARKUP): number {
  return providerCost * markup;
}

// ─── Dynamic Pricing from DB ──────────────────────────────────────────────

import { eq } from 'drizzle-orm';

let cachedPricing: Record<string, unknown> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Reset the live tables back to the pristine hardcoded defaults. */
function restoreDefaults(): void {
  for (const key of Object.keys(LLM_PRICING)) delete LLM_PRICING[key];
  Object.assign(LLM_PRICING, structuredClone(PRICING_DEFAULTS.llm));
  for (const key of Object.keys(TTS_PRICING)) delete TTS_PRICING[key];
  Object.assign(TTS_PRICING, PRICING_DEFAULTS.tts);
  for (const key of Object.keys(STT_PRICING)) delete STT_PRICING[key];
  Object.assign(STT_PRICING, PRICING_DEFAULTS.stt);
  for (const key of Object.keys(TELEPHONY_PRICING)) delete TELEPHONY_PRICING[key];
  Object.assign(TELEPHONY_PRICING, PRICING_DEFAULTS.telephony);
}

/**
 * Load pricing overrides from platform_settings. Restores the hardcoded
 * defaults first, so a removed override stops applying without a restart.
 * Cached for 5 minutes; call invalidatePricingCache() + this again after
 * an admin update to apply immediately.
 */
export async function loadPricingOverrides(): Promise<void> {
  if (cachedPricing && Date.now() - cachedAt < CACHE_TTL_MS) return;
  try {
    const { db } = await import('./db.js');
    const { platformSettings } = await import('../db/schema.js');
    const [row] = await db.select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, 'pricing'));

    restoreDefaults();
    if (row?.value && typeof row.value === 'object') {
      const overrides = row.value as PricingOverrides;
      if (overrides.stt) Object.assign(STT_PRICING, overrides.stt);
      if (overrides.tts) Object.assign(TTS_PRICING, overrides.tts);
      if (overrides.telephony) Object.assign(TELEPHONY_PRICING, overrides.telephony);
      if (overrides.llm) {
        for (const [model, prices] of Object.entries(overrides.llm)) {
          LLM_PRICING[model] = prices;
        }
      }
    }
    cachedPricing = (row?.value as Record<string, unknown>) ?? {};
    cachedAt = Date.now();
  } catch { /* fallback to hardcoded */ }
}

/** Currently applied overrides (for the admin pricing editor). */
export function getAppliedPricingOverrides(): PricingOverrides {
  return (cachedPricing as PricingOverrides | null) ?? {};
}

/** Force refresh pricing cache (after admin updates) */
export function invalidatePricingCache(): void {
  cachedPricing = null;
  cachedAt = 0;
}
