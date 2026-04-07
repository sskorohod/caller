import pino from 'pino';
import { eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import { translatorSubscribers } from '../db/schema.js';
import { getProviderCredential } from './provider.service.js';

const log = pino({ name: 'stripe' });

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

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
 * Verify Stripe webhook signature (simplified — uses timing-safe comparison).
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

  const crypto = require('crypto');
  const expected = crypto
    .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
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

export function isStripeConfigured(): boolean {
  return !!STRIPE_SECRET_KEY;
}

// ============================================================
// DEPOSIT CHECKOUT (workspace-level USD deposit)
// ============================================================

import { workspaces } from '../db/schema.js';

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
 * Create Stripe subscription for workspace.
 */
export async function createSubscription(params: {
  workspaceId: string;
  priceId: string;
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
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  }, key);

  return { url: session.url, sessionId: session.id };
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
 * Handle subscription webhook events.
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
    subscription_status: subscription.status === 'active' ? 'active'
      : subscription.status === 'past_due' ? 'past_due'
      : subscription.cancel_at_period_end ? 'canceled'
      : subscription.status,
    updated_at: new Date(),
  };

  if (subscription.current_period_end) {
    updates.subscription_current_period_end = new Date(subscription.current_period_end * 1000);
  }

  await db.update(workspaces).set(updates).where(eq(workspaces.id, ws.id));
  log.info({ workspaceId: ws.id, status: updates.subscription_status }, 'Subscription updated');
}
