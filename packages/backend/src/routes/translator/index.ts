import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { db } from '../../config/db.js';
import { translatorSessions, workspaces, telephonyConnections } from '../../db/schema.js';
import { getMarkup } from '../../services/billing.service.js';

const translatorRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // GET /api/translator/phone — the number to call for the translator.
  // A workspace's own personal (rented) number wins; otherwise the shared
  // platform number (the admin's connection).
  app.get('/phone', async (request) => {
    const { getPersonalNumber } = await import('../../services/personal-number.service.js');
    const personal = await getPersonalNumber(request.auth.workspaceId);
    if (personal) return { phone_number: personal.phone_number, is_personal: true };

    const { getAdminWorkspaceId } = await import('../../services/credential-resolver.service.js');
    const adminWs = await getAdminWorkspaceId().catch(() => null);
    if (!adminWs) return { phone_number: null, is_personal: false };
    const [conn] = await db.select({ phone_number: telephonyConnections.phone_number })
      .from(telephonyConnections)
      .where(and(
        eq(telephonyConnections.workspace_id, adminWs),
        eq(telephonyConnections.ai_answering_enabled, true),
      ))
      .limit(1);
    return { phone_number: conn?.phone_number || null, is_personal: false };
  });

  // GET /api/translator/sessions — history for workspace
  app.get('/sessions', async (request) => {
    const query = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query);

    const rows = await db
      .select()
      .from(translatorSessions)
      .where(eq(translatorSessions.workspace_id, request.auth.workspaceId))
      .orderBy(desc(translatorSessions.created_at))
      .limit(query.limit)
      .offset(query.offset);

    return { sessions: rows };
  });

  // GET /api/translator/usage?period=7d|30d|all — aggregated usage report
  // Costs are client-facing (provider cost × markup), matching what was charged.
  app.get('/usage', async (request) => {
    const { period } = z.object({ period: z.enum(['7d', '30d', 'all']).default('30d') }).parse(request.query);
    const now = Date.now();
    const start = period === '7d' ? new Date(now - 7 * 86400000)
      : period === '30d' ? new Date(now - 30 * 86400000)
      : null;

    const conds = [
      eq(translatorSessions.workspace_id, request.auth.workspaceId),
      eq(translatorSessions.is_training, false),
      eq(translatorSessions.status, 'completed'),
    ];
    if (start) conds.push(gte(translatorSessions.created_at, start));

    const [rows, markup] = await Promise.all([
      db.select({
        id: translatorSessions.id,
        call_id: translatorSessions.call_id,
        duration_seconds: translatorSessions.duration_seconds,
        minutes_used: translatorSessions.minutes_used,
        cost_usd: translatorSessions.cost_usd,
        transcript: translatorSessions.transcript,
        created_at: translatorSessions.created_at,
      }).from(translatorSessions).where(and(...conds)).orderBy(desc(translatorSessions.created_at)),
      getMarkup().catch(() => 1),
    ]);

    const countWords = (s: unknown) => typeof s === 'string' && s.trim() ? s.trim().split(/\s+/).length : 0;
    let totalCost = 0, totalMinutes = 0, totalWords = 0;
    const dailyMap = new Map<string, { cost: number; calls: number }>();

    const sessions = rows.map(r => {
      const cost = (Number(r.cost_usd) || 0) * markup;
      const minutes = Number(r.minutes_used) || (Number(r.duration_seconds) || 0) / 60;
      let words = 0;
      const turns = Array.isArray(r.transcript) ? r.transcript as Array<{ translated?: string }> : [];
      for (const turn of turns) words += countWords(turn?.translated);
      totalCost += cost; totalMinutes += minutes; totalWords += words;
      const day = r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '';
      const d = dailyMap.get(day) || { cost: 0, calls: 0 };
      d.cost += cost; d.calls += 1; dailyMap.set(day, d);
      return {
        id: r.id,
        call_id: r.call_id,
        created_at: r.created_at,
        duration_seconds: r.duration_seconds || 0,
        cost_usd: Math.round(cost * 10000) / 10000,
        words,
      };
    });

    const calls = sessions.length;
    const daily = [...dailyMap.entries()]
      .map(([date, v]) => ({ date, cost: Math.round(v.cost * 100) / 100, calls: v.calls }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period,
      totals: {
        calls,
        minutes: Math.round(totalMinutes * 10) / 10,
        cost: Math.round(totalCost * 100) / 100,
        avgCost: calls ? Math.round((totalCost / calls) * 100) / 100 : 0,
        words: totalWords,
      },
      daily,
      sessions: sessions.slice(0, 50),
    };
  });

  // GET /api/translator/line-status — is the translator line free or busy right now?
  // Personal-number owners have their own line: only their sessions count.
  // The shared platform number counts active (non-training) sessions
  // platform-wide, excluding sessions running on personal numbers.
  app.get('/line-status', async (request) => {
    const { getPersonalNumber } = await import('../../services/personal-number.service.js');
    const personal = await getPersonalNumber(request.auth.workspaceId);

    if (personal) {
      // Only sessions running ON the personal number — a session the owner
      // started via the shared platform line must not mark this line busy.
      const rows = await db.execute(sql`
        SELECT COUNT(*)::int AS active
        FROM translator_sessions ts
        JOIN calls c ON c.id = ts.call_id
        WHERE c.telephony_connection_id = ${personal.id}
          AND ts.status = 'active'
          AND ts.is_training = false
          AND ts.created_at > now() - interval '2 hours'
      `);
      const active = (rows.rows[0] as { active: number } | undefined)?.active ?? 0;
      return { busy: active > 0, mine: active > 0, active_count: active, personal: true };
    }

    const rows = await db.execute(sql`
      SELECT COUNT(*)::int AS active,
             SUM(CASE WHEN ts.workspace_id = ${request.auth.workspaceId} THEN 1 ELSE 0 END)::int AS mine
      FROM translator_sessions ts
      LEFT JOIN calls c ON c.id = ts.call_id
      LEFT JOIN telephony_connections tc ON tc.id = c.telephony_connection_id
      WHERE ts.status = 'active'
        AND ts.is_training = false
        AND ts.created_at > now() - interval '2 hours'
        AND COALESCE(tc.is_personal, false) = false
    `);
    const r = rows.rows[0] as { active: number; mine: number } | undefined;
    const active = r?.active ?? 0;
    const mine = (r?.mine ?? 0) > 0;
    return { busy: active > 0, mine, active_count: active, personal: false };
  });

  // GET /api/translator/sessions/active — active sessions for live monitor
  app.get('/sessions/active', async (request) => {
    const rows = await db
      .select({
        id: translatorSessions.id,
        call_id: translatorSessions.call_id,
        duration_seconds: translatorSessions.duration_seconds,
        created_at: translatorSessions.created_at,
      })
      .from(translatorSessions)
      .where(
        and(
          eq(translatorSessions.workspace_id, request.auth.workspaceId),
          eq(translatorSessions.status, 'active'),
        ),
      )
      .orderBy(desc(translatorSessions.created_at));
    return { sessions: rows };
  });

  // GET /api/translator/defaults — workspace-level translator settings
  app.get('/defaults', async (request) => {
    const [ws] = await db.select({ translator_defaults: workspaces.translator_defaults })
      .from(workspaces)
      .where(eq(workspaces.id, request.auth.workspaceId));
    // greeting_text_default = the platform-wide greeting used on calls when
    // the workspace hasn't set its own — the dashboard pre-fills from it so
    // what the user sees matches what the call actually says.
    const { getStringSetting } = await import('../../services/platform-settings.service.js');
    const { DEFAULT_GREETING } = await import('../../services/conference-translator.js');
    const greetingDefault = await getStringSetting('default_greeting', DEFAULT_GREETING).catch(() => DEFAULT_GREETING);
    return { ...(ws?.translator_defaults as Record<string, unknown> || {}), greeting_text_default: greetingDefault };
  });

  // PUT /api/translator/defaults — update workspace-level translator settings
  app.put('/defaults', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const body = z.object({
      greeting_text: z.string().max(500).optional(),
      greeting_delay_seconds: z.number().int().min(0).max(30).optional(),
      tts_voice_id: z.string().max(100).optional(),
      tone: z.enum(['neutral', 'business', 'friendly', 'medical', 'legal', 'intelligent']).optional(),
      personal_context: z.string().max(2000).optional(),
      my_language: z.string().min(2).max(10).optional(),
      target_language: z.string().min(2).max(10).optional(),
      translation_mode: z.enum(['bidirectional', 'unidirectional']).optional(),
      who_hears: z.enum(['subscriber', 'both']).optional(),
    }).parse(request.body);

    const [ws] = await db.select({ translator_defaults: workspaces.translator_defaults })
      .from(workspaces)
      .where(eq(workspaces.id, request.auth.workspaceId));
    const current = (ws?.translator_defaults as Record<string, unknown>) || {};
    const merged = { ...current, ...body } as Record<string, unknown>;

    // Always persist a language pair so the live translator never ends up with
    // my_language === target_language (which makes Grok just echo the input).
    if (!merged.my_language) merged.my_language = 'ru';
    if (!merged.target_language) merged.target_language = 'en';
    if (merged.my_language === merged.target_language) {
      merged.target_language = merged.my_language === 'en' ? 'ru' : 'en';
    }

    const updated = merged;

    await db.update(workspaces)
      .set({ translator_defaults: updated, updated_at: new Date() })
      .where(eq(workspaces.id, request.auth.workspaceId));

    return updated;
  });
};

export default translatorRoutes;
