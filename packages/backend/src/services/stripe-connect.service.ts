import crypto from 'crypto';
import pino from 'pino';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';

const log = pino({ name: 'stripe-connect' });

const STATE_PREFIX = 'stripe_oauth_state:';
const STATE_TTL = 600; // 10 minutes

export function isStripeConnectConfigured(): boolean {
  return !!(env.STRIPE_CONNECT_CLIENT_ID && env.STRIPE_CONNECT_SECRET);
}

export async function generateAuthorizationUrl(workspaceId: string, redirectUri: string): Promise<{ url: string }> {
  if (!isStripeConnectConfigured()) throw new Error('Stripe Connect not configured');

  const state = crypto.randomBytes(32).toString('hex');
  await redis.set(`${STATE_PREFIX}${state}`, workspaceId, 'EX', STATE_TTL);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.STRIPE_CONNECT_CLIENT_ID,
    scope: 'read_write',
    redirect_uri: redirectUri,
    state,
  });

  return { url: `https://connect.stripe.com/oauth/authorize?${params}` };
}

export async function validateState(state: string): Promise<string | null> {
  const key = `${STATE_PREFIX}${state}`;
  const workspaceId = await redis.get(key);
  if (!workspaceId) return null;
  await redis.del(key);
  return workspaceId;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  stripe_user_id: string;
  livemode: boolean;
}> {
  const res = await fetch('https://connect.stripe.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_secret: env.STRIPE_CONNECT_SECRET,
    }).toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    log.error({ error: data }, 'Stripe token exchange failed');
    throw new Error(data.error_description ?? `Stripe error ${res.status}`);
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? '',
    stripe_user_id: data.stripe_user_id,
    livemode: data.livemode ?? false,
  };
}

export async function fetchAccountInfo(accessToken: string): Promise<{
  id: string;
  business_name: string | null;
  email: string | null;
}> {
  const res = await fetch('https://api.stripe.com/v1/account', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe error ${res.status}`);

  return {
    id: data.id,
    business_name: data.business_profile?.name ?? data.settings?.dashboard?.display_name ?? null,
    email: data.email ?? null,
  };
}

export async function disconnectAccount(stripeUserId: string): Promise<void> {
  const res = await fetch('https://connect.stripe.com/oauth/deauthorize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${env.STRIPE_CONNECT_SECRET}`,
    },
    body: new URLSearchParams({
      client_id: env.STRIPE_CONNECT_CLIENT_ID,
      stripe_user_id: stripeUserId,
    }).toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    log.warn({ error: data, stripeUserId }, 'Stripe disconnect failed');
  }
}
