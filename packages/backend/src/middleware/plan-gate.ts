import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../lib/errors.js';
import { hasFeature, type PlanFeatures } from '../config/plans.js';
import { hasSufficientBalance } from '../services/billing.service.js';

/**
 * Require workspace plan to include a specific feature.
 * Usage: { preHandler: [authenticateUser, requireFeature('aiAgents')] }
 */
export function requireFeature(feature: keyof PlanFeatures) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!hasFeature(request.auth.plan, feature)) {
      throw new ForbiddenError(`Your plan (${request.auth.plan}) does not include this feature. Please upgrade.`);
    }
  };
}

/**
 * Require MCP access — only enforced for API key auth (not dashboard users).
 * Workspaces on 'agents_mcp' plan have mcpAccess, others don't.
 */
export function requireMcpAccess() {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (request.auth.authMethod !== 'api_key') return; // dashboard users skip
    if (!hasFeature(request.auth.plan, 'mcpAccess')) {
      throw new ForbiddenError('MCP API access requires the Agents + MCP plan. Please upgrade.');
    }
  };
}

/**
 * Require own Twilio credentials for outbound dialer.
 * Translator-plan users can only use the dialer if admin has shared
 * Twilio credentials to their workspace (not via platform fallback).
 */
export function requireDialerAccess() {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (request.auth.plan !== 'translator') return; // non-translator plans have full dialer access
    // Admin shared platform Twilio via provider_config
    if ((request.auth.providerConfig as any)?.twilio === 'platform') return;
    // Own Twilio credentials in workspace
    const { db } = await import('../config/db.js');
    const { providerCredentials } = await import('../db/schema.js');
    const { eq, and } = await import('drizzle-orm');
    const [own] = await db.select({ id: providerCredentials.id })
      .from(providerCredentials)
      .where(and(
        eq(providerCredentials.workspace_id, request.auth.workspaceId),
        eq(providerCredentials.provider, 'twilio'),
      ));
    if (!own) {
      throw new ForbiddenError('Outbound dialer requires Twilio credentials. Contact admin to enable.');
    }
  };
}

/**
 * Require workspace to have positive deposit balance (for platform provider usage).
 * Skips check if workspace uses only own keys.
 */
export function requireBalance() {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    // Owner (admin) has unlimited balance
    if (request.auth.role === 'owner') return;
    if (!hasSufficientBalance(request.auth.balanceUsd, request.auth.providerConfig)) {
      throw new ForbiddenError('Insufficient deposit balance. Please top up to continue using platform providers.');
    }
  };
}
