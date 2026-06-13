import crypto from 'node:crypto';
import https from 'node:https';
import { lookup as dnsLookup } from 'node:dns';
import { eq, and } from 'drizzle-orm';
import { db } from '../config/db.js';
import { webhookEndpoints } from '../db/schema.js';
import { addressIsPrivateOrReserved } from '../lib/url-validation.js';
import pino from 'pino';

const logger = pino({ name: 'webhook-service' });

export type WebhookEventType =
  | 'call.started'
  | 'call.completed'
  | 'call.failed'
  | 'session.summary_ready';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface WebhookEndpoint {
  id: string;
  workspace_id: string;
  url: string;
  events: string[];
  secret: string | null;
  is_active: boolean;
}

/**
 * Signs a webhook payload with HMAC-SHA256.
 */
function signPayload(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * DNS lookup for outbound webhook delivery that resolves the host ONCE, rejects
 * if any resolved address is private/reserved, and pins the connection to the
 * validated IP. Because https.request connects to exactly the address this
 * returns (no second resolution), it closes the check-then-connect DNS-rebinding
 * window. TLS SNI/cert validation still uses the original hostname.
 */
function pinnedPublicLookup(
  hostname: string,
  options: { family?: number; all?: boolean } | number,
  callback: (err: Error | null, address?: string | { address: string; family: number }[], family?: number) => void,
): void {
  const opts = typeof options === 'number' ? { family: options } : (options || {});
  dnsLookup(hostname, { all: true, family: opts.family || 0 }, (err, addresses) => {
    if (err) return callback(err);
    const list = Array.isArray(addresses) ? addresses : [];
    if (!list.length) return callback(new Error('Host did not resolve'));
    for (const a of list) {
      if (addressIsPrivateOrReserved(a.address, a.family)) {
        return callback(new Error('Blocked outbound request to private/reserved address'));
      }
    }
    if (opts.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

/**
 * Sends a single webhook request with retries and exponential backoff.
 */
async function sendWithRetry(
  url: string,
  body: string,
  signature: string | null,
  attempt = 1,
): Promise<boolean> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'LingoLine-Webhook/1.0',
  };
  if (signature) {
    headers['X-Webhook-Signature'] = signature;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      logger.warn({ url, attempt }, 'Webhook delivery blocked — non-https URL');
      return false;
    }

    const payload = Buffer.from(body, 'utf8');
    // node:https does NOT follow redirects, so a 3xx Location to an internal
    // host can't bypass the lookup guard. pinnedPublicLookup resolves+validates
    // once and pins the connection IP, closing the DNS-rebinding TOCTOU.
    const status = await new Promise<number>((resolve, reject) => {
      const req = https.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || 443,
          path: `${parsed.pathname}${parsed.search}`,
          method: 'POST',
          headers: { ...headers, 'Content-Length': payload.length },
          lookup: pinnedPublicLookup as never,
          timeout: 10_000,
        },
        (res) => {
          res.resume(); // drain & discard the response body
          resolve(res.statusCode || 0);
        },
      );
      req.on('timeout', () => req.destroy(new Error('Webhook request timed out')));
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    if (status >= 200 && status < 300) {
      return true;
    }

    if (status >= 300 && status < 400) {
      logger.warn({ url, status, attempt }, 'Webhook delivery blocked — redirect not followed');
      return false;
    }

    logger.warn({ url, status, attempt }, 'Webhook delivery failed with status');
  } catch (err) {
    logger.warn({ url, err, attempt }, 'Webhook delivery request error');
  }

  if (attempt < MAX_RETRIES) {
    const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return sendWithRetry(url, body, signature, attempt + 1);
  }

  return false;
}

/**
 * Delivers a webhook event to all active endpoints in the workspace
 * that are subscribed to the given event type.
 */
export async function deliverWebhookEvent(
  workspaceId: string,
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
  endpointId?: string,
): Promise<void> {
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(
      endpointId
        // Targeted test delivery: just this endpoint (active or not).
        ? and(eq(webhookEndpoints.workspace_id, workspaceId), eq(webhookEndpoints.id, endpointId))
        : and(eq(webhookEndpoints.workspace_id, workspaceId), eq(webhookEndpoints.is_active, true)),
    ) as unknown as WebhookEndpoint[];

  // For broadcasts, filter to endpoints subscribed to this event type.
  // For a targeted test (endpointId set), deliver regardless of subscription.
  const matched = endpointId ? endpoints : endpoints.filter((ep) => ep.events.includes(eventType));

  if (matched.length === 0) return;

  const envelope = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data: payload,
  };
  const body = JSON.stringify(envelope);

  const deliveries = matched.map(async (ep) => {
    const signature = ep.secret ? signPayload(body, ep.secret) : null;
    const success = await sendWithRetry(ep.url, body, signature);

    if (!success) {
      logger.error(
        { endpointId: ep.id, url: ep.url, eventType },
        'Webhook delivery failed after all retries',
      );
    }
  });

  // Fire-and-forget: don't block the caller
  await Promise.allSettled(deliveries);
}

// ============================================================
// CRUD helpers (used by the route)
// ============================================================

export async function listEndpoints(workspaceId: string) {
  return db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.workspace_id, workspaceId));
}

export async function createEndpoint(workspaceId: string, data: {
  url: string;
  events: string[];
  secret?: string;
}) {
  const secret = data.secret ?? crypto.randomBytes(32).toString('hex');
  const [created] = await db
    .insert(webhookEndpoints)
    .values({
      workspace_id: workspaceId,
      url: data.url,
      events: data.events,
      secret,
      is_active: true,
    })
    .returning();

  return created;
}

export async function updateEndpoint(workspaceId: string, id: string, data: {
  url?: string;
  events?: string[];
  secret?: string;
  is_active?: boolean;
}) {
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (data.url !== undefined) updates.url = data.url;
  if (data.events !== undefined) updates.events = data.events;
  if (data.secret !== undefined) updates.secret = data.secret;
  if (data.is_active !== undefined) updates.is_active = data.is_active;

  const [updated] = await db
    .update(webhookEndpoints)
    .set(updates)
    .where(
      and(
        eq(webhookEndpoints.id, id),
        eq(webhookEndpoints.workspace_id, workspaceId),
      ),
    )
    .returning();

  return updated ?? null;
}

export async function deleteEndpoint(workspaceId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.id, id),
        eq(webhookEndpoints.workspace_id, workspaceId),
      ),
    )
    .returning();

  return result.length > 0;
}

export async function getEndpoint(workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.id, id),
        eq(webhookEndpoints.workspace_id, workspaceId),
      ),
    );

  return row ?? null;
}
