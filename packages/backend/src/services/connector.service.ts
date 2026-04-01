import { eq, and } from 'drizzle-orm';
import { db } from '../config/db.js';
import { dataConnectors } from '../db/schema.js';
import pino from 'pino';

const logger = pino({ name: 'connector-service' });

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HttpActionConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  headers?: Record<string, string>;
  body_template?: string;
}

export interface HttpConnectorConfig {
  base_url: string;
  auth_type: 'bearer' | 'basic' | 'header';
  auth_value: string;
  auth_header?: string;
  actions: Record<string, HttpActionConfig>;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function listConnectors(workspaceId: string) {
  return db
    .select()
    .from(dataConnectors)
    .where(eq(dataConnectors.workspace_id, workspaceId));
}

export async function getConnector(workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(dataConnectors)
    .where(
      and(
        eq(dataConnectors.id, id),
        eq(dataConnectors.workspace_id, workspaceId),
      ),
    );
  return row ?? null;
}

export async function createConnector(workspaceId: string, data: {
  name: string;
  connector_type: string;
  config: Record<string, unknown>;
}) {
  const [created] = await db
    .insert(dataConnectors)
    .values({
      workspace_id: workspaceId,
      name: data.name,
      connector_type: data.connector_type,
      config: data.config,
      is_active: true,
    })
    .returning();

  return created;
}

export async function updateConnector(workspaceId: string, id: string, data: {
  name?: string;
  connector_type?: string;
  config?: Record<string, unknown>;
  is_active?: boolean;
}) {
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.connector_type !== undefined) updates.connector_type = data.connector_type;
  if (data.config !== undefined) updates.config = data.config;
  if (data.is_active !== undefined) updates.is_active = data.is_active;

  const [updated] = await db
    .update(dataConnectors)
    .set(updates)
    .where(
      and(
        eq(dataConnectors.id, id),
        eq(dataConnectors.workspace_id, workspaceId),
      ),
    )
    .returning();

  return updated ?? null;
}

export async function deleteConnector(workspaceId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(dataConnectors)
    .where(
      and(
        eq(dataConnectors.id, id),
        eq(dataConnectors.workspace_id, workspaceId),
      ),
    )
    .returning();

  return result.length > 0;
}

// ─── Test Connection ─────────────────────────────────────────────────────────

export async function testConnection(workspaceId: string, id: string): Promise<{ success: boolean; status?: number; error?: string }> {
  const connector = await getConnector(workspaceId, id);
  if (!connector) return { success: false, error: 'Connector not found' };

  if (connector.connector_type !== 'http') {
    return { success: false, error: `Unsupported connector type: ${connector.connector_type}` };
  }

  const config = connector.config as unknown as HttpConnectorConfig;
  const headers: Record<string, string> = { 'User-Agent': 'Caller-Connector/1.0' };

  if (config.auth_type === 'bearer') {
    headers['Authorization'] = `Bearer ${config.auth_value}`;
  } else if (config.auth_type === 'basic') {
    headers['Authorization'] = `Basic ${Buffer.from(config.auth_value).toString('base64')}`;
  } else if (config.auth_type === 'header') {
    headers[config.auth_header ?? 'X-Api-Key'] = config.auth_value;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(config.base_url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Update last_synced_at on successful test
    if (response.ok) {
      await db
        .update(dataConnectors)
        .set({ last_synced_at: new Date(), updated_at: new Date() })
        .where(
          and(
            eq(dataConnectors.id, id),
            eq(dataConnectors.workspace_id, workspaceId),
          ),
        );
    }

    return { success: response.ok, status: response.status };
  } catch (err) {
    logger.warn({ connectorId: id, err }, 'Connection test failed');
    return { success: false, error: (err as Error).message };
  }
}

// ─── Execute Action ──────────────────────────────────────────────────────────

function resolveTemplate(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = payload[key];
    return value !== undefined ? String(value) : '';
  });
}

export async function executeConnectorAction(
  workspaceId: string,
  connectorId: string,
  action: string,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; status?: number; data?: unknown; error?: string }> {
  const connector = await getConnector(workspaceId, connectorId);
  if (!connector) return { success: false, error: 'Connector not found' };

  if (connector.connector_type !== 'http') {
    return { success: false, error: `Unsupported connector type: ${connector.connector_type}` };
  }

  const config = connector.config as unknown as HttpConnectorConfig;
  const actionConfig = config.actions?.[action];
  if (!actionConfig) {
    return { success: false, error: `Action '${action}' not found in connector config` };
  }

  const url = `${config.base_url.replace(/\/$/, '')}${actionConfig.path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Caller-Connector/1.0',
    ...actionConfig.headers,
  };

  if (config.auth_type === 'bearer') {
    headers['Authorization'] = `Bearer ${config.auth_value}`;
  } else if (config.auth_type === 'basic') {
    headers['Authorization'] = `Basic ${Buffer.from(config.auth_value).toString('base64')}`;
  } else if (config.auth_type === 'header') {
    headers[config.auth_header ?? 'X-Api-Key'] = config.auth_value;
  }

  let body: string | undefined;
  if (actionConfig.body_template) {
    body = resolveTemplate(actionConfig.body_template, payload);
  } else if (actionConfig.method !== 'GET' && Object.keys(payload).length > 0) {
    body = JSON.stringify(payload);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch(url, {
      method: actionConfig.method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Update last_synced_at
    await db
      .update(dataConnectors)
      .set({ last_synced_at: new Date(), updated_at: new Date() })
      .where(
        and(
          eq(dataConnectors.id, connectorId),
          eq(dataConnectors.workspace_id, workspaceId),
        ),
      );

    const contentType = response.headers.get('content-type') ?? '';
    let data: unknown;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return { success: response.ok, status: response.status, data };
  } catch (err) {
    logger.error({ connectorId, action, err }, 'Connector action execution failed');
    return { success: false, error: (err as Error).message };
  }
}
