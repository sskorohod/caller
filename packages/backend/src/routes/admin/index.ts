import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, sql, gte, lte, like, or, count, sum, inArray } from 'drizzle-orm';
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
  // All business metrics EXCLUDE the platform admin's own workspace — its
  // test calls, huge service balance, and personal number would distort
  // every number (the admin is never billed, see deductUsageCost).

  const NIL_WS = '00000000-0000-0000-0000-000000000000';

  async function adminWorkspaceId(): Promise<string> {
    const { getAdminWorkspaceId } = await import('../../services/credential-resolver.service.js');
    return await getAdminWorkspaceId().catch(() => null) ?? NIL_WS;
  }

  type Granularity = 'hour' | 'day' | 'month';

  function resolvePeriod(period: 'today' | '7d' | '30d' | 'year' | 'all') {
    const now = new Date();
    let start: Date;
    let granularity: Granularity;
    switch (period) {
      case 'today':
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        granularity = 'hour';
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 86400000);
        granularity = 'day';
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 86400000);
        granularity = 'day';
        break;
      case 'year':
        start = new Date(now.getTime() - 365 * 86400000);
        granularity = 'month';
        break;
      case 'all':
        start = new Date(0);
        granularity = 'month';
        break;
    }
    // Previous window for trends. For 'today' compare against yesterday up
    // to the same time of day (not the tail of yesterday); for rolling
    // periods — the immediately preceding equal-length window.
    let prevStart: Date | null;
    let prevEnd: Date;
    if (period === 'all') {
      prevStart = null;
      prevEnd = start;
    } else if (period === 'today') {
      prevStart = new Date(start.getTime() - 86400000);
      prevEnd = new Date(now.getTime() - 86400000);
    } else {
      prevStart = new Date(start.getTime() - (now.getTime() - start.getTime()));
      prevEnd = start;
    }
    return { now, start, prevStart, prevEnd, granularity };
  }

  app.get('/dashboard', async (request) => {
    const { period } = z.object({
      period: z.enum(['today', '7d', '30d', 'year', 'all']).default('30d'),
    }).parse(request.query);

    const { now, start, prevStart, prevEnd, granularity } = resolvePeriod(period);
    const windowStart = prevStart ?? start;
    const adminWs = await adminWorkspaceId();
    // SQL fragment values: granularity comes from the internal whitelist above,
    // never from user input.
    const grain = sql.raw(`'${granularity}'`);
    const inPrev = sql`created_at >= ${windowStart} AND created_at < ${prevEnd}`;

    // Revenue from the ledger (usage + number rental) — same source as Finance
    const revenueRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(ABS(amount_usd::numeric)) FILTER (WHERE created_at >= ${start}), 0)::float AS current,
        COALESCE(SUM(ABS(amount_usd::numeric)) FILTER (WHERE ${inPrev}), 0)::float AS previous
      FROM deposit_transactions
      WHERE type IN ('usage', 'number_rental')
        AND workspace_id IS DISTINCT FROM ${adminWs}
        AND created_at >= ${windowStart} AND created_at < ${now}
    `);
    const revenue = revenueRows.rows[0] as { current: number; previous: number };

    // Real provider cost (ai_call_sessions tracks stt/llm/tts/telephony)
    const costRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(cost_total::numeric) FILTER (WHERE created_at >= ${start}), 0)::float AS current,
        COALESCE(SUM(cost_total::numeric) FILTER (WHERE ${inPrev}), 0)::float AS previous
      FROM ai_call_sessions
      WHERE workspace_id IS DISTINCT FROM ${adminWs}
        AND created_at >= ${windowStart} AND created_at < ${now}
    `);
    const cost = costRows.rows[0] as { current: number; previous: number };

    // Sessions / minutes / active users (training sessions excluded)
    const sessRows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= ${start})::int AS sessions_current,
        COUNT(*) FILTER (WHERE ${inPrev})::int AS sessions_previous,
        COALESCE(SUM(minutes_used::numeric) FILTER (WHERE created_at >= ${start}), 0)::float AS minutes_current,
        COALESCE(SUM(minutes_used::numeric) FILTER (WHERE ${inPrev}), 0)::float AS minutes_previous,
        COUNT(DISTINCT workspace_id) FILTER (WHERE created_at >= ${start})::int AS active_current,
        COUNT(DISTINCT workspace_id) FILTER (WHERE ${inPrev})::int AS active_previous
      FROM translator_sessions
      WHERE is_training = false
        AND workspace_id IS DISTINCT FROM ${adminWs}
        AND created_at >= ${windowStart} AND created_at < ${now}
    `);
    const sess = sessRows.rows[0] as {
      sessions_current: number; sessions_previous: number;
      minutes_current: number; minutes_previous: number;
      active_current: number; active_previous: number;
    };

    // Signups
    const signupRows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= ${start})::int AS current,
        COUNT(*) FILTER (WHERE ${inPrev})::int AS previous
      FROM workspaces
      WHERE id IS DISTINCT FROM ${adminWs}
        AND created_at >= ${windowStart} AND created_at < ${now}
    `);
    const signups = signupRows.rows[0] as { current: number; previous: number };

    const marginOf = (rev: number, c: number) => rev > 0 ? (rev - c) / rev * 100 : 0;
    const marginCurrent = marginOf(revenue.current, cost.current);
    const marginPrevious = prevStart ? marginOf(revenue.previous, cost.previous) : null;

    // Charts (current window only)
    const revenueByBucket = await db.execute(sql`
      SELECT date_trunc(${grain}, created_at) AS bucket, SUM(ABS(amount_usd::numeric))::float AS value
      FROM deposit_transactions
      WHERE type IN ('usage', 'number_rental')
        AND workspace_id IS DISTINCT FROM ${adminWs}
        AND created_at >= ${start} AND created_at < ${now}
      GROUP BY 1 ORDER BY 1
    `);
    const signupsByBucket = await db.execute(sql`
      SELECT date_trunc(${grain}, created_at) AS bucket, COUNT(*)::int AS value
      FROM workspaces
      WHERE id IS DISTINCT FROM ${adminWs}
        AND created_at >= ${start} AND created_at < ${now}
      GROUP BY 1 ORDER BY 1
    `);

    // Activation funnel: cohort = workspaces created in the period,
    // events counted any time after signup
    const funnelRows = await db.execute(sql`
      SELECT COUNT(*)::int AS signed_up,
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM deposit_transactions dt WHERE dt.workspace_id = w.id AND dt.type = 'signup_bonus'))::int AS claimed_bonus,
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM translator_sessions ts WHERE ts.workspace_id = w.id AND ts.is_training = false))::int AS first_call,
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM deposit_transactions dt2 WHERE dt2.workspace_id = w.id AND dt2.type = 'topup'))::int AS first_topup,
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM telephony_connections tc WHERE tc.workspace_id = w.id AND tc.is_personal = true))::int AS bought_number
      FROM workspaces w
      WHERE w.id IS DISTINCT FROM ${adminWs}
        AND w.created_at >= ${start} AND w.created_at < ${now}
    `);
    const funnel = funnelRows.rows[0];

    // ── Health & alerts (fixed windows, independent of the period filter) ──

    const lowBalance = await db.execute(sql`
      SELECT id, name, owner_name, balance_usd::float AS balance_usd, phone_numbers
      FROM workspaces
      WHERE id IS DISTINCT FROM ${adminWs}
        AND balance_usd::numeric > 0 AND balance_usd::numeric <= 2
      ORDER BY balance_usd::numeric ASC LIMIT 10
    `);

    // Personal numbers that will be released at next renewal (balance < price)
    const numbersAtRisk = await db.execute(sql`
      SELECT tc.id, tc.phone_number, tc.next_renewal_at, tc.monthly_price_usd::float AS monthly_price_usd,
             w.id AS workspace_id, w.name AS workspace_name, w.owner_name, w.balance_usd::float AS balance_usd
      FROM telephony_connections tc
      JOIN workspaces w ON w.id = tc.workspace_id
      WHERE tc.is_personal = true AND tc.status = 'active' AND tc.auto_renew = true
        AND tc.workspace_id IS DISTINCT FROM ${adminWs}
        AND tc.next_renewal_at <= now() + interval '7 days'
        AND w.balance_usd::numeric < tc.monthly_price_usd::numeric
      ORDER BY tc.next_renewal_at ASC LIMIT 10
    `);

    // Translation quality: turns Grok failed to translate (last 7 days)
    const untranslatedRows = await db.execute(sql`
      SELECT COUNT(*)::int AS turns, COUNT(DISTINCT ts.id)::int AS sessions
      FROM translator_sessions ts, jsonb_array_elements(ts.transcript) turn
      WHERE ts.created_at >= now() - interval '7 days'
        AND ts.is_training = false
        AND ts.workspace_id IS DISTINCT FROM ${adminWs}
        AND jsonb_typeof(ts.transcript) = 'array'
        AND (turn->>'untranslated')::boolean IS TRUE
    `);
    const untranslated = untranslatedRows.rows[0] as { turns: number; sessions: number };

    const failedRows = await db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE status = 'failed')::int AS failed, COUNT(*)::int AS total
      FROM calls
      WHERE created_at >= now() - interval '7 days'
        AND workspace_id IS DISTINCT FROM ${adminWs}
    `);
    const failed = failedRows.rows[0] as { failed: number; total: number };

    const openTicketsRows = await db.execute(sql`SELECT COUNT(*)::int AS c FROM support_tickets WHERE status = 'open'`);
    const openTickets = (openTicketsRows.rows[0] as { c: number }).c;

    // Repeat signup-bonus attempts (phone already claimed the $2 gift)
    const repeatAttempts = await db.execute(sql`
      SELECT a.id, a.phone_number, a.source, a.created_at,
             a.workspace_id, w.name AS workspace_name, w.owner_name,
             b.claimed_by_workspace_id, cw.name AS claimed_by_name
      FROM bonus_claim_attempts a
      LEFT JOIN workspaces w ON w.id = a.workspace_id
      LEFT JOIN bonus_blocked_phones b ON b.phone_number = a.phone_number
      LEFT JOIN workspaces cw ON cw.id = b.claimed_by_workspace_id
      ORDER BY a.created_at DESC LIMIT 10
    `);

    // Recent client sessions (training + admin excluded)
    const recentSessions = await db.select().from(translatorSessions)
      .where(and(
        eq(translatorSessions.is_training, false),
        sql`${translatorSessions.workspace_id} IS DISTINCT FROM ${adminWs}`,
      ))
      .orderBy(desc(translatorSessions.created_at)).limit(10);

    const bucketRows = (rows: { bucket: string; value: number }[]) =>
      rows.map(r => ({ bucket: r.bucket, value: r.value }));

    return {
      period,
      granularity,
      kpi: {
        revenue: { current: revenue.current, previous: prevStart ? revenue.previous : null },
        provider_cost: { current: cost.current, previous: prevStart ? cost.previous : null },
        margin_percent: { current: marginCurrent, previous: marginPrevious },
        minutes: { current: sess.minutes_current, previous: prevStart ? sess.minutes_previous : null },
        sessions: { current: sess.sessions_current, previous: prevStart ? sess.sessions_previous : null },
        active_users: { current: sess.active_current, previous: prevStart ? sess.active_previous : null },
        signups: { current: signups.current, previous: prevStart ? signups.previous : null },
      },
      revenue_by_bucket: bucketRows(revenueByBucket.rows as any),
      signups_by_bucket: bucketRows(signupsByBucket.rows as any),
      funnel,
      health: {
        low_balance: lowBalance.rows,
        numbers_at_risk: numbersAtRisk.rows,
        untranslated_7d: untranslated,
        failed_calls_7d: failed,
        open_tickets: openTickets,
      },
      repeat_bonus_attempts: repeatAttempts.rows,
      recent_sessions: recentSessions,
    };
  });

  // ─── Dashboard live panel (polled ~30s) ───────────────────────────────
  app.get('/dashboard/live', async () => {
    const adminWs = await adminWorkspaceId();
    const { listActiveSessions } = await import('../../services/active-sessions.service.js');
    const sessions = await listActiveSessions();

    // Active calls are shown ALL (incl. admin test calls — it's line
    // monitoring, not a metric); today's counters exclude the admin.
    const wsIds = [...new Set(sessions.map(s => s.workspaceId))];
    const names = wsIds.length
      ? await db.select({ id: workspaces.id, name: workspaces.name, owner_name: workspaces.owner_name })
          .from(workspaces).where(inArray(workspaces.id, wsIds))
      : [];
    const nameMap = new Map(names.map(n => [n.id, n.owner_name || n.name]));

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const todayRows = await db.execute(sql`
      SELECT
        (SELECT COALESCE(SUM(ABS(amount_usd::numeric)), 0)::float FROM deposit_transactions
           WHERE type IN ('usage', 'number_rental') AND workspace_id IS DISTINCT FROM ${adminWs} AND created_at >= ${todayStart}) AS revenue,
        (SELECT COUNT(*)::int FROM translator_sessions
           WHERE is_training = false AND workspace_id IS DISTINCT FROM ${adminWs} AND created_at >= ${todayStart}) AS sessions,
        (SELECT COUNT(*)::int FROM workspaces
           WHERE id IS DISTINCT FROM ${adminWs} AND created_at >= ${todayStart}) AS signups,
        (SELECT COUNT(*)::int FROM support_tickets WHERE status = 'open') AS open_tickets,
        (SELECT COUNT(*)::int FROM contact_messages WHERE status = 'new') AS new_contacts
    `);
    const today = todayRows.rows[0] as {
      revenue: number; sessions: number; signups: number;
      open_tickets: number; new_contacts: number;
    };

    return {
      active: sessions.map(s => ({
        call_id: s.callId,
        workspace_id: s.workspaceId,
        workspace_name: nameMap.get(s.workspaceId) ?? null,
        is_admin: s.workspaceId === adminWs,
        type: s.type,
        started_at: s.startedAt,
        from_number: s.fromNumber ?? null,
        to_number: s.toNumber ?? null,
      })),
      active_count: sessions.length,
      today: { revenue: today.revenue, sessions: today.sessions, signups: today.signups },
      open_tickets: today.open_tickets,
      new_contacts: today.new_contacts,
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
      if (name === 'twilio') {
        const creds = await getProviderCredential(wsId, 'twilio');
        const twilio = (await import('twilio')).default;
        const client = twilio(creds.account_sid, creds.auth_token);
        await client.api.v2010.accounts(creds.account_sid).fetch();
        return { ok: true, message: 'Twilio connection successful' };
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
      flag: z.enum(['repeat_phone']).optional(),
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

    const attemptCount = sql<number>`(SELECT count(*)::int FROM bonus_claim_attempts a WHERE a.workspace_id = ${workspaces.id})`;
    if (q.flag === 'repeat_phone') conditions.push(sql`${attemptCount} > 0`);

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select({ ws: workspaces, repeat_phone_attempts: attemptCount })
      .from(workspaces)
      .where(where)
      .orderBy(desc(workspaces.created_at))
      .limit(q.limit).offset(q.offset);

    return rows.map(({ ws, repeat_phone_attempts }) => ({
      ...ws,
      balance_usd: parseFloat(ws.balance_usd as string) || 0,
      repeat_phone_attempts,
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

    const repeatAttempts = await db.execute(sql`
      SELECT a.id, a.phone_number, a.source, a.created_at,
             b.claimed_by_workspace_id, cw.name AS claimed_by_name
      FROM bonus_claim_attempts a
      LEFT JOIN bonus_blocked_phones b ON b.phone_number = a.phone_number
      LEFT JOIN workspaces cw ON cw.id = b.claimed_by_workspace_id
      WHERE a.workspace_id = ${id}
      ORDER BY a.created_at DESC LIMIT 20
    `);

    const { telephonyConnections } = await import('../../db/schema.js');
    const personalNumbers = await db.select({
      id: telephonyConnections.id,
      phone_number: telephonyConnections.phone_number,
      monthly_price_usd: telephonyConnections.monthly_price_usd,
      purchased_at: telephonyConnections.purchased_at,
      next_renewal_at: telephonyConnections.next_renewal_at,
      auto_renew: telephonyConnections.auto_renew,
      status: telephonyConnections.status,
      released_at: telephonyConnections.released_at,
    })
      .from(telephonyConnections)
      .where(and(
        eq(telephonyConnections.workspace_id, id),
        eq(telephonyConnections.is_personal, true),
      ))
      .orderBy(desc(telephonyConnections.purchased_at));

    return {
      workspace: { ...ws, balance_usd: parseFloat(ws.balance_usd as string) || 0 },
      transactions: transactions.map(t => ({
        ...t,
        amount_usd: parseFloat(t.amount_usd as string),
        balance_after: parseFloat(t.balance_after as string),
      })),
      repeat_phone_attempts: repeatAttempts.rows,
      personal_numbers: personalNumbers.map(n => ({
        ...n,
        monthly_price_usd: parseFloat((n.monthly_price_usd as string | null) ?? '0'),
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
  // The platform admin's own workspace is excluded everywhere — its service
  // balance and test usage are not business numbers. Period-aware: every
  // flow metric returns current + previous window for trends.
  app.get('/finance/overview', async (request) => {
    const { period } = z.object({
      period: z.enum(['today', '7d', '30d', 'year', 'all']).default('30d'),
    }).parse(request.query);

    const { now, start, prevStart, prevEnd } = resolvePeriod(period);
    const windowStart = prevStart ?? start;
    const adminWs = await adminWorkspaceId();
    const notAdminWs = sql`${workspaces.id} IS DISTINCT FROM ${adminWs}`;
    const inPrev = sql`created_at >= ${windowStart} AND created_at < ${prevEnd}`;

    // Flow metrics: deposits / usage revenue / rental revenue / refunds
    const flowRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(amount_usd::numeric) FILTER (WHERE type = 'topup' AND created_at >= ${start}), 0)::float AS deposits_current,
        COALESCE(SUM(amount_usd::numeric) FILTER (WHERE type = 'topup' AND ${inPrev}), 0)::float AS deposits_previous,
        COALESCE(SUM(ABS(amount_usd::numeric)) FILTER (WHERE type IN ('usage', 'number_rental') AND created_at >= ${start}), 0)::float AS revenue_current,
        COALESCE(SUM(ABS(amount_usd::numeric)) FILTER (WHERE type IN ('usage', 'number_rental') AND ${inPrev}), 0)::float AS revenue_previous,
        COALESCE(SUM(ABS(amount_usd::numeric)) FILTER (WHERE type = 'usage' AND created_at >= ${start}), 0)::float AS usage_current,
        COALESCE(SUM(ABS(amount_usd::numeric)) FILTER (WHERE type = 'number_rental' AND created_at >= ${start}), 0)::float AS rental_current
      FROM deposit_transactions
      WHERE workspace_id IS DISTINCT FROM ${adminWs}
        AND created_at >= ${windowStart} AND created_at < ${now}
    `);
    const flow = flowRows.rows[0] as {
      deposits_current: number; deposits_previous: number;
      revenue_current: number; revenue_previous: number;
      usage_current: number; rental_current: number;
    };

    // Real provider costs (from ai_call_sessions)
    const costRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(cost_total::numeric) FILTER (WHERE created_at >= ${start}), 0)::float AS current,
        COALESCE(SUM(cost_total::numeric) FILTER (WHERE ${inPrev}), 0)::float AS previous,
        COUNT(*) FILTER (WHERE created_at >= ${start})::int AS sessions_current
      FROM ai_call_sessions
      WHERE workspace_id IS DISTINCT FROM ${adminWs}
        AND created_at >= ${windowStart} AND created_at < ${now}
    `);
    const cost = costRows.rows[0] as { current: number; previous: number; sessions_current: number };

    // Top spenders in the period (usage + rental)
    const topSpenders = await db.execute(sql`
      SELECT dt.workspace_id, w.name AS workspace_name, w.owner_name,
             SUM(ABS(dt.amount_usd::numeric))::float AS spent
      FROM deposit_transactions dt
      LEFT JOIN workspaces w ON w.id = dt.workspace_id
      WHERE dt.type IN ('usage', 'number_rental')
        AND dt.workspace_id IS DISTINCT FROM ${adminWs}
        AND dt.created_at >= ${start} AND dt.created_at < ${now}
      GROUP BY dt.workspace_id, w.name, w.owner_name
      ORDER BY spent DESC LIMIT 5
    `);

    // Snapshots (period-independent)
    const [totalBalance] = await db.select({
      total: sum(workspaces.balance_usd),
    }).from(workspaces).where(notAdminWs);

    const [activeSubs] = await db.select({ count: count() }).from(workspaces)
      .where(and(eq(workspaces.subscription_status, 'active'), notAdminWs));

    const planCounts = await db.select({
      plan: workspaces.plan,
      count: count(),
    }).from(workspaces).where(notAdminWs).groupBy(workspaces.plan);

    const marginOf = (rev: number, c: number) => rev > 0 ? (rev - c) / rev * 100 : 0;
    const marginCurrent = marginOf(flow.revenue_current, cost.current);
    const marginPrevious = prevStart ? marginOf(flow.revenue_previous, cost.previous) : null;

    return {
      period,
      kpi: {
        deposits: { current: flow.deposits_current, previous: prevStart ? flow.deposits_previous : null },
        usage_revenue: { current: flow.revenue_current, previous: prevStart ? flow.revenue_previous : null },
        provider_cost: { current: cost.current, previous: prevStart ? cost.previous : null },
        margin_percent: { current: marginCurrent, previous: marginPrevious },
        total_deposit_balance: parseFloat(totalBalance.total ?? '0'),
        active_subscriptions: activeSubs.count,
        total_sessions: cost.sessions_current,
      },
      revenue_breakdown: { usage: flow.usage_current, number_rental: flow.rental_current },
      top_spenders: topSpenders.rows,
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

    // Admin's own transactions are not client finances — keep them out.
    const adminWs = await adminWorkspaceId();
    const conditions: any[] = [sql`${depositTransactions.workspace_id} IS DISTINCT FROM ${adminWs}`];
    if (q.type) conditions.push(eq(depositTransactions.type, q.type));
    if (q.workspace_id) conditions.push(eq(depositTransactions.workspace_id, q.workspace_id));

    const where = and(...conditions);

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
  app.get('/finance/revenue-chart', async (request) => {
    const { period } = z.object({
      period: z.enum(['today', '7d', '30d', 'year', 'all']).default('30d'),
    }).parse(request.query);

    const { now, start, granularity } = resolvePeriod(period);
    const adminWs = await adminWorkspaceId();
    const grain = sql.raw(`'${granularity}'`);

    const rows = await db.execute(sql`
      SELECT date_trunc(${grain}, created_at) as date,
        SUM(CASE WHEN type = 'topup' THEN amount_usd::numeric ELSE 0 END)::float as deposits,
        SUM(CASE WHEN type IN ('usage', 'number_rental') THEN ABS(amount_usd::numeric) ELSE 0 END)::float as usage_revenue
      FROM deposit_transactions
      WHERE created_at >= ${start} AND created_at < ${now}
        AND workspace_id IS DISTINCT FROM ${adminWs}
      GROUP BY 1
      ORDER BY 1
    `);

    return { granularity, rows: rows.rows };
  });

  // ─── GET /personal-numbers — all rented personal numbers ─────────────
  app.get('/personal-numbers', async (request) => {
    const q = z.object({
      status: z.enum(['active', 'released']).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query);

    const { telephonyConnections } = await import('../../db/schema.js');

    const conditions = [eq(telephonyConnections.is_personal, true)];
    if (q.status) conditions.push(eq(telephonyConnections.status, q.status));

    const rows = await db.select({
      id: telephonyConnections.id,
      phone_number: telephonyConnections.phone_number,
      monthly_price_usd: telephonyConnections.monthly_price_usd,
      purchased_at: telephonyConnections.purchased_at,
      next_renewal_at: telephonyConnections.next_renewal_at,
      auto_renew: telephonyConnections.auto_renew,
      status: telephonyConnections.status,
      released_at: telephonyConnections.released_at,
      workspace_id: telephonyConnections.workspace_id,
      workspace_name: workspaces.name,
      owner_name: workspaces.owner_name,
      balance_usd: workspaces.balance_usd,
    })
      .from(telephonyConnections)
      .leftJoin(workspaces, eq(workspaces.id, telephonyConnections.workspace_id))
      .where(and(...conditions))
      .orderBy(desc(telephonyConnections.purchased_at))
      .limit(q.limit).offset(q.offset);

    // Stats exclude the admin's own number (not business revenue)
    const adminWs = await adminWorkspaceId();
    const statsRows = await db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS active_count,
             COUNT(*) FILTER (WHERE status = 'released')::int AS released_count,
             COALESCE(SUM(monthly_price_usd) FILTER (WHERE status = 'active'), 0)::float AS mrr
      FROM telephony_connections
      WHERE is_personal = true
        AND workspace_id IS DISTINCT FROM ${adminWs}
    `);
    const stats = statsRows.rows[0] as { active_count: number; released_count: number; mrr: number };

    return {
      numbers: rows.map(r => ({
        ...r,
        monthly_price_usd: parseFloat((r.monthly_price_usd as string | null) ?? '0'),
        balance_usd: r.balance_usd != null ? parseFloat(r.balance_usd as string) : null,
      })),
      stats,
    };
  });

  // ─── GET /billing-settings ───────────────────────────────────────────
  app.get('/billing-settings', async () => {
    const keys = ['billing_markup', 'billing_low_balance_threshold', 'billing_signup_bonus_usd', 'billing_personal_number_monthly_usd'];

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

    const allowedKeys = ['billing_markup', 'billing_low_balance_threshold', 'billing_signup_bonus_usd', 'billing_personal_number_monthly_usd'];

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
