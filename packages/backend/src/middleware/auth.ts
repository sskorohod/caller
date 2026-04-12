import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../config/db.js';
import { workspaceMembers, apiKeys, workspaces } from '../db/schema.js';
import { verifyJWT } from '../lib/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import { verifyApiKey } from '../lib/crypto.js';
import type { WorkspacePlan, ProviderConfig } from '../models/types.js';

/** Check if a trialing workspace has expired and auto-downgrade */
async function checkTrialExpiry(workspaceId: string, subscriptionStatus: string, periodEnd: Date | null): Promise<WorkspacePlan | null> {
  if (subscriptionStatus !== 'trialing' || !periodEnd) return null;
  if (new Date() <= new Date(periodEnd)) return null;

  await db.update(workspaces).set({
    plan: 'translator',
    subscription_status: 'none',
    subscription_current_period_end: null,
    updated_at: new Date(),
  }).where(eq(workspaces.id, workspaceId));

  return 'translator';
}

export interface AuthContext {
  userId: string;
  workspaceId: string;
  role: 'owner' | 'admin' | 'operator' | 'analyst';
  authMethod: 'session' | 'api_key';
  plan: WorkspacePlan;
  balanceUsd: number;
  providerConfig: ProviderConfig;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

/** Authenticate dashboard users via JWT */
export async function authenticateUser(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new UnauthorizedError('Missing authorization token');

  let userId: string;
  try {
    const payload = await verifyJWT(token);
    userId = payload.sub;
  } catch {
    throw new UnauthorizedError('Invalid token');
  }

  const rows = await db.select({
    workspace_id: workspaceMembers.workspace_id,
    role: workspaceMembers.role,
    plan: workspaces.plan,
    balance_usd: workspaces.balance_usd,
    provider_config: workspaces.provider_config,
    subscription_status: workspaces.subscription_status,
    subscription_current_period_end: workspaces.subscription_current_period_end,
  })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspace_id))
    .where(eq(workspaceMembers.user_id, userId))
    .limit(1);

  if (!rows.length) throw new ForbiddenError('No workspace membership found');

  const row = rows[0];

  // Auto-downgrade expired trials
  const downgraded = await checkTrialExpiry(
    row.workspace_id,
    row.subscription_status || 'none',
    row.subscription_current_period_end,
  );

  request.auth = {
    userId,
    workspaceId: row.workspace_id,
    role: row.role as AuthContext['role'],
    authMethod: 'session',
    plan: downgraded || (row.plan as WorkspacePlan) || 'translator',
    balanceUsd: parseFloat(row.balance_usd as string) || 0,
    providerConfig: (row.provider_config as ProviderConfig) || {},
  };
}

/** Authenticate MCP clients via workspace API key */
export async function authenticateApiKey(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token || !token.startsWith('mcp_')) {
    throw new UnauthorizedError('Missing or invalid API key');
  }

  const prefix = token.slice(0, 12);

  const keys = await db.select()
    .from(apiKeys)
    .where(and(eq(apiKeys.key_prefix, prefix), isNull(apiKeys.revoked_at)));

  if (keys.length === 0) {
    verifyApiKey(token, 'a'.repeat(64));
    throw new UnauthorizedError('Invalid API key');
  }

  let matched: typeof keys[0] | null = null;
  for (const k of keys) {
    if (verifyApiKey(token, k.key_hash)) {
      matched = k;
      break;
    }
  }
  if (!matched) throw new UnauthorizedError('Invalid API key');

  // Update last_used_at
  await db.update(apiKeys)
    .set({ last_used_at: new Date() })
    .where(eq(apiKeys.id, matched.id));

  // Load workspace billing info
  const [ws] = await db.select({
    plan: workspaces.plan,
    balance_usd: workspaces.balance_usd,
    provider_config: workspaces.provider_config,
    subscription_status: workspaces.subscription_status,
    subscription_current_period_end: workspaces.subscription_current_period_end,
  })
    .from(workspaces)
    .where(eq(workspaces.id, matched.workspace_id))
    .limit(1);

  // Auto-downgrade expired trials
  const downgraded = ws ? await checkTrialExpiry(
    matched.workspace_id,
    ws.subscription_status || 'none',
    ws.subscription_current_period_end,
  ) : null;

  request.auth = {
    userId: 'api_key',
    workspaceId: matched.workspace_id,
    role: 'operator',
    authMethod: 'api_key',
    plan: downgraded || (ws?.plan as WorkspacePlan) || 'translator',
    balanceUsd: ws ? parseFloat(ws.balance_usd as string) || 0 : 0,
    providerConfig: (ws?.provider_config as ProviderConfig) || {},
  };
}

/** Authenticate via JWT or API key — tries API key first if token starts with mcp_ */
export async function authenticateAny(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace('Bearer ', '') ?? '';
  if (token.startsWith('mcp_')) {
    return authenticateApiKey(request, reply);
  }
  return authenticateUser(request, reply);
}

/** Require specific roles */
export function requireRole(...roles: AuthContext['role'][]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(request.auth.role)) {
      throw new ForbiddenError(`Requires role: ${roles.join(' or ')}`);
    }
  };
}
