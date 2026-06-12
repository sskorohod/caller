import { db } from '../config/db.js';
import { telephonyConnections, platformSettings } from '../db/schema.js';
import { eq, and, sql, lte } from 'drizzle-orm';
import { debitBalance, creditDeposit } from './billing.service.js';
import { getTwilioClient, configureTwilioInboundWebhook } from './telephony.service.js';
import { writeAuditLog } from './audit.service.js';
import { ConflictError, ValidationError } from '../lib/errors.js';

export interface PersonalNumber {
  id: string;
  phone_number: string;
  monthly_price_usd: number;
  purchased_at: Date | null;
  next_renewal_at: Date | null;
  auto_renew: boolean;
  status: string;
}

const DEFAULT_MONTHLY_PRICE = 3.00;

export async function getPersonalNumberPrice(): Promise<number> {
  const [row] = await db.select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, 'billing_personal_number_monthly_usd'))
    .limit(1);
  if (!row) return DEFAULT_MONTHLY_PRICE;
  const parsed = Number(typeof row.value === 'string' ? JSON.parse(row.value) : row.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MONTHLY_PRICE;
}

function toPersonalNumber(row: typeof telephonyConnections.$inferSelect): PersonalNumber {
  return {
    id: row.id,
    phone_number: row.phone_number,
    monthly_price_usd: parseFloat((row.monthly_price_usd as string | null) ?? '0'),
    purchased_at: row.purchased_at,
    next_renewal_at: row.next_renewal_at,
    auto_renew: row.auto_renew,
    status: row.status,
  };
}

export async function getPersonalNumber(workspaceId: string): Promise<PersonalNumber | null> {
  const [row] = await db.select().from(telephonyConnections)
    .where(and(
      eq(telephonyConnections.workspace_id, workspaceId),
      eq(telephonyConnections.is_personal, true),
      eq(telephonyConnections.status, 'active'),
    ))
    .limit(1);
  return row ? toPersonalNumber(row) : null;
}

/**
 * One-click purchase of a US local number. Ordering: debit first (never buy
 * a Twilio number for a user who can't pay), then buy, then configure the
 * webhook, then insert the row. Every Twilio/DB failure refunds the debit
 * and releases the number if it was already bought.
 */
export async function purchasePersonalNumber(params: {
  workspaceId: string;
  userId: string;
}): Promise<PersonalNumber> {
  const existing = await getPersonalNumber(params.workspaceId);
  if (existing) throw new ConflictError('You already have a personal number');

  const price = await getPersonalNumberPrice();

  // Resolve the Twilio client BEFORE taking money — broken/missing platform
  // creds must not leave a debit with nothing to refund.
  const client = await getTwilioClient(params.workspaceId);

  const debit = await debitBalance({
    workspaceId: params.workspaceId,
    amountUsd: price,
    type: 'number_rental',
    description: `Personal number — first month ($${price.toFixed(2)}/mo)`,
    referenceType: 'telephony_connection',
    createdBy: params.userId,
  });
  if (!debit.success) {
    throw new ValidationError(`INSUFFICIENT_BALANCE: top up at least $${price.toFixed(2)} to get a personal number`);
  }

  const refund = () => creditDeposit({
    workspaceId: params.workspaceId,
    amountUsd: price,
    type: 'refund',
    description: 'Personal number purchase failed — refund',
    referenceType: 'system',
  }).catch((refundErr) => {
    // Money is recoverable via the ledger (number_rental debit with no active
    // connection), but it MUST leave a trace.
    console.error('Personal number refund failed — manual credit needed', {
      workspaceId: params.workspaceId, amountUsd: price, refundErr,
    });
  });

  let purchasedSid: string | null = null;
  let purchasedNumber: string | null = null;
  try {
    const available = await client.availablePhoneNumbers('US').local.list({ voiceEnabled: true, limit: 1 });
    if (!available.length) {
      throw new ValidationError('No US numbers available right now, please try again later');
    }
    const bought = await client.incomingPhoneNumbers.create({
      phoneNumber: available[0].phoneNumber,
      friendlyName: `LingoLine personal — ${params.workspaceId}`,
    });
    purchasedSid = bought.sid;
    purchasedNumber = bought.phoneNumber;

    await configureTwilioInboundWebhook(params.workspaceId, purchasedSid, true);

    const [row] = await db.insert(telephonyConnections).values({
      workspace_id: params.workspaceId,
      provider: 'twilio',
      phone_number: purchasedNumber,
      friendly_name: 'Personal number',
      twilio_sid: purchasedSid,
      inbound_enabled: true,
      outbound_enabled: false,
      ai_answering_enabled: true,
      is_personal: true,
      monthly_price_usd: price.toFixed(2),
      purchased_at: sql`now()`,
      next_renewal_at: sql`now() + interval '1 month'`,
      auto_renew: true,
      status: 'active',
    }).returning();

    // Audit is non-critical: a failure here must NOT trigger the unwind —
    // the row is already live and the number is paid for.
    writeAuditLog({
      workspaceId: params.workspaceId,
      userId: params.userId,
      action: 'personal_number.purchased',
      resourceType: 'telephony_connection',
      resourceId: row.id,
      changes: { phone_number: purchasedNumber, monthly_price_usd: price },
    }).catch(() => {});

    return toPersonalNumber(row);
  } catch (err) {
    // Unwind: release the Twilio number if bought, refund the first month.
    if (purchasedSid) {
      await client.incomingPhoneNumbers(purchasedSid).remove().catch(() => {});
    }
    await refund();
    // Unique-index violation = concurrent purchase race. drizzle 0.45 wraps
    // pg errors in DrizzleQueryError; the pg code lives on .cause.
    if (((err as { cause?: { code?: string } }).cause?.code ?? (err as { code?: string }).code) === '23505') {
      throw new ConflictError('You already have a personal number');
    }
    throw err;
  }
}

export async function setAutoRenew(params: {
  workspaceId: string;
  userId: string;
  autoRenew: boolean;
}): Promise<PersonalNumber> {
  const [row] = await db.update(telephonyConnections)
    .set({ auto_renew: params.autoRenew, updated_at: new Date() })
    .where(and(
      eq(telephonyConnections.workspace_id, params.workspaceId),
      eq(telephonyConnections.is_personal, true),
      eq(telephonyConnections.status, 'active'),
    ))
    .returning();
  if (!row) throw new ValidationError('No active personal number');

  await writeAuditLog({
    workspaceId: params.workspaceId,
    userId: params.userId,
    action: 'personal_number.auto_renew_changed',
    resourceType: 'telephony_connection',
    resourceId: row.id,
    changes: { auto_renew: params.autoRenew },
  });

  return toPersonalNumber(row);
}

export type ReleaseReason = 'user_request' | 'auto_renew_off' | 'renewal_insufficient_balance';

/**
 * Idempotent, Twilio-first release. A Twilio 404 (number already gone)
 * counts as success so a half-finished release self-heals on retry.
 */
export async function releasePersonalNumber(params: {
  workspaceId: string;
  userId?: string;
  reason: ReleaseReason;
}): Promise<void> {
  const [row] = await db.select().from(telephonyConnections)
    .where(and(
      eq(telephonyConnections.workspace_id, params.workspaceId),
      eq(telephonyConnections.is_personal, true),
      eq(telephonyConnections.status, 'active'),
    ))
    .limit(1);
  if (!row) return;

  if (row.twilio_sid) {
    const client = await getTwilioClient(params.workspaceId);
    try {
      await client.incomingPhoneNumbers(row.twilio_sid).remove();
    } catch (err) {
      const status = (err as { status?: number; code?: number }).status;
      const code = (err as { status?: number; code?: number }).code;
      if (status !== 404 && code !== 20404) throw err; // row stays active, sweep retries
    }
  }

  await db.update(telephonyConnections)
    .set({ status: 'released', released_at: new Date(), ai_answering_enabled: false, updated_at: new Date() })
    .where(and(eq(telephonyConnections.id, row.id), eq(telephonyConnections.status, 'active')));

  await writeAuditLog({
    workspaceId: params.workspaceId,
    userId: params.userId,
    action: 'personal_number.released',
    resourceType: 'telephony_connection',
    resourceId: row.id,
    changes: { phone_number: row.phone_number, reason: params.reason },
  });
}

let sweeping = false;

/**
 * Hourly renewal sweep. Idempotent and restart-safe: all state lives in
 * Postgres (next_renewal_at); the debit + date bump commit in one
 * transaction, so a crash can neither double-charge nor charge-without-bump.
 * No grace period: insufficient balance or auto_renew=false on the renewal
 * date → release the number.
 */
export async function runRenewalSweep(): Promise<{ checked: number; renewed: number; released: number }> {
  if (sweeping) return { checked: 0, renewed: 0, released: 0 };
  sweeping = true;
  let renewed = 0, released = 0, checked = 0;
  try {
    const due = await db.select().from(telephonyConnections)
      .where(and(
        eq(telephonyConnections.is_personal, true),
        eq(telephonyConnections.status, 'active'),
        lte(telephonyConnections.next_renewal_at, new Date()),
      ));
    checked = due.length;

    const { getAdminWorkspaceId } = await import('./credential-resolver.service.js');
    const adminWs = await getAdminWorkspaceId().catch(() => null);

    for (const row of due) {
      try {
        if (!row.auto_renew) {
          await releasePersonalNumber({ workspaceId: row.workspace_id, reason: 'auto_renew_off' });
          released++;
          continue;
        }

        // The platform admin's own number is never charged.
        if (adminWs && row.workspace_id === adminWs) {
          await db.update(telephonyConnections)
            .set({ next_renewal_at: sql`next_renewal_at + interval '1 month'`, updated_at: new Date() })
            .where(eq(telephonyConnections.id, row.id));
          renewed++;
          continue;
        }

        const price = await getPersonalNumberPrice();
        const ok = await db.transaction(async (tx) => {
          const debit = await debitBalance({
            workspaceId: row.workspace_id,
            amountUsd: price,
            type: 'number_rental',
            description: `Personal number ${row.phone_number} — monthly renewal`,
            referenceType: 'telephony_connection',
            referenceId: row.id,
          }, tx);
          if (!debit.success) return false;
          await tx.update(telephonyConnections)
            .set({
              next_renewal_at: sql`next_renewal_at + interval '1 month'`,
              monthly_price_usd: price.toFixed(2),
              updated_at: new Date(),
            })
            .where(eq(telephonyConnections.id, row.id));
          return true;
        });

        if (ok) {
          renewed++;
          await writeAuditLog({
            workspaceId: row.workspace_id,
            action: 'personal_number.renewed',
            resourceType: 'telephony_connection',
            resourceId: row.id,
            changes: { phone_number: row.phone_number, amount_usd: price },
          });
        } else {
          await releasePersonalNumber({ workspaceId: row.workspace_id, reason: 'renewal_insufficient_balance' });
          released++;
        }
      } catch (err) {
        // One bad row must not kill the sweep; it retries next hour.
        console.error('Personal number renewal failed', { connectionId: row.id, err });
      }
    }
  } finally {
    sweeping = false;
  }
  return { checked, renewed, released };
}
