import { db } from '../config/db.js';
import { workspaces, depositTransactions, platformSettings } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { DEFAULT_PLATFORM_MARKUP, calculateClientCost } from '../config/pricing.js';
import type { ProviderConfig } from '../models/types.js';

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

/**
 * Deduct usage cost from a workspace deposit. All providers are platform-managed,
 * so every usage type is charged (markup default x3). The platform admin's own
 * workspace is exempt — its usage is internal.
 *
 * Creates a separate deposit_transaction per cost type (stt/llm/tts/telephony)
 * so the dashboard query can split costs by ILIKE pattern matching.
 */
export async function deductUsageCost(params: DeductUsageCostParams): Promise<DeductResult> {
  const { workspaceId, providerCosts, referenceType, referenceId } = params;

  // The platform admin owns the providers — never bill the admin's own usage.
  const { getAdminWorkspaceId } = await import('./credential-resolver.service.js');
  const adminWs = await getAdminWorkspaceId().catch(() => null);
  if (adminWs && workspaceId === adminWs) {
    return { success: true, newBalance: -1, providerCostTotal: 0, clientCostTotal: 0 };
  }

  const markup = await getMarkup();

  // All providers are platform-managed now — every usage type is charged.
  const sttCost       = providerCosts.stt;
  const llmCost       = providerCosts.llm;
  const ttsCost       = providerCosts.tts;
  const telephonyCost = providerCosts.telephony;

  const providerCostTotal = sttCost + llmCost + ttsCost + telephonyCost;
  if (providerCostTotal === 0) {
    return { success: true, newBalance: -1, providerCostTotal: 0, clientCostTotal: 0 };
  }

  const clientCostTotal = calculateClientCost(providerCostTotal, markup);

  // Atomic balance deduction (single UPDATE for consistency)
  const result = await db.update(workspaces)
    .set({
      balance_usd: sql`balance_usd - ${clientCostTotal.toFixed(4)}::numeric`,
      updated_at: sql`now()`,
    })
    .where(eq(workspaces.id, workspaceId))
    .returning({ balance_usd: workspaces.balance_usd });

  const newBalance = result.length ? parseFloat(result[0].balance_usd as string) : 0;

  // Insert one deposit_transaction per cost type so the dashboard stats query
  // can match them with ILIKE '%stt%', '%llm%', '%tts%', '%telephony%'.
  // All share the same balance_after (the post-deduction balance).
  const rows: Array<{
    workspace_id: string; type: 'usage'; amount_usd: string;
    balance_after: string; description: string;
    reference_type: string; reference_id: string;
  }> = [];
  if (sttCost > 0)       rows.push({ workspace_id: workspaceId, type: 'usage', amount_usd: (-calculateClientCost(sttCost, markup)).toFixed(4),       balance_after: newBalance.toFixed(4), description: 'STT usage',       reference_type: referenceType, reference_id: referenceId });
  if (llmCost > 0)       rows.push({ workspace_id: workspaceId, type: 'usage', amount_usd: (-calculateClientCost(llmCost, markup)).toFixed(4),       balance_after: newBalance.toFixed(4), description: 'LLM usage',       reference_type: referenceType, reference_id: referenceId });
  if (ttsCost > 0)       rows.push({ workspace_id: workspaceId, type: 'usage', amount_usd: (-calculateClientCost(ttsCost, markup)).toFixed(4),       balance_after: newBalance.toFixed(4), description: 'TTS usage',       reference_type: referenceType, reference_id: referenceId });
  if (telephonyCost > 0) rows.push({ workspace_id: workspaceId, type: 'usage', amount_usd: (-calculateClientCost(telephonyCost, markup)).toFixed(4), balance_after: newBalance.toFixed(4), description: 'Telephony usage', reference_type: referenceType, reference_id: referenceId });

  if (rows.length > 0) {
    await db.insert(depositTransactions).values(rows);
  }

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
 * Atomic conditional debit: only succeeds if balance_usd >= amount. Unlike
 * deductUsageCost it never drives the balance negative and applies no markup.
 * Accepts an optional executor so callers can run it inside db.transaction()
 * (helpers on the global `db` handle would escape a caller's tx).
 */
export async function debitBalance(params: {
  workspaceId: string;
  amountUsd: number;
  type: 'number_rental';
  description?: string;
  referenceType?: string;
  referenceId?: string;
  createdBy?: string;
}, executor: Pick<typeof db, 'update' | 'insert'> = db): Promise<{ success: boolean; newBalance: number }> {
  const amount = params.amountUsd.toFixed(4);
  const result = await executor.update(workspaces)
    .set({
      balance_usd: sql`balance_usd - ${amount}::numeric`,
      updated_at: sql`now()`,
    })
    .where(and(
      eq(workspaces.id, params.workspaceId),
      sql`balance_usd >= ${amount}::numeric`,
    ))
    .returning({ balance_usd: workspaces.balance_usd });

  if (!result.length) {
    return { success: false, newBalance: 0 };
  }

  const newBalance = parseFloat(result[0].balance_usd as string);

  await executor.insert(depositTransactions).values({
    workspace_id: params.workspaceId,
    type: params.type,
    amount_usd: (-params.amountUsd).toFixed(4),
    balance_after: newBalance.toFixed(4),
    description: params.description || params.type,
    reference_type: params.referenceType || null,
    reference_id: params.referenceId || null,
    created_by: params.createdBy || null,
  });

  return { success: true, newBalance };
}

/**
 * Check if workspace has sufficient balance. All providers are platform-managed,
 * so any usage requires a positive balance. (providerConfig is retained in the
 * signature for call-site compatibility but no longer consulted.)
 */
export function hasSufficientBalance(balanceUsd: number, _providerConfig: ProviderConfig): boolean {
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
