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
 * Require Twilio credentials for outbound dialer.
 * - translator plan: allowed if admin shared platform Twilio (provider_config.twilio === 'platform') or own creds
 * - agents / agents_mcp: must have own Twilio credentials (no platform fallback)
 */
export function requireDialerAccess() {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const plan = request.auth.plan;
    const providerConfig = request.auth.providerConfig as any;

    // Translator plan: admin can share platform Twilio
    if (plan === 'translator' && providerConfig?.twilio === 'platform') return;

    // All plans: check for own Twilio credentials in workspace
    const { db } = await import('../config/db.js');
    const { providerCredentials } = await import('../db/schema.js');
    const { eq, and } = await import('drizzle-orm');
    const [own] = await db.select({ id: providerCredentials.id })
      .from(providerCredentials)
      .where(and(
        eq(providerCredentials.workspace_id, request.auth.workspaceId),
        eq(providerCredentials.provider, 'twilio'),
      ));
    if (own) return;

    // No access
    const msg = plan === 'translator'
      ? 'Outbound dialer requires Twilio credentials. Contact admin to enable.'
      : 'Outbound dialer requires your own Twilio credentials. Configure them in Settings → Providers.';
    throw new ForbiddenError(msg);
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
