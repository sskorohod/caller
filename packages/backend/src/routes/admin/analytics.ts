import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { authenticateUser, requireAdmin } from '../../middleware/auth.js';

// Admin-only read API for in-house site analytics. Self-gated (registered at
// /api/admin/analytics in server.ts). All aggregates are period-filtered by ?days.

const rows = (r: any): any[] => (r?.rows ?? r ?? []);
const daysOf = (q: any): number => Math.min(365, Math.max(1, parseInt(String(q?.days ?? '30'), 10) || 30));

const adminAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);
  app.addHook('onRequest', requireAdmin);

  // Headline KPIs.
  app.get('/overview', async (req) => {
    const d = daysOf(req.query);
    const r = await db.execute(sql`
      SELECT
        (SELECT count(*) FROM analytics_events WHERE type='pageview' AND created_at >= now()-make_interval(days=>${d}))::int AS pageviews,
        (SELECT count(DISTINCT visitor_id) FROM analytics_events WHERE type='pageview' AND created_at >= now()-make_interval(days=>${d}))::int AS visitors,
        (SELECT count(DISTINCT session_id) FROM analytics_events WHERE created_at >= now()-make_interval(days=>${d}))::int AS sessions,
        (SELECT count(DISTINCT visitor_id) FROM analytics_events WHERE created_at >= now()-interval '5 minutes')::int AS active_now,
        COALESCE((SELECT avg(active_ms) FROM analytics_events WHERE type='engage' AND created_at >= now()-make_interval(days=>${d})),0)::int AS avg_time_ms,
        COALESCE((SELECT avg(total) FROM (
          SELECT session_id, sum(active_ms) AS total FROM analytics_events
          WHERE type='engage' AND created_at >= now()-make_interval(days=>${d}) GROUP BY session_id
        ) s),0)::int AS avg_session_ms
    `);
    return rows(r)[0] ?? {};
  });

  // Visits over time (daily).
  app.get('/timeseries', async (req) => {
    const d = daysOf(req.query);
    const r = await db.execute(sql`
      SELECT to_char(date_trunc('day', created_at),'YYYY-MM-DD') AS day,
        count(*) FILTER (WHERE type='pageview')::int AS pageviews,
        count(DISTINCT visitor_id) FILTER (WHERE type='pageview')::int AS visitors
      FROM analytics_events
      WHERE created_at >= now()-make_interval(days=>${d})
      GROUP BY 1 ORDER BY 1
    `);
    return { series: rows(r) };
  });

  // Top pages with attention signals (time + scroll depth).
  app.get('/pages', async (req) => {
    const d = daysOf(req.query);
    const r = await db.execute(sql`
      SELECT path,
        count(*) FILTER (WHERE type='pageview')::int AS views,
        count(DISTINCT visitor_id) FILTER (WHERE type='pageview')::int AS visitors,
        COALESCE(avg(active_ms) FILTER (WHERE type='engage'),0)::int AS avg_time_ms,
        COALESCE(avg(scroll_pct) FILTER (WHERE type='scroll'),0)::int AS avg_scroll
      FROM analytics_events
      WHERE created_at >= now()-make_interval(days=>${d})
      GROUP BY path
      HAVING count(*) FILTER (WHERE type='pageview') > 0
      ORDER BY views DESC LIMIT 30
    `);
    return { pages: rows(r) };
  });

  // Top clicked elements (which buttons/links, on which page).
  app.get('/clicks', async (req) => {
    const d = daysOf(req.query);
    const r = await db.execute(sql`
      SELECT element_label, path, count(*)::int AS clicks
      FROM analytics_events
      WHERE type='click' AND element_label IS NOT NULL AND element_label <> ''
        AND created_at >= now()-make_interval(days=>${d})
      GROUP BY element_label, path ORDER BY clicks DESC LIMIT 50
    `);
    return { clicks: rows(r) };
  });

  // Traffic sources (UTM source else referrer host else direct).
  app.get('/sources', async (req) => {
    const d = daysOf(req.query);
    const r = await db.execute(sql`
      SELECT COALESCE(
               NULLIF(utm_source,''),
               NULLIF(split_part(regexp_replace(referrer,'^https?://',''),'/',1),''),
               'direct'
             ) AS source,
             count(DISTINCT visitor_id)::int AS visitors
      FROM analytics_events
      WHERE type='pageview' AND created_at >= now()-make_interval(days=>${d})
      GROUP BY 1 ORDER BY visitors DESC LIMIT 30
    `);
    return { sources: rows(r) };
  });

  // Device split.
  app.get('/devices', async (req) => {
    const d = daysOf(req.query);
    const r = await db.execute(sql`
      SELECT COALESCE(NULLIF(device,''),'unknown') AS device, count(DISTINCT visitor_id)::int AS visitors
      FROM analytics_events
      WHERE type='pageview' AND created_at >= now()-make_interval(days=>${d})
      GROUP BY 1 ORDER BY visitors DESC
    `);
    return { devices: rows(r) };
  });

  // Signup funnel: any visitor → reached /login → signed up.
  app.get('/funnel', async (req) => {
    const d = daysOf(req.query);
    const r = await db.execute(sql`
      SELECT
        (SELECT count(DISTINCT visitor_id) FROM analytics_events WHERE type='pageview' AND created_at >= now()-make_interval(days=>${d}))::int AS visitors,
        (SELECT count(DISTINCT visitor_id) FROM analytics_events WHERE type='pageview' AND path='/login' AND created_at >= now()-make_interval(days=>${d}))::int AS reached_login,
        (SELECT count(DISTINCT visitor_id) FROM analytics_events WHERE type='signup' AND created_at >= now()-make_interval(days=>${d}))::int AS signed_up
    `);
    return rows(r)[0] ?? { visitors: 0, reached_login: 0, signed_up: 0 };
  });

  // Heatmap data for one page+viewport: click points + scroll distribution.
  app.get('/heatmap', async (req) => {
    const q = z.object({
      path: z.string().min(1).max(512),
      viewport: z.enum(['desktop', 'tablet', 'mobile']).optional().default('desktop'),
      days: z.coerce.number().int().min(1).max(365).optional().default(30),
    }).parse(req.query);
    const pts = await db.execute(sql`
      SELECT x_pct, y_px FROM analytics_heatmap_points
      WHERE path=${q.path} AND viewport=${q.viewport} AND created_at >= now()-make_interval(days=>${q.days})
      LIMIT 20000
    `);
    const scroll = await db.execute(sql`
      SELECT scroll_pct, count(*)::int AS c FROM analytics_events
      WHERE type='scroll' AND path=${q.path} AND created_at >= now()-make_interval(days=>${q.days})
      GROUP BY scroll_pct ORDER BY scroll_pct
    `);
    return { points: rows(pts), scroll: rows(scroll) };
  });

  // Distinct tracked paths (for the heatmap page picker).
  app.get('/paths', async (req) => {
    const d = daysOf(req.query);
    const r = await db.execute(sql`
      SELECT path, count(*) FILTER (WHERE type='pageview')::int AS views
      FROM analytics_events
      WHERE created_at >= now()-make_interval(days=>${d})
      GROUP BY path HAVING count(*) FILTER (WHERE type='pageview') > 0
      ORDER BY views DESC LIMIT 100
    `);
    return { paths: rows(r) };
  });
};

export default adminAnalyticsRoutes;
