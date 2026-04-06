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
