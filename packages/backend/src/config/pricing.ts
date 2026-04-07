/**
 * Pricing configuration for all providers.
 * Prices are in USD per unit.
 */

// ─── LLM Pricing (per 1M tokens) ──────────────────────────────────────────

const LLM_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
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
};

// Fallback for unknown models — use Claude Sonnet pricing
const DEFAULT_LLM_PRICING = { inputPer1M: 3, outputPer1M: 15 };

// ─── TTS Pricing (per 1K characters) ──────────────────────────────────────

const TTS_PRICING: Record<string, number> = {
  elevenlabs: 0.30,  // ~$0.30 per 1K chars
  openai: 0.015,     // $15 per 1M chars
  xai: 0.015,        // approximate
};

// ─── STT Pricing (per minute) ──────────────────────────────────────────────

const STT_PRICING: Record<string, number> = {
  deepgram: 0.0043,  // Nova-2 pay-as-you-go
  openai: 0.006,     // Whisper
};

// ─── Telephony Pricing (per minute) ────────────────────────────────────────

const TELEPHONY_PRICING: Record<string, number> = {
  twilio: 0.013,     // US inbound/outbound average
};

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
