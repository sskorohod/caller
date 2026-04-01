import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../config/db.js';
import { webhookEndpoints } from '../db/schema.js';
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
    'User-Agent': 'Caller-Webhook/1.0',
  };
  if (signature) {
    headers['X-Webhook-Signature'] = signature;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      return true;
    }

    logger.warn({ url, status: response.status, attempt }, 'Webhook delivery failed with status');
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
): Promise<void> {
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.workspace_id, workspaceId),
        eq(webhookEndpoints.is_active, true),
      ),
    ) as unknown as WebhookEndpoint[];

  // Filter to endpoints subscribed to this event type
  const matched = endpoints.filter((ep) => ep.events.includes(eventType));

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
