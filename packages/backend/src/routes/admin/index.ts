import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, sql, gte, lte, like, or, count, sum } from 'drizzle-orm';
import { authenticateUser, requireAdmin } from '../../middleware/auth.js';
import { db } from '../../config/db.js';
import {
  translatorSubscribers, translatorSessions, promoCodes, promoRedemptions,
  balanceTransactions, platformSettings, adminAuditLog, providerCredentials,
  workspaces, depositTransactions, aiCallSessions,
} from '../../db/schema.js';
import { decrypt, encrypt } from '../../lib/crypto.js';
import {
  generateAuthorizationUrl, validateState, exchangeCodeForTokens,
  fetchAccountInfo, disconnectAccount, isStripeConnectConfigured,
} from '../../services/stripe-connect.service.js';
import {
  saveProviderCredential, getProviderCredential, markProviderVerified, deleteProviderCredential,
} from '../../services/provider.service.js';
import { env } from '../../config/env.js';

async function auditLog(userId: string | undefined, action: string, resourceType: string, resourceId: string, details: any, ip?: string) {
  await db.insert(adminAuditLog).values({ user_id: userId, action, resource_type: resourceType, resource_id: resourceId, details, ip_address: ip });
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****' + key.slice(-4);
  return key.slice(0, 4) + '****' + key.slice(-4);
}

const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);
  app.addHook('onRequest', requireAdmin);

  // ─── Dashboard ────────────────────────────────────────────────────────

  app.get('/dashboard', async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Platform-wide translator session stats (last 30d)
    const [sessStats] = await db.select({
      count: count(),
      total_minutes: sum(translatorSessions.minutes_used),
      total_cost: sum(translatorSessions.cost_usd),
    }).from(translatorSessions)
      .where(gte(translatorSessions.created_at, thirtyDaysAgo));

    // Revenue by day (last 30d, all workspaces)
    const revenueByDay = await db.execute(sql`
      SELECT DATE(created_at) as date, SUM(cost_usd::numeric) as revenue, SUM(minutes_used::numeric) as minutes, COUNT(*) as sessions
      FROM translator_sessions
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at) ORDER BY date
    `);

    // Recent sessions across the platform
    const recentSessions = await db.select().from(translatorSessions)
      .orderBy(desc(translatorSessions.created_at)).limit(10);

    // Active subscribers = workspaces with any session in the last 30 days
    const activeUsersRows = await db.execute(sql`
      SELECT COUNT(DISTINCT workspace_id)::int AS c
      FROM translator_sessions
      WHERE created_at >= ${thirtyDaysAgo}
    `);
    const activeUsers = (activeUsersRows.rows[0] as any)?.c ?? 0;

    // Total registered workspaces (subscribers)
    const [totalWs] = await db.select({ c: count() }).from(workspaces);

    // Low-balance accounts (≤ $2 and > 0)
    const lowBalance = await db.execute(sql`
      SELECT id, name, owner_name, balance_usd::float AS balance_usd, phone_numbers
      FROM workspaces
      WHERE balance_usd::numeric > 0 AND balance_usd::numeric <= 2
      ORDER BY balance_usd::numeric ASC LIMIT 10
    `);

    const totalMinutes = parseFloat(sessStats.total_minutes ?? '0');
    const totalRevenue = parseFloat(sessStats.total_cost ?? '0');
    const estimatedCost = totalMinutes * 0.027;
    const margin = totalRevenue > 0 ? ((totalRevenue - estimatedCost) / totalRevenue * 100) : 0;

    return {
      kpi: {
        total_revenue: totalRevenue,
        active_users: activeUsers,
        total_subscribers: totalWs.c,
        minutes_used: totalMinutes,
        total_sessions: sessStats.count,
        margin: Math.round(margin),
        estimated_cost: estimatedCost,
      },
      revenue_by_day: revenueByDay.rows,
      low_balance_alerts: lowBalance.rows,
      recent_sessions: recentSessions,
    };
  });

  // ─── Sessions ─────────────────────────────────────────────────────────

  app.get('/sessions', async (request) => {
    const q = z.object({
      workspace_id: z.string().uuid().optional(),
      subscriber_id: z.string().uuid().optional(),
      status: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query);

    const conds: any[] = [];
    if (q.workspace_id) conds.push(eq(translatorSessions.workspace_id, q.workspace_id));
    if (q.subscriber_id) conds.push(eq(translatorSessions.subscriber_id, q.subscriber_id));
    if (q.status) conds.push(eq(translatorSessions.status, q.status));
    if (q.from) conds.push(gte(translatorSessions.created_at, new Date(q.from)));
    if (q.to) conds.push(lte(translatorSessions.created_at, new Date(q.to)));
    const where = conds.length ? and(...conds) : undefined;

    const rows = await db.select().from(translatorSessions).where(where)
      .orderBy(desc(translatorSessions.created_at)).limit(q.limit).offset(q.offset);

    const [total] = await db.select({ count: count() }).from(translatorSessions).where(where);

    const [stats] = await db.select({
      avg_duration: sql`AVG(duration_seconds)`,
      total_sessions: count(),
      total_minutes: sum(translatorSessions.minutes_used),
    }).from(translatorSessions).where(where);

    return { sessions: rows, total: total.count, stats };
  });

  app.get('/sessions/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const [row] = await db.select().from(translatorSessions)
      .where(eq(translatorSessions.id, id));
    if (!row) throw { statusCode: 404, message: 'Session not found' };
    return row;
  });

  // ─── Providers ────────────────────────────────────────────────────────

  app.get('/providers', async (request) => {
    const wsId = request.auth.workspaceId;
    const rows = await db.select().from(providerCredentials).where(eq(providerCredentials.workspace_id, wsId));

    const providers: Record<string, { connected: boolean; masked_key?: string; updated_at?: string }> = {};
    for (const row of rows) {
      try {
        const creds = JSON.parse(decrypt(row.credential_data));
        const firstKey = Object.values(creds)[0] as string;
        providers[row.provider] = {
          connected: true,
          masked_key: maskKey(firstKey ?? ''),
          updated_at: row.updated_at?.toISOString(),
        };
      } catch {
        providers[row.provider] = { connected: false };
      }
    }

    // Add missing providers as not connected
    for (const p of ['stripe', 'twilio', 'deepgram', 'elevenlabs', 'openai', 'xai', 'telegram']) {
      if (!providers[p]) providers[p] = { connected: false };
    }

    return { providers };
  });

  app.put('/providers/:name', async (request) => {
    const { name } = z.object({ name: z.string() }).parse(request.params);
    const body = z.record(z.string()).parse(request.body);
    const wsId = request.auth.workspaceId;

    const encrypted = encrypt(JSON.stringify(body));

    const [existing] = await db.select().from(providerCredentials)
      .where(and(eq(providerCredentials.workspace_id, wsId), eq(providerCredentials.provider, name)));

    if (existing) {
      await db.update(providerCredentials).set({ credential_data: encrypted, updated_at: new Date() })
        .where(eq(providerCredentials.id, existing.id));
    } else {
      await db.insert(providerCredentials).values({ workspace_id: wsId, provider: name, credential_data: encrypted });
    }

    // Mark this workspace as the platform Stripe account — all client payments
    // route through whoever the admin connected here.
    if (name === 'stripe') {
      await db.insert(platformSettings)
        .values({ key: 'platform_stripe_workspace_id', value: wsId as any, updated_at: new Date() })
        .onConflictDoUpdate({ target: platformSettings.key, set: { value: wsId as any, updated_at: new Date() } });
    }

    await auditLog(request.auth.userId, 'provider_updated', 'provider', name, { provider: name }, request.ip);
    return { ok: true };
  });

  // DELETE /providers/:name — remove a manually-entered provider credential.
  app.delete('/providers/:name', async (request) => {
    const { name } = z.object({ name: z.string() }).parse(request.params);
    await deleteProviderCredential(request.auth.workspaceId, name as any);
    if (name === 'stripe') {
      await db.delete(platformSettings).where(eq(platformSettings.key, 'platform_stripe_workspace_id'));
    }
    await auditLog(request.auth.userId, 'provider_deleted', 'provider', name, { provider: name }, request.ip);
    return { ok: true };
  });

  app.post('/providers/:name/test', async (request) => {
    const { name } = z.object({ name: z.string() }).parse(request.params);
    const wsId = request.auth.workspaceId;

    try {
      if (name === 'deepgram') {
        const { createSTTProvider } = await import('../../services/stt.service.js');
        const stt = await createSTTProvider(wsId, 'deepgram');
        stt.close();
        return { ok: true, message: 'Deepgram connection successful' };
      }
      if (name === 'elevenlabs' || name === 'openai' || name === 'xai') {
        const { createTTSProvider } = await import('../../services/tts.service.js');
        await createTTSProvider(wsId, name as any);
        return { ok: true, message: `${name} TTS connection successful` };
      }
      if (name === 'telegram') {
        const [row] = await db.select().from(providerCredentials)
          .where(and(eq(providerCredentials.workspace_id, wsId), eq(providerCredentials.provider, 'telegram')));
        if (row) {
          const creds = JSON.parse(decrypt(row.credential_data));
          const { testBot } = await import('../../services/telegram.service.js');
          const ok = await testBot(creds.bot_token, creds.chat_id);
          return { ok, message: ok ? 'Telegram bot connected' : 'Telegram test failed' };
        }
      }
      return { ok: true, message: 'Provider exists' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  });

  // ─── Promo Codes ──────────────────────────────────────────────────────

  app.get('/promo', async (request) => {
    const wsId = request.auth.workspaceId;
    const rows = await db.select().from(promoCodes)
      .where(eq(promoCodes.workspace_id, wsId)).orderBy(desc(promoCodes.created_at));
    return { promo_codes: rows };
  });

  app.post('/promo', async (request) => {
    const body = z.object({
      code: z.string().min(3).max(30).toUpperCase(),
      minutes: z.number().min(1).max(1000),
      max_uses: z.number().int().min(1).max(100000).default(100),
      expires_at: z.string().optional(),
    }).parse(request.body);

    const wsId = request.auth.workspaceId;
    const [row] = await db.insert(promoCodes).values({
      workspace_id: wsId, code: body.code, minutes: String(body.minutes),
      max_uses: body.max_uses, expires_at: body.expires_at ? new Date(body.expires_at) : null,
    }).returning();

    await auditLog(request.auth.userId, 'promo_created', 'promo', row.id,
      { code: body.code, minutes: body.minutes }, request.ip);
    return row;
  });

  app.put('/promo/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ active: z.boolean() }).parse(request.body);
    await db.update(promoCodes).set({ active: body.active })
      .where(and(eq(promoCodes.id, id), eq(promoCodes.workspace_id, request.auth.workspaceId)));
    return { ok: true };
  });

  // ─── Settings ─────────────────────────────────────────────────────────

  app.get('/settings', async () => {
    const rows = await db.select().from(platformSettings);
    const settings: Record<string, any> = {};
    for (const row of rows) settings[row.key] = row.value;
    return { settings };
  });

  app.put('/settings', async (request) => {
    const body = z.record(z.unknown()).parse(request.body);
    for (const [key, value] of Object.entries(body)) {
      await db.insert(platformSettings).values({ key, value: value as any, updated_at: new Date() })
        .onConflictDoUpdate({ target: platformSettings.key, set: { value: value as any, updated_at: new Date() } });
    }
    await auditLog(request.auth.userId, 'settings_changed', 'settings', 'platform',
      { keys: Object.keys(body) }, request.ip);
    // Invalidate pricing cache if pricing was updated
    if ('pricing' in body) {
      const { invalidatePricingCache } = await import('../../config/pricing.js');
      invalidatePricingCache();
    }
    return { ok: true };
  });

  // ─── Stripe Connect OAuth ─────────────────────────────────���────────────

  app.get('/stripe/connect', async (request) => {
    if (!isStripeConnectConfigured()) throw { statusCode: 400, message: 'Stripe Connect not configured' };
    const redirectUri = `https://${env.API_DOMAIN}/admin/providers/stripe/callback`;
    return generateAuthorizationUrl(request.auth.workspaceId, redirectUri);
  });

  app.post('/stripe/callback', async (request) => {
    const { code, state } = z.object({ code: z.string(), state: z.string() }).parse(request.body);

    const stateWorkspaceId = await validateState(state);
    if (!stateWorkspaceId || stateWorkspaceId !== request.auth.workspaceId) {
      throw { statusCode: 400, message: 'Invalid or expired state' };
    }

    const tokens = await exchangeCodeForTokens(code);
    await saveProviderCredential({
      workspaceId: request.auth.workspaceId,
      provider: 'stripe',
      credentials: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        stripe_user_id: tokens.stripe_user_id,
        livemode: String(tokens.livemode),
      },
    });
    await markProviderVerified(request.auth.workspaceId, 'stripe');
    await db.insert(platformSettings)
      .values({ key: 'platform_stripe_workspace_id', value: request.auth.workspaceId as any, updated_at: new Date() })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value: request.auth.workspaceId as any, updated_at: new Date() } });

    await auditLog(request.auth.userId, 'stripe_connected', 'provider', 'stripe',
      { stripe_user_id: tokens.stripe_user_id, livemode: tokens.livemode }, request.ip);

    return { ok: true, stripe_user_id: tokens.stripe_user_id, livemode: tokens.livemode };
  });

  app.get('/stripe/status', async (request) => {
    const oauth_available = isStripeConnectConfigured();
    try {
      const creds = await getProviderCredential(request.auth.workspaceId, 'stripe');
      const apiKey = creds.access_token || creds.secret_key;
      if (apiKey) {
        let business_name: string | null | undefined;
        let email: string | null | undefined;
        try {
          const info = await fetchAccountInfo(apiKey);
          business_name = info.business_name;
          email = info.email;
        } catch { /* account fetch failed — still connected */ }
        const mode = creds.access_token ? 'oauth' : 'manual';
        const livemode = creds.access_token
          ? creds.livemode === 'true'
          : (creds.secret_key?.includes('_live_') ?? false);
        return { connected: true, mode, stripe_user_id: creds.stripe_user_id ?? null, business_name, email, livemode, oauth_available };
      }
      return { connected: false, oauth_available };
    } catch {
      return { connected: false, oauth_available };
    }
  });

  app.delete('/stripe/connect', async (request) => {
    try {
      const creds = await getProviderCredential(request.auth.workspaceId, 'stripe');
      if (creds.stripe_user_id) await disconnectAccount(creds.stripe_user_id);
    } catch { /* not connected — ok */ }

    await deleteProviderCredential(request.auth.workspaceId, 'stripe');
    await db.delete(platformSettings).where(eq(platformSettings.key, 'platform_stripe_workspace_id'));
    await auditLog(request.auth.userId, 'stripe_disconnected', 'provider', 'stripe', {}, request.ip);
    return { ok: true };
  });

  // ─── Audit Log ────────────────────────────────────────────────────────

  app.get('/audit', async (request) => {
    const q = z.object({
      action: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query);

    let conditions: any = undefined;
    if (q.action) conditions = eq(adminAuditLog.action, q.action);

    const rows = await db.select().from(adminAuditLog)
      .where(conditions).orderBy(desc(adminAuditLog.created_at)).limit(q.limit).offset(q.offset);
    return { logs: rows };
  });

  // ═══════════════════════════════════════════════════════════════════════
  // BILLING ADMIN — Workspaces, Finance, Settings
  // ═══════════════════════════════════════════════════════════════════════

  // ─── GET /workspaces ─────────────────────────────────────────────────
  app.get('/workspaces', async (request) => {
    const q = z.object({
      plan: z.string().optional(),
      search: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query);

    const conditions: any[] = [];
    if (q.plan) conditions.push(eq(workspaces.plan, q.plan));
    if (q.search) {
      const s = `%${q.search}%`;
      conditions.push(or(
        like(workspaces.name, s),
        like(workspaces.owner_name, s),
        // phone search: cast jsonb array to text and ILIKE
        sql`${workspaces.phone_numbers}::text ILIKE ${s}`,
      ));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select().from(workspaces)
      .where(where)
      .orderBy(desc(workspaces.created_at))
      .limit(q.limit).offset(q.offset);

    return rows.map(w => ({
      ...w,
      balance_usd: parseFloat(w.balance_usd as string) || 0,
    }));
  });

  // ─── GET /workspaces/:id ─────────────────────────────────────────────
  app.get('/workspaces/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    if (!ws) return { error: 'Not found' };

    const transactions = await db.select().from(depositTransactions)
      .where(eq(depositTransactions.workspace_id, id))
      .orderBy(desc(depositTransactions.created_at))
      .limit(50);

    return {
      workspace: { ...ws, balance_usd: parseFloat(ws.balance_usd as string) || 0 },
      transactions: transactions.map(t => ({
        ...t,
        amount_usd: parseFloat(t.amount_usd as string),
        balance_after: parseFloat(t.balance_after as string),
      })),
    };
  });

  // ─── PATCH /workspaces/:id/plan ──────────────────────────────────────
  app.patch('/workspaces/:id/plan', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ plan: z.enum(['translator', 'agents', 'agents_mcp']) }).parse(request.body);

    await db.update(workspaces).set({ plan: body.plan, updated_at: new Date() }).where(eq(workspaces.id, id));
    await auditLog(request.auth.userId, 'plan_changed', 'workspace', id, { plan: body.plan }, request.ip);
    return { success: true };
  });

  // ─── POST /workspaces/:id/balance ────────────────────────────────────
  app.post('/workspaces/:id/balance', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      amount_usd: z.number().positive('Amount must be positive'),
      type: z.enum(['topup', 'refund', 'gift']),
      comment: z.string().optional(),
    }).parse(request.body);

    const { creditDeposit } = await import('../../services/billing.service.js');
    const result = await creditDeposit({
      workspaceId: id,
      amountUsd: body.amount_usd,
      type: body.type,
      description: body.comment || `Admin ${body.type}`,
      referenceType: 'admin',
      createdBy: request.auth.userId,
    });

    await auditLog(request.auth.userId, 'balance_adjusted', 'workspace', id,
      { amount_usd: body.amount_usd, type: body.type, comment: body.comment, new_balance: result.newBalance },
      request.ip);

    return { success: true, new_balance: result.newBalance };
  });

  // ─── POST /workspaces/:id/refund-stripe — issue a real Stripe refund ─
  app.post('/workspaces/:id/refund-stripe', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      transaction_id: z.string().uuid('Original topup transaction id is required'),
      amount_usd: z.number().positive().optional(),
      reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
      comment: z.string().optional(),
    }).parse(request.body);

    // 1. Look up the original deposit transaction.
    const [origTx] = await db.select().from(depositTransactions)
      .where(and(
        eq(depositTransactions.id, body.transaction_id),
        eq(depositTransactions.workspace_id, id),
      ));
    if (!origTx) throw { statusCode: 404, message: 'Transaction not found' };
    if (origTx.reference_type !== 'stripe_checkout' || !origTx.reference_id) {
      throw { statusCode: 400, message: 'Transaction is not a Stripe checkout payment' };
    }
    if (origTx.type !== 'topup') {
      throw { statusCode: 400, message: 'Only topup transactions can be refunded' };
    }
    const origAmount = Math.abs(parseFloat(origTx.amount_usd as string));
    const refundAmount = body.amount_usd ?? origAmount;
    if (refundAmount > origAmount) {
      throw { statusCode: 400, message: `Refund amount $${refundAmount} exceeds original $${origAmount}` };
    }

    // 2. Issue Stripe refund.
    const { refundDepositCheckout } = await import('../../services/stripe.service.js');
    const stripeResult = await refundDepositCheckout({
      workspaceId: id,
      checkoutSessionId: origTx.reference_id,
      amountUsd: refundAmount,
      reason: body.reason,
    });

    // 3. Record refund in the ledger as a negative balance adjustment.
    const { creditDeposit } = await import('../../services/billing.service.js');
    const result = await creditDeposit({
      workspaceId: id,
      amountUsd: -refundAmount,
      type: 'refund',
      description: body.comment || `Stripe refund (${stripeResult.refundId})`,
      referenceType: 'stripe_refund',
      referenceId: stripeResult.refundId,
      createdBy: request.auth.userId,
    });

    await auditLog(request.auth.userId, 'stripe_refund_issued', 'workspace', id,
      { transaction_id: body.transaction_id, refund_id: stripeResult.refundId, amount_usd: refundAmount,
        reason: body.reason, status: stripeResult.status, new_balance: result.newBalance },
      request.ip);

    return {
      success: true,
      refund_id: stripeResult.refundId,
      status: stripeResult.status,
      new_balance: result.newBalance,
    };
  });

  // ─── DELETE /workspaces/:id ───────────────────────────────────────
  app.delete('/workspaces/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    // Prevent deleting own workspace
    if (id === request.auth.workspaceId) {
      return { error: 'Cannot delete your own workspace' };
    }

    await db.delete(workspaces).where(eq(workspaces.id, id));
    await auditLog(request.auth.userId, 'workspace_deleted', 'workspace', id, {}, request.ip);

    return { success: true };
  });

  // Per-workspace provider-config (platform|own) was removed when provider
  // management was centralized under the platform admin — all workspaces use
  // the admin's credentials, so there is no per-workspace mode to set.

  // ─── GET /finance/overview ───────────────────────────────────────────
  app.get('/finance/overview', async (request) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Total deposit balance across all workspaces
    const [totalBalance] = await db.select({
      total: sum(workspaces.balance_usd),
    }).from(workspaces);

    // Deposits in last 30 days
    const [depositsIn] = await db.select({
      total: sum(depositTransactions.amount_usd),
      count: count(),
    }).from(depositTransactions)
      .where(and(
        eq(depositTransactions.type, 'topup'),
        gte(depositTransactions.created_at, thirtyDaysAgo),
      ));

    // Usage in last 30 days
    const [usageOut] = await db.select({
      total: sum(depositTransactions.amount_usd),
      count: count(),
    }).from(depositTransactions)
      .where(and(
        eq(depositTransactions.type, 'usage'),
        gte(depositTransactions.created_at, thirtyDaysAgo),
      ));

    // Real provider costs (from ai_call_sessions)
    const [providerCosts] = await db.select({
      total_cost: sum(aiCallSessions.cost_total),
      total_sessions: count(),
    }).from(aiCallSessions)
      .where(gte(aiCallSessions.created_at, thirtyDaysAgo));

    // Active subscriptions
    const [activeSubs] = await db.select({ count: count() }).from(workspaces)
      .where(eq(workspaces.subscription_status, 'active'));

    // Workspace counts by plan
    const planCounts = await db.select({
      plan: workspaces.plan,
      count: count(),
    }).from(workspaces).groupBy(workspaces.plan);

    const usageTotal = Math.abs(parseFloat(usageOut.total ?? '0'));
    const realCost = parseFloat(providerCosts.total_cost ?? '0');
    const revenue = usageTotal; // what we charged clients
    const margin = revenue > 0 ? ((revenue - realCost) / revenue * 100) : 0;

    return {
      kpi: {
        total_deposit_balance: parseFloat(totalBalance.total ?? '0'),
        deposits_30d: parseFloat(depositsIn.total ?? '0'),
        usage_revenue_30d: usageTotal,
        real_provider_cost_30d: realCost,
        margin_percent: Math.round(margin),
        active_subscriptions: activeSubs.count,
        total_sessions_30d: providerCosts.total_sessions,
      },
      plan_counts: planCounts,
    };
  });

  // ─── GET /finance/transactions ────────────────────────────────────────
  app.get('/finance/transactions', async (request) => {
    const q = z.object({
      type: z.string().optional(),
      workspace_id: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query);

    const conditions: any[] = [];
    if (q.type) conditions.push(eq(depositTransactions.type, q.type));
    if (q.workspace_id) conditions.push(eq(depositTransactions.workspace_id, q.workspace_id));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select({
      id: depositTransactions.id,
      workspace_id: depositTransactions.workspace_id,
      workspace_name: workspaces.name,
      type: depositTransactions.type,
      amount_usd: depositTransactions.amount_usd,
      balance_after: depositTransactions.balance_after,
      description: depositTransactions.description,
      reference_type: depositTransactions.reference_type,
      created_at: depositTransactions.created_at,
    })
      .from(depositTransactions)
      .leftJoin(workspaces, eq(workspaces.id, depositTransactions.workspace_id))
      .where(where)
      .orderBy(desc(depositTransactions.created_at))
      .limit(q.limit).offset(q.offset);

    return rows.map(r => ({
      ...r,
      amount_usd: parseFloat(r.amount_usd as string),
      balance_after: parseFloat(r.balance_after as string),
    }));
  });

  // ─── GET /finance/revenue-chart ──────────────────────────────────────
  app.get('/finance/revenue-chart', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rows = await db.execute(sql`
      SELECT DATE(created_at) as date,
        SUM(CASE WHEN type = 'topup' THEN amount_usd::numeric ELSE 0 END) as deposits,
        SUM(CASE WHEN type = 'usage' THEN ABS(amount_usd::numeric) ELSE 0 END) as usage_revenue
      FROM deposit_transactions
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    return rows.rows;
  });

  // ─── GET /billing-settings ───────────────────────────────────────────
  app.get('/billing-settings', async () => {
    const keys = ['billing_markup', 'billing_low_balance_threshold', 'billing_signup_bonus_usd'];

    const rows = await db.select().from(platformSettings)
      .where(or(...keys.map(k => eq(platformSettings.key, k))));

    const settings: Record<string, any> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  });

  // ─── PUT /billing-settings ───────────────────────────────────────────
  app.put('/billing-settings', async (request) => {
    const body = z.record(z.union([z.string(), z.number()])).parse(request.body);

    const allowedKeys = ['billing_markup', 'billing_low_balance_threshold', 'billing_signup_bonus_usd'];

    for (const [key, value] of Object.entries(body)) {
      if (!allowedKeys.includes(key)) continue;
      await db.insert(platformSettings).values({
        key,
        value: JSON.stringify(String(value)) as any,
        updated_at: new Date(),
      }).onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: JSON.stringify(String(value)) as any, updated_at: new Date() },
      });
    }

    await auditLog(request.auth.userId, 'billing_settings_changed', 'settings', 'billing', body, request.ip);
    return { success: true };
  });
};

export default adminRoutes;
