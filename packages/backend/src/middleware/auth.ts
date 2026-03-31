import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../config/db.js';
import { workspaceMembers, apiKeys } from '../db/schema.js';
import { verifyJWT } from '../lib/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import { verifyApiKey } from '../lib/crypto.js';

export interface AuthContext {
  userId: string;
  workspaceId: string;
  role: 'owner' | 'admin' | 'operator' | 'analyst';
  authMethod: 'session' | 'api_key';
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

  const [membership] = await db.select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.user_id, userId))
    .limit(1);

  if (!membership) throw new ForbiddenError('No workspace membership found');

  request.auth = {
    userId,
    workspaceId: membership.workspace_id,
    role: membership.role as AuthContext['role'],
    authMethod: 'session',
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
    }
  }
  if (!matched) throw new UnauthorizedError('Invalid API key');

  // Update last_used_at
  await db.update(apiKeys)
    .set({ last_used_at: new Date() })
    .where(eq(apiKeys.id, matched.id));

  request.auth = {
    userId: 'api_key',
    workspaceId: matched.workspace_id,
    role: 'operator',
    authMethod: 'api_key',
  };
}

/** Require specific roles */
export function requireRole(...roles: AuthContext['role'][]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(request.auth.role)) {
      throw new ForbiddenError(`Requires role: ${roles.join(' or ')}`);
    }
  };
}
