import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, sql, gte, lte, like, or, count, sum } from 'drizzle-orm';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
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
  app.addHook('onRequest', requireRole('owner'));

  // ─── Dashboard ────────────────────────────────────────────────────────

  app.get('/dashboard', async (request) => {
    const wsId = request.auth.workspaceId;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [subsCount] = await db.select({ count: count() }).from(translatorSubscribers)
      .where(and(eq(translatorSubscribers.workspace_id, wsId), eq(translatorSubscribers.enabled, true)));

    const [sessStats] = await db.select({
      count: count(),
      total_minutes: sum(translatorSessions.minutes_used),
      total_cost: sum(translatorSessions.cost_usd),
    }).from(translatorSessions)
      .where(and(eq(translatorSessions.workspace_id, wsId), gte(translatorSessions.created_at, thirtyDaysAgo)));

    // Revenue by day (last 30 days)
    const revenueByDay = await db.execute(sql`
      SELECT DATE(created_at) as date, SUM(cost_usd::numeric) as revenue, SUM(minutes_used::numeric) as minutes, COUNT(*) as sessions
      FROM translator_sessions
      WHERE workspace_id = ${wsId} AND created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at) ORDER BY date
    `);

    // Low balance subscribers
    const lowBalance = await db.select({ id: translatorSubscribers.id, name: translatorSubscribers.name, balance_minutes: translatorSubscribers.balance_minutes })
      .from(translatorSubscribers)
      .where(and(eq(translatorSubscribers.workspace_id, wsId), eq(translatorSubscribers.enabled, true), sql`${translatorSubscribers.balance_minutes}::numeric < 5`));

    // Recent sessions
    const recentSessions = await db.select().from(translatorSessions)
      .where(eq(translatorSessions.workspace_id, wsId))
      .orderBy(desc(translatorSessions.created_at)).limit(10);

    // Cost estimate (for margin calculation)
    const totalMinutes = parseFloat(sessStats.total_minutes ?? '0');
    const totalRevenue = parseFloat(sessStats.total_cost ?? '0');
    const estimatedCost = totalMinutes * 0.027; // our cost per minute
    const margin = totalRevenue > 0 ? ((totalRevenue - estimatedCost) / totalRevenue * 100) : 0;

    return {
      kpi: {
        total_revenue: totalRevenue,
        active_subscribers: subsCount.count,
        minutes_used: totalMinutes,
        total_sessions: sessStats.count,
        margin: Math.round(margin),
        estimated_cost: estimatedCost,
      },
      revenue_by_day: revenueByDay.rows,
      low_balance_alerts: lowBalance,
      recent_sessions: recentSessions,
      subscribers: await db.select().from(translatorSubscribers)
        .where(eq(translatorSubscribers.workspace_id, wsId))
        .orderBy(desc(translatorSubscribers.created_at)),
    };
  });

  // ─── Subscribers ──────────────────────────────────────────────────────

  app.get('/subscribers', async (request) => {
    const wsId = request.auth.workspaceId;
    const q = z.object({
      search: z.string().optional(),
      status: z.enum(['all', 'active', 'blocked', 'disabled']).default('all'),
      limit: z.coerce.number().int().min(1).max(200).default(100),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query);

    let conditions: any = eq(translatorSubscribers.workspace_id, wsId);
    if (q.status === 'active') conditions = and(conditions, eq(translatorSubscribers.enabled, true), eq(translatorSubscribers.blocked, false));
    if (q.status === 'blocked') conditions = and(conditions, eq(translatorSubscribers.blocked, true));
    if (q.status === 'disabled') conditions = and(conditions, eq(translatorSubscribers.enabled, false));
    if (q.search) {
      conditions = and(conditions, or(
        like(translatorSubscribers.name, `%${q.search}%`),
        like(translatorSubscribers.phone_number, `%${q.search}%`),
      ));
    }

    const rows = await db.select().from(translatorSubscribers).where(conditions)
      .orderBy(desc(translatorSubscribers.created_at)).limit(q.limit).offset(q.offset);

    const [total] = await db.select({ count: count() }).from(translatorSubscribers).where(conditions);

    return { subscribers: rows, total: total.count };
  });

  app.get('/subscribers/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const wsId = request.auth.workspaceId;

    const [sub] = await db.select().from(translatorSubscribers)
      .where(and(eq(translatorSubscribers.id, id), eq(translatorSubscribers.workspace_id, wsId)));
    if (!sub) throw { statusCode: 404, message: 'Subscriber not found' };

    const sessions = await db.select().from(translatorSessions)
      .where(eq(translatorSessions.subscriber_id, id)).orderBy(desc(translatorSessions.created_at)).limit(50);

    const transactions = await db.select().from(balanceTransactions)
      .where(eq(balanceTransactions.subscriber_id, id)).orderBy(desc(balanceTransactions.created_at)).limit(50);

    const [stats] = await db.select({
      total_minutes: sum(translatorSessions.minutes_used),
      total_cost: sum(translatorSessions.cost_usd),
      total_sessions: count(),
    }).from(translatorSessions).where(eq(translatorSessions.subscriber_id, id));

    return { subscriber: sub, sessions, transactions, stats };
  });

  // Balance adjustment
  app.post('/subscribers/:id/balance', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      minutes: z.number().min(0.01).max(10000),
      type: z.enum(['topup', 'gift', 'refund']),
      comment: z.string().max(500).optional(),
    }).parse(request.body);

    const wsId = request.auth.workspaceId;
    const [sub] = await db.select().from(translatorSubscribers)
      .where(and(eq(translatorSubscribers.id, id), eq(translatorSubscribers.workspace_id, wsId)));
    if (!sub) throw { statusCode: 404, message: 'Not found' };

    await db.update(translatorSubscribers).set({
      balance_minutes: sql`${translatorSubscribers.balance_minutes} + ${body.minutes}`,
      updated_at: new Date(),
    }).where(eq(translatorSubscribers.id, id));

    await db.insert(balanceTransactions).values({
      subscriber_id: id, type: body.type, minutes: String(body.minutes),
      comment: body.comment, admin_user_id: request.auth.userId,
    });

    await auditLog(request.auth.userId, 'balance_added', 'subscriber', id,
      { minutes: body.minutes, type: body.type, comment: body.comment }, request.ip);

    return { ok: true };
  });

  // Block/unblock
  app.post('/subscribers/:id/block', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      blocked: z.boolean(),
      reason: z.string().max(500).optional(),
    }).parse(request.body);

    await db.update(translatorSubscribers).set({
      blocked: body.blocked,
      blocked_reason: body.blocked ? (body.reason ?? null) : null,
      updated_at: new Date(),
    }).where(and(eq(translatorSubscribers.id, id), eq(translatorSubscribers.workspace_id, request.auth.workspaceId)));

    await auditLog(request.auth.userId, body.blocked ? 'subscriber_blocked' : 'subscriber_unblocked',
      'subscriber', id, { reason: body.reason }, request.ip);

    return { ok: true };
  });

  // ─── Sessions ─────────────────────────────────────────────────────────

  app.get('/sessions', async (request) => {
    const wsId = request.auth.workspaceId;
    const q = z.object({
      subscriber_id: z.string().uuid().optional(),
      status: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query);

    let conditions: any = eq(translatorSessions.workspace_id, wsId);
    if (q.subscriber_id) conditions = and(conditions, eq(translatorSessions.subscriber_id, q.subscriber_id));
    if (q.status) conditions = and(conditions, eq(translatorSessions.status, q.status));
    if (q.from) conditions = and(conditions, gte(translatorSessions.created_at, new Date(q.from)));
    if (q.to) conditions = and(conditions, lte(translatorSessions.created_at, new Date(q.to)));

    const rows = await db.select().from(translatorSessions).where(conditions)
      .orderBy(desc(translatorSessions.created_at)).limit(q.limit).offset(q.offset);

    const [total] = await db.select({ count: count() }).from(translatorSessions).where(conditions);

    // Stats
    const [stats] = await db.select({
      avg_duration: sql`AVG(duration_seconds)`,
      total_sessions: count(),
      total_minutes: sum(translatorSessions.minutes_used),
    }).from(translatorSessions).where(conditions);

    return { sessions: rows, total: total.count, stats };
  });

  app.get('/sessions/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const [row] = await db.select().from(translatorSessions)
      .where(and(eq(translatorSessions.id, id), eq(translatorSessions.workspace_id, request.auth.workspaceId)));
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

    await auditLog(request.auth.userId, 'provider_updated', 'provider', name, { provider: name }, request.ip);
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

    await auditLog(request.auth.userId, 'stripe_connected', 'provider', 'stripe',
      { stripe_user_id: tokens.stripe_user_id, livemode: tokens.livemode }, request.ip);

    return { ok: true, stripe_user_id: tokens.stripe_user_id, livemode: tokens.livemode };
  });

  app.get('/stripe/status', async (request) => {
    try {
      const creds = await getProviderCredential(request.auth.workspaceId, 'stripe');
      if (creds.access_token) {
        const info = await fetchAccountInfo(creds.access_token);
        return { connected: true, stripe_user_id: creds.stripe_user_id, business_name: info.business_name, email: info.email, livemode: creds.livemode === 'true' };
      }
      return { connected: true, stripe_user_id: creds.stripe_user_id ?? null, livemode: false };
    } catch {
      return { connected: false };
    }
  });

  app.delete('/stripe/connect', async (request) => {
    try {
      const creds = await getProviderCredential(request.auth.workspaceId, 'stripe');
      if (creds.stripe_user_id) await disconnectAccount(creds.stripe_user_id);
    } catch { /* not connected — ok */ }

    await deleteProviderCredential(request.auth.workspaceId, 'stripe');
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
    if (q.search) conditions.push(like(workspaces.name, `%${q.search}%`));

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
      amount_usd: z.number(),
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
    const keys = ['billing_markup', 'billing_low_balance_threshold', 'billing_signup_bonus_usd',
      'billing_agents_monthly_price', 'billing_agents_mcp_monthly_price'];

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

    const allowedKeys = ['billing_markup', 'billing_low_balance_threshold', 'billing_signup_bonus_usd',
      'billing_agents_monthly_price', 'billing_agents_mcp_monthly_price'];

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
