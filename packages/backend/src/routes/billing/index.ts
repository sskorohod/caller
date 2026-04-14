import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { workspaces, depositTransactions } from '../../db/schema.js';
import { authenticateUser, authenticateAny, requireRole } from '../../middleware/auth.js';
import { creditDeposit } from '../../services/billing.service.js';
import { createDepositCheckout, createSubscription, cancelSubscription, createPortalSession, downgradeSubscription, reactivateSubscription, getDowngradePreview } from '../../services/stripe.service.js';
import { getResourceCounts } from '../../services/resource-limits.service.js';
import { getPlanConfig, PLANS } from '../../config/plans.js';
import type { WorkspacePlan } from '../../models/types.js';

const PLAN_ORDER: Record<string, number> = { translator: 0, agents: 1, agents_mcp: 2 };

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

    // Auto-downgrade expired trials
    if (ws?.subscription_status === 'trialing' && ws.subscription_current_period_end) {
      const now = new Date();
      if (now > new Date(ws.subscription_current_period_end)) {
        await db.update(workspaces).set({
          plan: 'translator',
          subscription_status: 'none',
          subscription_current_period_end: null,
          updated_at: now,
        }).where(eq(workspaces.id, request.auth.workspaceId));
        ws.plan = 'translator';
        ws.subscription_status = 'none';
        ws.subscription_current_period_end = null;
      }
    }

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

  // ─── POST /start-trial ─────────────────────────────────────────────
  // Activate 15-day free trial without Stripe — no credit card required
  app.post('/start-trial', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const body = z.object({
      plan: z.enum(['agents', 'agents_mcp']),
    }).parse(request.body);

    const planConfig = PLANS[body.plan];
    if (!planConfig.trialDays) {
      throw new Error(`Plan ${body.plan} does not support trial`);
    }

    // Check eligibility: never had a subscription or trial
    const [ws] = await db.select({
      stripe_subscription_id: workspaces.stripe_subscription_id,
      subscription_status: workspaces.subscription_status,
    }).from(workspaces).where(eq(workspaces.id, request.auth.workspaceId));

    if (ws?.stripe_subscription_id || (ws?.subscription_status && ws.subscription_status !== 'none')) {
      throw new Error('Trial is only available for new subscribers');
    }

    // Activate trial directly in DB — no Stripe involved
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + planConfig.trialDays);

    await db.update(workspaces).set({
      plan: body.plan,
      subscription_status: 'trialing',
      subscription_current_period_end: trialEnd,
      updated_at: new Date(),
    }).where(eq(workspaces.id, request.auth.workspaceId));

    return { success: true, trial_ends_at: trialEnd.toISOString() };
  });

  // ─── POST /subscription ────────────────────────────────────────────
  // Subscribe via Stripe Checkout — used after trial or for direct purchase
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

    const origin = (request.headers.origin || request.headers.referer || '').replace(/\/$/, '');
    const result = await createSubscription({
      workspaceId: request.auth.workspaceId,
      priceId: planConfig.stripePriceId,
      plan: body.plan,
      trialDays: 0,
      successUrl: `${origin}/dashboard/billing?subscribed=true`,
      cancelUrl: `${origin}/dashboard/billing?canceled=true`,
    });

    return result;
  });

  // ─── DELETE /subscription ──────────────────────────────────────────
  app.delete('/subscription', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    // Check if this is a trial (no Stripe subscription) or a paid subscription
    const [ws] = await db.select({
      stripe_subscription_id: workspaces.stripe_subscription_id,
      subscription_status: workspaces.subscription_status,
    }).from(workspaces).where(eq(workspaces.id, request.auth.workspaceId));

    if (ws?.subscription_status === 'trialing' && !ws.stripe_subscription_id) {
      // Cancel trial — just downgrade directly, no Stripe call needed
      await db.update(workspaces).set({
        plan: 'translator',
        subscription_status: 'none',
        subscription_current_period_end: null,
        updated_at: new Date(),
      }).where(eq(workspaces.id, request.auth.workspaceId));
    } else {
      await cancelSubscription(request.auth.workspaceId);
    }
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

  // ─── POST /downgrade ───────────────────────────────────────────────
  app.post('/downgrade', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const body = z.object({
      plan: z.enum(['translator', 'agents']),
    }).parse(request.body);

    const [ws] = await db.select({
      plan: workspaces.plan,
      subscription_status: workspaces.subscription_status,
      stripe_subscription_id: workspaces.stripe_subscription_id,
    }).from(workspaces).where(eq(workspaces.id, request.auth.workspaceId));

    const currentOrder = PLAN_ORDER[ws?.plan || 'translator'] ?? 0;
    const targetOrder = PLAN_ORDER[body.plan] ?? 0;

    if (targetOrder >= currentOrder) {
      return reply.status(400).send({ error: 'Target plan must be lower than current plan' });
    }

    if (body.plan === 'translator') {
      // Downgrade to translator = cancel subscription
      if (ws?.subscription_status === 'trialing' && !ws.stripe_subscription_id) {
        // Trial — immediate downgrade
        await db.update(workspaces).set({
          plan: 'translator',
          subscription_status: 'none',
          subscription_current_period_end: null,
          updated_at: new Date(),
        }).where(eq(workspaces.id, request.auth.workspaceId));
      } else if (ws?.stripe_subscription_id) {
        // Paid — cancel at period end
        await cancelSubscription(request.auth.workspaceId);
      } else {
        // Already on translator or no subscription
        await db.update(workspaces).set({
          plan: 'translator',
          subscription_status: 'none',
          updated_at: new Date(),
        }).where(eq(workspaces.id, request.auth.workspaceId));
      }
    } else {
      // Downgrade from agents_mcp → agents
      if (ws?.subscription_status === 'trialing' && !ws.stripe_subscription_id) {
        // Trial — just change plan in DB
        await db.update(workspaces).set({
          plan: body.plan,
          updated_at: new Date(),
        }).where(eq(workspaces.id, request.auth.workspaceId));
      } else {
        await downgradeSubscription(request.auth.workspaceId, body.plan);
      }
    }

    return reply.status(200).send({ success: true, plan: body.plan });
  });

  // ─── POST /reactivate ─────────────────────────────────────────────
  app.post('/reactivate', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const [ws] = await db.select({
      subscription_status: workspaces.subscription_status,
      stripe_subscription_id: workspaces.stripe_subscription_id,
    }).from(workspaces).where(eq(workspaces.id, request.auth.workspaceId));

    if (ws?.subscription_status !== 'canceled' || !ws.stripe_subscription_id) {
      return reply.status(400).send({ error: 'No canceled subscription to reactivate' });
    }

    await reactivateSubscription(request.auth.workspaceId);
    return reply.status(200).send({ success: true });
  });

  // ─── GET /resource-usage ──────────────────────────────────────────
  app.get('/resource-usage', { preHandler: [authenticateAny] }, async (request) => {
    const counts = await getResourceCounts(request.auth.workspaceId);
    return {
      agent_count: counts.agentCount,
      connection_count: counts.connectionCount,
    };
  });

  // ─── GET /downgrade-preview ───────────────────────────────────────
  app.get('/downgrade-preview', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const query = z.object({
      target_plan: z.enum(['translator', 'agents']),
    }).parse(request.query);

    return getDowngradePreview(request.auth.workspaceId, query.target_plan);
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
