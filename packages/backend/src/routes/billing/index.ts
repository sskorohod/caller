import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { workspaces, depositTransactions } from '../../db/schema.js';
import { authenticateUser, authenticateAny, requireRole } from '../../middleware/auth.js';
import { creditDeposit } from '../../services/billing.service.js';
import { createDepositCheckout, createSubscription, cancelSubscription, createPortalSession } from '../../services/stripe.service.js';
import { getPlanConfig, PLANS } from '../../config/plans.js';
import type { WorkspacePlan } from '../../models/types.js';

const billingRoutes: FastifyPluginAsync = async (app) => {
  // ─── GET /balance ─── supports both JWT and API key (MCP)
  app.get('/balance', { preHandler: [authenticateAny] }, async (request) => {
    const [ws] = await db.select({
      balance_usd: workspaces.balance_usd,
      plan: workspaces.plan,
      subscription_status: workspaces.subscription_status,
      subscription_current_period_end: workspaces.subscription_current_period_end,
      provider_config: workspaces.provider_config,
    })
      .from(workspaces)
      .where(eq(workspaces.id, request.auth.workspaceId));

    const plan = getPlanConfig((ws?.plan as WorkspacePlan) || 'translator');

    return {
      balance_usd: parseFloat(ws?.balance_usd as string) || 0,
      plan: plan.id,
      plan_name: plan.name,
      subscription_status: ws?.subscription_status || 'none',
      subscription_current_period_end: ws?.subscription_current_period_end,
      provider_config: ws?.provider_config || {},
      features: plan.features,
    };
  });

  // ─── GET /transactions ──────────────────────────────────────────────
  app.get('/transactions', { preHandler: [authenticateAny] }, async (request) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit || '50'), 100);
    const offset = parseInt(query.offset || '0');

    const rows = await db.select()
      .from(depositTransactions)
      .where(eq(depositTransactions.workspace_id, request.auth.workspaceId))
      .orderBy(desc(depositTransactions.created_at))
      .limit(limit)
      .offset(offset);

    return rows.map(r => ({
      ...r,
      amount_usd: parseFloat(r.amount_usd as string),
      balance_after: parseFloat(r.balance_after as string),
    }));
  });

  // ─── POST /deposit/checkout ─────────────────────────────────────────
  app.post('/deposit/checkout', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const body = z.object({
      amount_usd: z.number().min(1).max(10000),
    }).parse(request.body);

    const origin = (request.headers.origin || request.headers.referer || '').replace(/\/$/, '');
    const result = await createDepositCheckout({
      workspaceId: request.auth.workspaceId,
      amountUsd: body.amount_usd,
      successUrl: `${origin}/dashboard/billing?success=true`,
      cancelUrl: `${origin}/dashboard/billing?canceled=true`,
    });

    return result;
  });

  // ─── POST /subscription ────────────────────────────────────────────
  app.post('/subscription', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const body = z.object({
      plan: z.enum(['agents', 'agents_mcp']),
    }).parse(request.body);

    const planConfig = PLANS[body.plan];
    if (!planConfig.stripePriceId) {
      throw new Error(`No Stripe price configured for plan ${body.plan}`);
    }

    // Trial eligibility: only for workspaces that never had a subscription
    const [ws] = await db.select({
      stripe_subscription_id: workspaces.stripe_subscription_id,
      subscription_status: workspaces.subscription_status,
    }).from(workspaces).where(eq(workspaces.id, request.auth.workspaceId));

    const isTrialEligible = !ws?.stripe_subscription_id && ws?.subscription_status === 'none';
    const trialDays = isTrialEligible ? planConfig.trialDays : 0;

    const origin = (request.headers.origin || request.headers.referer || '').replace(/\/$/, '');
    const result = await createSubscription({
      workspaceId: request.auth.workspaceId,
      priceId: planConfig.stripePriceId,
      plan: body.plan,
      trialDays,
      successUrl: `${origin}/dashboard/billing?subscribed=true`,
      cancelUrl: `${origin}/dashboard/billing?canceled=true`,
    });

    // Plan is NOT updated here — it will be set by the webhook after payment confirms

    return result;
  });

  // ─── DELETE /subscription ──────────────────────────────────────────
  app.delete('/subscription', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    await cancelSubscription(request.auth.workspaceId);
    return { success: true };
  });

  // ─── GET /provider-config ──────────────────────────────────────────
  app.get('/provider-config', { preHandler: [authenticateAny] }, async (request) => {
    const [ws] = await db.select({ provider_config: workspaces.provider_config })
      .from(workspaces)
      .where(eq(workspaces.id, request.auth.workspaceId));
    return ws?.provider_config || {};
  });

  // ─── PATCH /provider-config ────────────────────────────────────────
  app.patch('/provider-config', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const body = z.record(z.enum(['platform', 'own'])).parse(request.body);

    // Merge with existing config
    const [ws] = await db.select({ provider_config: workspaces.provider_config })
      .from(workspaces)
      .where(eq(workspaces.id, request.auth.workspaceId));

    const current = (ws?.provider_config as Record<string, string>) || {};
    const updated = { ...current, ...body };

    await db.update(workspaces).set({
      provider_config: updated,
      updated_at: new Date(),
    }).where(eq(workspaces.id, request.auth.workspaceId));

    return updated;
  });

  // ─── POST /portal-session ──────────────────────────────────────────
  app.post('/portal-session', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const origin = (request.headers.origin || request.headers.referer || '').replace(/\/$/, '');
    const result = await createPortalSession({
      workspaceId: request.auth.workspaceId,
      returnUrl: `${origin}/dashboard/billing`,
    });
    return result;
  });

};

export default billingRoutes;
