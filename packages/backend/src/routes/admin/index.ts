import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, sql, gte, lte, like, or, count, sum } from 'drizzle-orm';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { db } from '../../config/db.js';
import {
  translatorSubscribers, translatorSessions, promoCodes, promoRedemptions,
  balanceTransactions, platformSettings, adminAuditLog, providerCredentials,
} from '../../db/schema.js';
import { decrypt, encrypt } from '../../lib/crypto.js';

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
};

export default adminRoutes;
