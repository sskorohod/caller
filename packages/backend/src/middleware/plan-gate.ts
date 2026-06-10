import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../lib/errors.js';
import { hasFeature, type PlanFeatures } from '../config/plans.js';
import { hasSufficientBalance } from '../services/billing.service.js';
import { checkResourceLimit } from '../services/resource-limits.service.js';
import type { WorkspacePlan } from '../models/types.js';

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
 * Require Twilio for the outbound dialer. Twilio is now managed centrally by the
 * platform admin, so the dialer is available whenever the admin has configured
 * Twilio credentials.
 */
export function requireDialerAccess() {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const { hasOwnCredentials } = await import('../services/credential-resolver.service.js');
    if (await hasOwnCredentials(request.auth.workspaceId, 'twilio')) return;
    throw new ForbiddenError('Outbound dialer is unavailable — the platform admin has not configured Twilio.');
  };
}

/**
 * Require workspace to be under the resource limit for a given resource type.
 * Usage: { preHandler: [authenticateUser, requireResourceLimit('agent')] }
 */
export function requireResourceLimit(resource: 'agent' | 'connection') {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const result = await checkResourceLimit(
      request.auth.workspaceId,
      request.auth.plan as WorkspacePlan,
      resource,
    );
    if (!result.allowed) {
      const label = resource === 'agent' ? 'agent profiles' : 'phone connections';
      throw new ForbiddenError(
        `Plan limit reached: ${result.current}/${result.limit} ${label}. Upgrade your plan to add more.`
      );
    }
  };
}

/**
 * Require workspace to have positive deposit balance. All providers are now
 * platform-managed, so every workspace draws down balance — except the platform
 * admin, whose own usage is internal.
 */
export function requireBalance() {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (request.auth.isAdmin) return;
    if (!hasSufficientBalance(request.auth.balanceUsd, request.auth.providerConfig)) {
      throw new ForbiddenError('Insufficient deposit balance. Please top up to continue.');
    }
  };
}
