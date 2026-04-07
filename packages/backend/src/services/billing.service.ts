import { db } from '../config/db.js';
import { workspaces, depositTransactions, platformSettings } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { DEFAULT_PLATFORM_MARKUP, calculateClientCost } from '../config/pricing.js';
import type { ProviderConfig, ProviderName } from '../models/types.js';

// ─── Markup ───────────────────────────────────────────────────────────────

let cachedMarkup: number | null = null;
let markupCachedAt = 0;
const MARKUP_CACHE_TTL = 60_000; // 1 min

export async function getMarkup(): Promise<number> {
  if (cachedMarkup !== null && Date.now() - markupCachedAt < MARKUP_CACHE_TTL) {
    return cachedMarkup;
  }
  const row = await db.select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, 'billing_markup'))
    .limit(1);
  cachedMarkup = row.length ? parseFloat(row[0].value as string) : DEFAULT_PLATFORM_MARKUP;
  markupCachedAt = Date.now();
  return cachedMarkup;
}

// ─── Balance Operations ───────────────────────────────────────────────────

export interface DeductUsageCostParams {
  workspaceId: string;
  providerCosts: {
    stt: number;
    llm: number;
    tts: number;
    telephony: number;
    sttProvider?: string;
    llmProvider?: string;
    ttsProvider?: string;
  };
  providerConfig: ProviderConfig;
  referenceType: 'call_session' | 'translator_session';
  referenceId: string;
  description?: string;
}

export interface DeductResult {
  success: boolean;
  newBalance: number;
  providerCostTotal: number;
  clientCostTotal: number;
}

/** Map provider name from service to ProviderName key in config */
function resolveProviderKey(service: string): ProviderName | null {
  const map: Record<string, ProviderName> = {
    deepgram: 'deepgram',
    openai: 'openai',
    anthropic: 'anthropic',
    elevenlabs: 'elevenlabs',
    xai: 'xai',
    twilio: 'twilio',
  };
  return map[service] ?? null;
}

/**
 * Deduct usage cost from workspace deposit.
 * Only charges for providers set to "platform" in providerConfig.
 * Applies markup (default x3).
 */
export async function deductUsageCost(params: DeductUsageCostParams): Promise<DeductResult> {
  const { workspaceId, providerCosts, providerConfig, referenceType, referenceId, description } = params;
  const markup = await getMarkup();

  // Sum cost only for platform providers
  let providerCostTotal = 0;
  const sttKey = resolveProviderKey(providerCosts.sttProvider || 'deepgram');
  const llmKey = resolveProviderKey(providerCosts.llmProvider || 'anthropic');
  const ttsKey = resolveProviderKey(providerCosts.ttsProvider || 'elevenlabs');

  if (!sttKey || providerConfig[sttKey] !== 'own') providerCostTotal += providerCosts.stt;
  if (!llmKey || providerConfig[llmKey] !== 'own') providerCostTotal += providerCosts.llm;
  if (!ttsKey || providerConfig[ttsKey] !== 'own') providerCostTotal += providerCosts.tts;
  if (providerConfig.twilio !== 'own') providerCostTotal += providerCosts.telephony;

  if (providerCostTotal === 0) {
    return { success: true, newBalance: -1, providerCostTotal: 0, clientCostTotal: 0 };
  }

  const clientCostTotal = calculateClientCost(providerCostTotal, markup);

  // Atomic deduction — balance may go slightly negative for in-progress calls
  const result = await db.update(workspaces)
    .set({
      balance_usd: sql`balance_usd - ${clientCostTotal.toFixed(4)}::numeric`,
      updated_at: sql`now()`,
    })
    .where(eq(workspaces.id, workspaceId))
    .returning({ balance_usd: workspaces.balance_usd });

  const newBalance = result.length ? parseFloat(result[0].balance_usd as string) : 0;

  // Record transaction
  await db.insert(depositTransactions).values({
    workspace_id: workspaceId,
    type: 'usage',
    amount_usd: (-clientCostTotal).toFixed(4),
    balance_after: newBalance.toFixed(4),
    description: description || `Usage: ${referenceType}`,
    reference_type: referenceType,
    reference_id: referenceId,
  });

  return { success: true, newBalance, providerCostTotal, clientCostTotal };
}

/**
 * Credit deposit (top-up, promo, refund, etc.)
 */
export async function creditDeposit(params: {
  workspaceId: string;
  amountUsd: number;
  type: 'topup' | 'refund' | 'promo' | 'signup_bonus' | 'gift';
  description?: string;
  referenceType?: string;
  referenceId?: string;
  createdBy?: string;
}): Promise<{ newBalance: number }> {
  const result = await db.update(workspaces)
    .set({
      balance_usd: sql`balance_usd + ${params.amountUsd.toFixed(4)}::numeric`,
      updated_at: sql`now()`,
    })
    .where(eq(workspaces.id, params.workspaceId))
    .returning({ balance_usd: workspaces.balance_usd });

  const newBalance = result.length ? parseFloat(result[0].balance_usd as string) : 0;

  await db.insert(depositTransactions).values({
    workspace_id: params.workspaceId,
    type: params.type,
    amount_usd: params.amountUsd.toFixed(4),
    balance_after: newBalance.toFixed(4),
    description: params.description || params.type,
    reference_type: params.referenceType || null,
    reference_id: params.referenceId || null,
    created_by: params.createdBy || null,
  });

  return { newBalance };
}

/**
 * Check if workspace has sufficient balance for platform providers.
 * Returns true if balance > 0 or workspace uses only own keys.
 */
export function hasSufficientBalance(balanceUsd: number, providerConfig: ProviderConfig): boolean {
  // If all providers are "own", no balance needed
  const usePlatform = Object.values(providerConfig).some(v => v !== 'own');
  if (!usePlatform) return true;
  // If providerConfig is empty, default is "platform" — need balance
  if (Object.keys(providerConfig).length === 0) return balanceUsd > 0;
  return balanceUsd > 0;
}

/**
 * Get workspace balance and recent transactions
 */
export async function getBalance(workspaceId: string): Promise<{ balanceUsd: number }> {
  const result = await db.select({ balance_usd: workspaces.balance_usd })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return { balanceUsd: result.length ? parseFloat(result[0].balance_usd as string) : 0 };
}
