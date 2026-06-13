import pino from 'pino';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import { translatorSubscribers, workspaces, platformSettings } from '../db/schema.js';
import { getProviderCredential } from './provider.service.js';
import type { WorkspacePlan } from '../models/types.js';

const log = pino({ name: 'stripe' });

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

// ============================================================
// STRIPE API HELPERS
// ============================================================

async function getStripeKey(workspaceId?: string): Promise<string> {
  if (workspaceId) {
    try {
      const creds = await getProviderCredential(workspaceId, 'stripe');
      if (creds.access_token) return creds.access_token;
      if (creds.secret_key) return creds.secret_key;
    } catch { /* fallback to env */ }
  }
  if (STRIPE_SECRET_KEY) return STRIPE_SECRET_KEY;
  throw new Error('Stripe not configured');
}

/**
 * The workspace that holds the platform's Stripe credentials (set by the admin
 * when they enter Stripe keys in the admin panel). All client payments flow
 * into this ONE business account.
 */
async function getPlatformStripeWorkspaceId(): Promise<string | null> {
  try {
    const [row] = await db.select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, 'platform_stripe_workspace_id'))
      .limit(1);
    if (!row || row.value == null) return null;
    return typeof row.value === 'string' ? row.value : String(row.value);
  } catch {
    return null;
  }
}

/**
 * Resolve the PLATFORM Stripe secret key — the single business account that
 * receives all client payments. Admin-entered key (platform workspace's
 * provider_credentials) takes priority; falls back to env STRIPE_SECRET_KEY.
 */
export async function getPlatformStripeKey(): Promise<string> {
  const wsId = await getPlatformStripeWorkspaceId();
  if (wsId) {
    try {
      const creds = await getProviderCredential(wsId, 'stripe');
      if (creds.secret_key) return creds.secret_key;
      if (creds.access_token) return creds.access_token;
    } catch { /* fall through to env */ }
  }
  if (STRIPE_SECRET_KEY) return STRIPE_SECRET_KEY;
  throw new Error('Stripe not configured');
}

/** Resolve the platform webhook signing secret (panel-entered, else env). */
export async function getPlatformWebhookSecret(): Promise<string> {
  const wsId = await getPlatformStripeWorkspaceId();
  if (wsId) {
    try {
      const creds = await getProviderCredential(wsId, 'stripe');
      if (creds.webhook_secret) return creds.webhook_secret;
    } catch { /* fall through to env */ }
  }
  return STRIPE_WEBHOOK_SECRET;
}

/** True if a platform Stripe account (panel or env) is configured. */
export async function isPlatformStripeConfigured(): Promise<boolean> {
  try {
    await getPlatformStripeKey();
    return true;
  } catch {
    return false;
  }
}

async function stripeRequest(path: string, method: string, body?: Record<string, string>, secretKey?: string): Promise<any> {
  const key = secretKey ?? STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe error ${res.status}`);
  return data;
}

export function isStripeConfigured(): boolean {
  return !!STRIPE_SECRET_KEY;
}

// ============================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================

/**
 * Verify Stripe webhook signature with replay protection.
 */
export function verifyWebhookSignature(payload: string, signature: string, secret?: string): boolean {
  const webhookSecret = secret || STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return false;
  const parts = signature.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts['t'];
  const v1 = parts['v1'];
  if (!timestamp || !v1) return false;

  // Replay protection: reject events older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    log.warn({ timestamp, now }, 'Stripe webhook timestamp too old, rejecting');
    return false;
  }

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  // timingSafeEqual throws if the buffers differ in length, and v1 comes from a
  // client-controlled header — guard the length first.
  const v1Buf = Buffer.from(v1);
  const expectedBuf = Buffer.from(expected);
  return v1Buf.length === expectedBuf.length && crypto.timingSafeEqual(v1Buf, expectedBuf);
}

// ============================================================
// PLAN ↔ PRICE ID MAPPING
// ============================================================

function planFromPriceId(priceId: string): WorkspacePlan | null {
  if (process.env.STRIPE_AGENTS_PRICE_ID && priceId === process.env.STRIPE_AGENTS_PRICE_ID) return 'agents';
  if (process.env.STRIPE_AGENTS_MCP_PRICE_ID && priceId === process.env.STRIPE_AGENTS_MCP_PRICE_ID) return 'agents_mcp';
  return null;
}

// NOTE: the legacy "translator minutes" checkout (createCheckoutSession /
// handleCheckoutCompleted) was removed — its producer endpoint
// (POST /api/translator/checkout) is gone and balance_minutes was never spent.
// Removing the non-idempotent minutes-credit handler also closes a latent
// double-credit-on-retry path. Deposits/subscriptions are the live flows.

// ============================================================
// DEPOSIT CHECKOUT (workspace-level USD deposit)
// ============================================================

/**
 * Create a Stripe Checkout session for workspace USD deposit top-up.
 */
export async function createDepositCheckout(params: {
  workspaceId: string;
  amountUsd: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string }> {
  // All client payments flow into the ONE platform Stripe account.
  const key = await getPlatformStripeKey();

  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, params.workspaceId));
  if (!ws) throw new Error('Workspace not found');

  const createCustomer = async (): Promise<string> => {
    const customer = await stripeRequest('/customers', 'POST', {
      name: ws.name,
      'metadata[workspace_id]': ws.id,
    }, key);
    await db.update(workspaces)
      .set({ stripe_customer_id: customer.id })
      .where(eq(workspaces.id, ws.id));
    return customer.id as string;
  };

  let customerId = ws.stripe_customer_id || (await createCustomer());
  const amountCents = Math.round(params.amountUsd * 100);

  const buildBody = (customer: string): Record<string, string> => ({
    customer,
    mode: 'payment',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(amountCents),
    'line_items[0][price_data][product_data][name]': `Deposit $${params.amountUsd.toFixed(2)}`,
    'line_items[0][price_data][product_data][description]': 'Platform deposit top-up',
    'line_items[0][quantity]': '1',
    'metadata[workspace_id]': params.workspaceId,
    'metadata[type]': 'deposit',
    'metadata[amount_usd]': String(params.amountUsd),
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  let session;
  try {
    session = await stripeRequest('/checkout/sessions', 'POST', buildBody(customerId), key);
  } catch (err) {
    // Stale stripe_customer_id (created against a different account) — recreate once.
    if (String((err as Error).message).toLowerCase().includes('no such customer')) {
      customerId = await createCustomer();
      session = await stripeRequest('/checkout/sessions', 'POST', buildBody(customerId), key);
    } else {
      throw err;
    }
  }

  return { url: session.url, sessionId: session.id };
}

/**
 * Handle deposit checkout completed — add USD to workspace balance.
 */
export async function handleDepositCheckoutCompleted(session: any): Promise<void> {
  const workspaceId = session.metadata?.workspace_id;
  const amountUsd = parseFloat(session.metadata?.amount_usd ?? '0');

  if (!workspaceId || !amountUsd) {
    log.warn({ session: session.id }, 'Deposit checkout completed but missing metadata');
    return;
  }

  const { creditDeposit } = await import('./billing.service.js');
  await creditDeposit({
    workspaceId,
    amountUsd,
    type: 'topup',
    description: `Stripe deposit: $${amountUsd.toFixed(2)}`,
    referenceType: 'stripe_checkout',
    referenceId: session.id,
  });

  log.info({ workspaceId, amountUsd, sessionId: session.id }, 'Deposit added from Stripe checkout');
}

/**
 * Refund a Stripe Checkout deposit. Resolves the underlying payment_intent
 * from the checkout session, then creates a refund. Amount in USD; omit for
 * a full refund.
 */
export async function refundDepositCheckout(params: {
  workspaceId: string;
  checkoutSessionId: string;
  amountUsd?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}): Promise<{ refundId: string; amountUsd: number; status: string }> {
  // Refund must run against the platform account that processed the charge.
  const key = await getPlatformStripeKey();
  const session = await stripeRequest(`/checkout/sessions/${params.checkoutSessionId}`, 'GET', undefined, key);
  const paymentIntent = session.payment_intent;
  if (!paymentIntent) throw new Error('Checkout session has no payment_intent (not paid?)');

  const body: Record<string, string> = { payment_intent: String(paymentIntent) };
  if (params.amountUsd != null) body.amount = String(Math.round(params.amountUsd * 100));
  if (params.reason) body.reason = params.reason;

  const refund = await stripeRequest('/refunds', 'POST', body, key);
  return {
    refundId: refund.id,
    amountUsd: refund.amount / 100,
    status: refund.status,
  };
}

// ============================================================
// SUBSCRIPTIONS
// ============================================================

/**
 * Create Stripe subscription checkout for workspace.
 * NOTE: Plan is NOT changed here — it's updated only after webhook confirms payment.
 */
export async function createSubscription(params: {
  workspaceId: string;
  priceId: string;
  plan: string;
  trialDays: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string }> {
  const key = await getStripeKey(params.workspaceId);

  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, params.workspaceId));
  if (!ws) throw new Error('Workspace not found');

  let customerId = ws.stripe_customer_id;
  if (!customerId) {
    const customer = await stripeRequest('/customers', 'POST', {
      name: ws.name,
      'metadata[workspace_id]': ws.id,
    }, key);
    customerId = customer.id;
    await db.update(workspaces)
      .set({ stripe_customer_id: customerId })
      .where(eq(workspaces.id, ws.id));
  }

  const session = await stripeRequest('/checkout/sessions', 'POST', {
    customer: customerId!,
    mode: 'subscription',
    'line_items[0][price]': params.priceId,
    'line_items[0][quantity]': '1',
    'metadata[workspace_id]': params.workspaceId,
    'metadata[type]': 'subscription',
    'metadata[intended_plan]': params.plan,
    ...(params.trialDays > 0 ? { 'subscription_data[trial_period_days]': String(params.trialDays) } : {}),
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  }, key);

  return { url: session.url, sessionId: session.id };
}

/**
 * Handle subscription checkout completed — upgrade plan after payment confirmed.
 */
export async function handleSubscriptionCheckoutCompleted(session: any): Promise<void> {
  const workspaceId = session.metadata?.workspace_id;
  const intendedPlan = session.metadata?.intended_plan as WorkspacePlan | undefined;

  if (!workspaceId) {
    log.warn({ session: session.id }, 'Subscription checkout completed but missing workspace_id');
    return;
  }

  const subscriptionId = session.subscription;
  const updates: Record<string, any> = {
    subscription_status: 'active',
    updated_at: new Date(),
  };

  if (subscriptionId) {
    updates.stripe_subscription_id = subscriptionId;
  }

  if (intendedPlan && ['agents', 'agents_mcp'].includes(intendedPlan)) {
    updates.plan = intendedPlan;
  }

  await db.update(workspaces).set(updates).where(eq(workspaces.id, workspaceId));
  log.info({ workspaceId, plan: intendedPlan, subscriptionId }, 'Subscription activated from checkout');
}

/**
 * Cancel workspace subscription at period end.
 */
export async function cancelSubscription(workspaceId: string): Promise<void> {
  const key = await getStripeKey(workspaceId);
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  if (!ws?.stripe_subscription_id) throw new Error('No active subscription');

  await stripeRequest(`/subscriptions/${ws.stripe_subscription_id}`, 'POST', {
    cancel_at_period_end: 'true',
  }, key);

  await db.update(workspaces).set({
    subscription_status: 'canceled',
    updated_at: new Date(),
  }).where(eq(workspaces.id, workspaceId));

  log.info({ workspaceId }, 'Subscription scheduled for cancellation');
}

/**
 * Handle subscription webhook events (created, updated, deleted).
 */
export async function handleSubscriptionEvent(event: any): Promise<void> {
  const subscription = event.data?.object;
  if (!subscription) return;

  const customerId = subscription.customer;

  // Find workspace by stripe_customer_id
  const [ws] = await db.select().from(workspaces)
    .where(eq(workspaces.stripe_customer_id, customerId));
  if (!ws) {
    log.warn({ customerId }, 'Subscription event for unknown customer');
    return;
  }

  const updates: Record<string, any> = {
    stripe_subscription_id: subscription.id,
    updated_at: new Date(),
  };

  if (event.type === 'customer.subscription.deleted') {
    // Subscription ended — downgrade to free plan
    updates.subscription_status = 'none';
    updates.stripe_subscription_id = null;
    updates.subscription_current_period_end = null;
    updates.plan = 'translator';
    log.info({ workspaceId: ws.id }, 'Subscription deleted — downgraded to translator plan');
  } else {
    // created or updated
    updates.subscription_status = subscription.status === 'active' ? 'active'
      : subscription.status === 'past_due' ? 'past_due'
      : subscription.cancel_at_period_end ? 'canceled'
      : subscription.status;

    if (subscription.current_period_end) {
      updates.subscription_current_period_end = new Date(subscription.current_period_end * 1000);
    }

    // Determine plan from subscription price
    const priceId = subscription.items?.data?.[0]?.price?.id;
    if (priceId) {
      const plan = planFromPriceId(priceId);
      if (plan) updates.plan = plan;
    }
  }

  await db.update(workspaces).set(updates).where(eq(workspaces.id, ws.id));
  log.info({ workspaceId: ws.id, status: updates.subscription_status, plan: updates.plan }, 'Subscription updated');
}

/**
 * Handle invoice events (paid, payment_failed).
 */
export async function handleInvoiceEvent(event: any): Promise<void> {
  const invoice = event.data?.object;
  if (!invoice) return;

  const customerId = invoice.customer;
  const [ws] = await db.select().from(workspaces)
    .where(eq(workspaces.stripe_customer_id, customerId));
  if (!ws) {
    log.warn({ customerId }, 'Invoice event for unknown customer');
    return;
  }

  if (event.type === 'invoice.payment_failed') {
    await db.update(workspaces).set({
      subscription_status: 'past_due',
      updated_at: new Date(),
    }).where(eq(workspaces.id, ws.id));
    log.warn({ workspaceId: ws.id, invoiceId: invoice.id }, 'Invoice payment failed — subscription past_due');
  } else if (event.type === 'invoice.paid') {
    // Renewal succeeded — ensure status is active
    if (ws.subscription_status !== 'active') {
      await db.update(workspaces).set({
        subscription_status: 'active',
        updated_at: new Date(),
      }).where(eq(workspaces.id, ws.id));
      log.info({ workspaceId: ws.id, invoiceId: invoice.id }, 'Invoice paid — subscription reactivated');
    }
  }
}

// ============================================================
// PLAN DOWNGRADE & REACTIVATION
// ============================================================

/**
 * Downgrade subscription to a lower plan (e.g. agents_mcp → agents).
 * Updates Stripe subscription in-place with proration.
 */
export async function downgradeSubscription(workspaceId: string, targetPlan: WorkspacePlan): Promise<void> {
  const key = await getStripeKey(workspaceId);
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  if (!ws?.stripe_subscription_id) throw new Error('No active subscription to downgrade');

  const targetPriceId = targetPlan === 'agents'
    ? process.env.STRIPE_AGENTS_PRICE_ID
    : process.env.STRIPE_AGENTS_MCP_PRICE_ID;
  if (!targetPriceId) throw new Error(`No Stripe price configured for plan ${targetPlan}`);

  // Fetch current subscription to get item ID
  const sub = await stripeRequest(`/subscriptions/${ws.stripe_subscription_id}`, 'GET', undefined, key);
  const itemId = sub.items?.data?.[0]?.id;
  if (!itemId) throw new Error('Cannot find subscription item');

  // Update subscription with new price + proration
  await stripeRequest(`/subscriptions/${ws.stripe_subscription_id}`, 'POST', {
    'items[0][id]': itemId,
    'items[0][price]': targetPriceId,
    proration_behavior: 'create_prorations',
    // Remove cancel_at_period_end if it was set
    cancel_at_period_end: 'false',
  }, key);

  // Update DB immediately (webhook will also confirm)
  await db.update(workspaces).set({
    plan: targetPlan,
    subscription_status: 'active',
    updated_at: new Date(),
  }).where(eq(workspaces.id, workspaceId));

  log.info({ workspaceId, targetPlan }, 'Subscription downgraded');
}

/**
 * Reactivate a subscription that was scheduled for cancellation.
 */
export async function reactivateSubscription(workspaceId: string): Promise<void> {
  const key = await getStripeKey(workspaceId);
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  if (!ws?.stripe_subscription_id) throw new Error('No subscription to reactivate');

  await stripeRequest(`/subscriptions/${ws.stripe_subscription_id}`, 'POST', {
    cancel_at_period_end: 'false',
  }, key);

  await db.update(workspaces).set({
    subscription_status: 'active',
    updated_at: new Date(),
  }).where(eq(workspaces.id, workspaceId));

  log.info({ workspaceId }, 'Subscription reactivated');
}

/**
 * Get a preview of what a downgrade would look like (proration + resource warnings).
 */
export async function getDowngradePreview(workspaceId: string, targetPlan: WorkspacePlan): Promise<{
  current_plan: string;
  target_plan: string;
  proration_credit_usd: number;
  new_monthly_usd: number;
  resource_warnings: {
    agents: { current: number; new_limit: number; over: boolean };
    connections: { current: number; new_limit: number; over: boolean };
  };
}> {
  const { PLANS } = await import('../config/plans.js');
  const { getResourceCounts } = await import('./resource-limits.service.js');

  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  const currentPlan = (ws?.plan || 'translator') as WorkspacePlan;
  const targetConfig = PLANS[targetPlan];

  // Get resource counts
  const counts = await getResourceCounts(workspaceId);
  const agentLimit = targetConfig.features.maxAgentProfiles;
  const connLimit = targetConfig.features.maxTelephonyConnections;

  // Try to get proration preview from Stripe
  let prorationCredit = 0;
  if (ws?.stripe_subscription_id && targetPlan !== 'translator') {
    try {
      const key = await getStripeKey(workspaceId);
      const sub = await stripeRequest(`/subscriptions/${ws.stripe_subscription_id}`, 'GET', undefined, key);
      const itemId = sub.items?.data?.[0]?.id;
      const targetPriceId = targetPlan === 'agents'
        ? process.env.STRIPE_AGENTS_PRICE_ID
        : process.env.STRIPE_AGENTS_MCP_PRICE_ID;

      if (itemId && targetPriceId) {
        // Use Stripe upcoming invoice to preview proration
        const preview = await stripeRequest('/invoices/upcoming', 'GET', undefined, key);
        // Estimate: difference between current and new plan for remaining days
        const currentPrice = sub.items?.data?.[0]?.price?.unit_amount ?? 0;
        const periodEnd = sub.current_period_end ?? 0;
        const now = Math.floor(Date.now() / 1000);
        const totalPeriod = (periodEnd - (sub.current_period_start ?? now)) || 1;
        const remaining = Math.max(0, periodEnd - now);
        const fraction = remaining / totalPeriod;
        prorationCredit = Math.round((currentPrice / 100) * fraction * 100) / 100;
      }
    } catch (err) {
      log.warn({ err, workspaceId }, 'Could not get proration preview');
    }
  }

  // Get the monthly price for target plan
  const newMonthly = targetPlan === 'translator' ? 0
    : targetPlan === 'agents' ? 49
    : 99;

  return {
    current_plan: currentPlan,
    target_plan: targetPlan,
    proration_credit_usd: prorationCredit,
    new_monthly_usd: newMonthly,
    resource_warnings: {
      agents: {
        current: counts.agentCount,
        new_limit: agentLimit,
        over: agentLimit !== -1 && counts.agentCount > agentLimit,
      },
      connections: {
        current: counts.connectionCount,
        new_limit: connLimit,
        over: connLimit !== -1 && counts.connectionCount > connLimit,
      },
    },
  };
}

// ============================================================
// CUSTOMER PORTAL
// ============================================================

/**
 * Create a Stripe Customer Portal session for managing payment methods & invoices.
 */
export async function createPortalSession(params: {
  workspaceId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const key = await getStripeKey(params.workspaceId);
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, params.workspaceId));
  if (!ws?.stripe_customer_id) throw new Error('No Stripe customer — make a purchase first');

  const session = await stripeRequest('/billing_portal/sessions', 'POST', {
    customer: ws.stripe_customer_id,
    return_url: params.returnUrl,
  }, key);

  return { url: session.url };
}
