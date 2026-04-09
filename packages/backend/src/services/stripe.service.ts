import pino from 'pino';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import { translatorSubscribers, workspaces } from '../db/schema.js';
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
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!STRIPE_WEBHOOK_SECRET) return false;
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
    .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}

// ============================================================
// PLAN ↔ PRICE ID MAPPING
// ============================================================

function planFromPriceId(priceId: string): WorkspacePlan | null {
  if (process.env.STRIPE_AGENTS_PRICE_ID && priceId === process.env.STRIPE_AGENTS_PRICE_ID) return 'agents';
  if (process.env.STRIPE_AGENTS_MCP_PRICE_ID && priceId === process.env.STRIPE_AGENTS_MCP_PRICE_ID) return 'agents_mcp';
  return null;
}

// ============================================================
// TRANSLATOR MINUTES CHECKOUT
// ============================================================

/**
 * Create a Stripe Checkout session for buying translator minutes.
 */
export async function createCheckoutSession(params: {
  subscriberId: string;
  minutes: number;
  pricePerMinute: number;
  successUrl: string;
  cancelUrl: string;
  workspaceId?: string;
}): Promise<{ url: string; sessionId: string }> {
  const key = await getStripeKey(params.workspaceId);

  const [sub] = await db.select().from(translatorSubscribers)
    .where(eq(translatorSubscribers.id, params.subscriberId));
  if (!sub) throw new Error('Subscriber not found');

  // Create or reuse Stripe customer
  let customerId = sub.stripe_customer_id;
  if (!customerId) {
    const customer = await stripeRequest('/customers', 'POST', {
      name: sub.name,
      phone: sub.phone_number,
      ...(sub.email ? { email: sub.email } : {}),
      'metadata[subscriber_id]': sub.id,
    }, key);
    customerId = customer.id;
    await db.update(translatorSubscribers)
      .set({ stripe_customer_id: customerId })
      .where(eq(translatorSubscribers.id, sub.id));
  }

  const totalCents = Math.round(params.minutes * params.pricePerMinute * 100);

  const session = await stripeRequest('/checkout/sessions', 'POST', {
    customer: customerId!,
    mode: 'payment',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(totalCents),
    'line_items[0][price_data][product_data][name]': `${params.minutes} Translator Minutes`,
    'line_items[0][price_data][product_data][description]': `Live translator service - ${params.minutes} minutes`,
    'line_items[0][quantity]': '1',
    'metadata[subscriber_id]': params.subscriberId,
    'metadata[minutes]': String(params.minutes),
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  }, key);

  return { url: session.url, sessionId: session.id };
}

/**
 * Handle checkout.session.completed — add minutes to subscriber balance.
 */
export async function handleCheckoutCompleted(session: any): Promise<void> {
  const subscriberId = session.metadata?.subscriber_id;
  const minutes = parseFloat(session.metadata?.minutes ?? '0');

  if (!subscriberId || !minutes) {
    log.warn({ session: session.id }, 'Checkout completed but missing metadata');
    return;
  }

  const { sql } = await import('drizzle-orm');
  await db.update(translatorSubscribers).set({
    balance_minutes: sql`${translatorSubscribers.balance_minutes} + ${minutes}`,
    updated_at: new Date(),
  }).where(eq(translatorSubscribers.id, subscriberId));

  log.info({ subscriberId, minutes, sessionId: session.id }, 'Minutes added from Stripe checkout');
}

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
  const key = await getStripeKey(params.workspaceId);

  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, params.workspaceId));
  if (!ws) throw new Error('Workspace not found');

  // Create or reuse Stripe customer for workspace
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

  const amountCents = Math.round(params.amountUsd * 100);

  const session = await stripeRequest('/checkout/sessions', 'POST', {
    customer: customerId!,
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
  }, key);

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
