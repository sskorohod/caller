import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { db } from '../../config/db.js';
import { analyticsEvents, analyticsHeatmapPoints } from '../../db/schema.js';
import { env } from '../../config/env.js';

// First-party, anonymous site analytics ingestion. PUBLIC (serves the public
// site), rate-limited, never stores raw IP. Analytics must never break the site,
// so failures return 204 and are swallowed.

const s = (max: number) => z.string().max(max).optional().nullable();

const eventSchema = z.object({
  type: z.enum(['pageview', 'engage', 'click', 'scroll', 'signup', 'move']),
  path: z.string().min(1).max(512),
  referrer: s(1024),
  utm_source: s(256),
  utm_medium: s(256),
  utm_campaign: s(256),
  device: z.enum(['desktop', 'tablet', 'mobile']).optional().nullable(),
  viewport: z.enum(['desktop', 'tablet', 'mobile']).optional().nullable(),
  lang: s(16),
  active_ms: z.number().int().min(0).max(86_400_000).optional().nullable(),
  scroll_pct: z.number().int().min(0).max(100).optional().nullable(),
  element_label: s(256),
  element_selector: s(512),
  x_pct: z.number().int().min(0).max(10_000).optional().nullable(), // hundredths of a %
  y_px: z.number().int().min(0).max(1_000_000).optional().nullable(),
});

const batchSchema = z.object({
  visitor_id: z.string().min(1).max(64),
  session_id: z.string().min(1).max(64),
  events: z.array(eventSchema).min(1).max(50),
});

const BOT_UA = /bot|crawl|spider|slurp|bingpreview|headlesschrome|phantomjs|curl|wget|python-requests|axios|facebookexternalhit|preview/i;

function hashIp(req: FastifyRequest): string {
  return createHash('sha256').update(`${req.ip}|${env.ENCRYPTION_KEY}`).digest('hex').slice(0, 32);
}

const analyticsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/collect', {
    config: {
      rateLimit: {
        max: 120,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => request.ip,
      },
    },
  }, async (request, reply) => {
    // Drop obvious bots — keep the dataset human.
    const ua = (request.headers['user-agent'] as string | undefined) ?? '';
    if (!ua || BOT_UA.test(ua)) return reply.status(204).send();

    let body: z.infer<typeof batchSchema>;
    try {
      body = batchSchema.parse(request.body);
    } catch {
      return reply.status(204).send(); // never surface validation errors to the site
    }

    const ipHash = hashIp(request);

    const eventRows = body.events.filter((e) => e.type !== 'move').map((e) => ({
      visitor_id: body.visitor_id,
      session_id: body.session_id,
      type: e.type,
      path: e.path,
      referrer: e.referrer ?? null,
      utm_source: e.utm_source ?? null,
      utm_medium: e.utm_medium ?? null,
      utm_campaign: e.utm_campaign ?? null,
      device: e.device ?? null,
      viewport: e.viewport ?? null,
      lang: e.lang ?? null,
      active_ms: e.active_ms ?? null,
      scroll_pct: e.scroll_pct ?? null,
      element_label: e.element_label ?? null,
      element_selector: e.element_selector ?? null,
      ip_hash: ipHash,
    }));

    const heatmapRows = body.events
      .filter((e) => (e.type === 'click' || e.type === 'move') && e.x_pct != null && e.y_px != null)
      .map((e) => ({
        path: e.path,
        viewport: (e.viewport ?? e.device ?? 'desktop') as string,
        kind: e.type === 'move' ? 'move' : 'click',
        x_pct: e.x_pct as number,
        y_px: e.y_px as number,
      }));

    try {
      if (eventRows.length) await db.insert(analyticsEvents).values(eventRows);
      if (heatmapRows.length) await db.insert(analyticsHeatmapPoints).values(heatmapRows);
    } catch (err) {
      request.log.warn({ err }, 'analytics collect insert failed');
    }

    return reply.status(204).send();
  });
};

export default analyticsRoutes;
