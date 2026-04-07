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
 * Require workspace to have positive deposit balance (for platform provider usage).
 * Skips check if workspace uses only own keys.
 */
export function requireBalance() {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!hasSufficientBalance(request.auth.balanceUsd, request.auth.providerConfig)) {
      throw new ForbiddenError('Insufficient deposit balance. Please top up to continue using platform providers.');
    }
  };
}
