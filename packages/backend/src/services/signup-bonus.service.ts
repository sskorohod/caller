import { db } from '../config/db.js';
import { bonusBlockedPhones, bonusClaimAttempts, depositTransactions, platformSettings, workspaces } from '../db/schema.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { normalizePhone } from '../lib/phone.js';

export type BonusGrantSource = 'register' | 'magic_link' | 'phone_update';

export interface BonusGrantResult {
  granted: boolean; // bonus credited now
  blocked: boolean; // a phone already claimed the bonus — attempt logged
}

export type SignupBonusStatus = 'granted' | 'blocked' | 'pending_phone' | 'none';

async function getBonusAmount(): Promise<number> {
  const [row] = await db.select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, 'billing_signup_bonus_usd'))
    .limit(1);
  if (!row) return 2.00;
  return Number(typeof row.value === 'string' ? JSON.parse(row.value) : row.value);
}

async function findClaimedPhones(phones: string[]): Promise<string[]> {
  if (!phones.length) return [];
  const rows = await db.select({ p: bonusBlockedPhones.phone_number })
    .from(bonusBlockedPhones)
    .where(inArray(bonusBlockedPhones.phone_number, phones));
  return rows.map(r => r.p);
}

async function hasReceivedBonus(workspaceId: string): Promise<boolean> {
  const [row] = await db.select({ id: depositTransactions.id })
    .from(depositTransactions)
    .where(and(
      eq(depositTransactions.workspace_id, workspaceId),
      eq(depositTransactions.type, 'signup_bonus'),
    ))
    .limit(1);
  return !!row;
}

/**
 * Grant the signup bonus iff: a phone is provided, none of the phones ever
 * claimed a bonus before, and this workspace never received one (one bonus
 * per workspace AND per phone — forever). Blocked attempts are logged to
 * bonus_claim_attempts for the admin panel. Never throws.
 */
export async function grantSignupBonusIfEligible(params: {
  workspaceId: string;
  phones: string[];
  source: BonusGrantSource;
}): Promise<BonusGrantResult> {
  try {
    const phones = params.phones.map(p => normalizePhone(p)).filter((p): p is string => !!p);
    if (!phones.length) return { granted: false, blocked: false };

    const bonusAmount = await getBonusAmount();
    if (bonusAmount <= 0) return { granted: false, blocked: false };

    const claimed = await findClaimedPhones(phones);
    if (claimed.length > 0) {
      await db.insert(bonusClaimAttempts).values(claimed.map(phone => ({
        workspace_id: params.workspaceId,
        phone_number: phone,
        source: params.source,
      })));
      return { granted: false, blocked: true };
    }

    // One bonus per workspace, forever — even if the phone changed since.
    if (await hasReceivedBonus(params.workspaceId)) {
      return { granted: false, blocked: false };
    }

    // Claim first, credit second. The phone_number PK is the lock: a lost
    // concurrent race returns no rows and we treat the phone as claimed.
    return await db.transaction(async (tx) => {
      const inserted = await tx.insert(bonusBlockedPhones)
        .values(phones.map(phone => ({
          phone_number: phone,
          reason: 'bonus_claimed',
          claimed_by_workspace_id: params.workspaceId,
        })))
        .onConflictDoNothing()
        .returning({ phone_number: bonusBlockedPhones.phone_number });

      if (inserted.length === 0) {
        await tx.insert(bonusClaimAttempts).values(phones.map(phone => ({
          workspace_id: params.workspaceId,
          phone_number: phone,
          source: params.source,
        })));
        return { granted: false, blocked: true };
      }

      // Credit inline via tx (billing.service creditDeposit uses the global
      // db handle and would escape this transaction).
      const result = await tx.update(workspaces)
        .set({
          balance_usd: sql`balance_usd + ${bonusAmount.toFixed(4)}::numeric`,
          updated_at: sql`now()`,
        })
        .where(eq(workspaces.id, params.workspaceId))
        .returning({ balance_usd: workspaces.balance_usd });

      const newBalance = result.length ? parseFloat(result[0].balance_usd as string) : 0;

      await tx.insert(depositTransactions).values({
        workspace_id: params.workspaceId,
        type: 'signup_bonus',
        amount_usd: bonusAmount.toFixed(4),
        balance_after: newBalance.toFixed(4),
        description: `Welcome bonus — $${bonusAmount} free credit`,
        reference_type: 'system',
      });

      return { granted: true, blocked: false };
    });
  } catch (err) {
    // Non-critical — never fail the calling flow (registration / settings save)
    console.error('grantSignupBonusIfEligible failed', err);
    return { granted: false, blocked: false };
  }
}

/** Status for the dashboard: drives the "gift already used" banner. */
export async function getSignupBonusStatus(workspaceId: string, rawPhones: string[]): Promise<SignupBonusStatus> {
  if (await hasReceivedBonus(workspaceId)) return 'granted';

  const phones = rawPhones.map(p => normalizePhone(p)).filter((p): p is string => !!p);
  if (!phones.length) return 'pending_phone';

  const claimed = await findClaimedPhones(phones);
  return claimed.length > 0 ? 'blocked' : 'none';
}
