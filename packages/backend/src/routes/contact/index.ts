import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../../config/db.js';
import { contactMessages } from '../../db/schema.js';
import { eq, desc, count, sql } from 'drizzle-orm';
import { authenticateUser, requireRole } from '../../middleware/auth.js';

// Simple in-memory rate limiter by IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 3; // max 3 messages per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 300_000); // every 5 minutes

const contactRoutes: FastifyPluginAsync = async (app) => {
  // ── Public: Submit contact message (no auth) ─────────────
  app.post('/', async (request, reply) => {
    const body = z.object({
      name: z.string().min(1).max(100),
      email: z.string().email().max(200),
      subject: z.string().min(1).max(200),
      message: z.string().min(10).max(5000),
      // Honeypot — must be empty
      website: z.string().max(0).optional().default(''),
      // Simple math challenge
      challenge_answer: z.number(),
      challenge_expected: z.number(),
    }).parse(request.body);

    // Honeypot check
    if (body.website && body.website.length > 0) {
      // Bot detected — return success silently
      return reply.status(201).send({ ok: true });
    }

    // Math challenge check
    if (body.challenge_answer !== body.challenge_expected) {
      return reply.status(400).send({ error: 'Incorrect verification answer' });
    }

    // Rate limit by IP
    const ip = request.ip || request.headers['x-forwarded-for']?.toString() || 'unknown';
    if (!checkRateLimit(ip)) {
      return reply.status(429).send({ error: 'Too many messages. Please try again in a minute.' });
    }

    const [msg] = await db.insert(contactMessages).values({
      name: body.name,
      email: body.email,
      subject: body.subject,
      message: body.message,
      ip_address: ip,
    }).returning();

    return reply.status(201).send({ ok: true, id: msg.id });
  });

  // ── Admin: List contact messages ──────────────────────────
  app.get('/admin/all', {
    preHandler: [authenticateUser, requireRole('owner')],
  }, async (request) => {
    const query = z.object({
      status: z.string().optional(),
      limit: z.coerce.number().min(1).max(100).optional().default(50),
      offset: z.coerce.number().min(0).optional().default(0),
    }).parse(request.query);

    const conditions = [];
    if (query.status) {
      conditions.push(eq(contactMessages.status, query.status));
    }

    const where = conditions.length > 0 ? conditions[0] : undefined;

    const [messages, [totalRow]] = await Promise.all([
      db.select()
        .from(contactMessages)
        .where(where)
        .orderBy(desc(contactMessages.created_at))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ total: count() })
        .from(contactMessages)
        .where(where),
    ]);

    return { messages, total: totalRow?.total ?? 0 };
  });

  // ── Admin: Update message status ──────────────────────────
  app.patch<{ Params: { id: string } }>('/admin/:id/status', {
    preHandler: [authenticateUser, requireRole('owner')],
  }, async (request, reply) => {
    const { id } = request.params;
    const body = z.object({
      status: z.enum(['new', 'read', 'archived']),
    }).parse(request.body);

    const [updated] = await db.update(contactMessages)
      .set({ status: body.status })
      .where(eq(contactMessages.id, id))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Message not found' });
    return updated;
  });

  // ── Admin: Delete message ─────────────────────────────────
  app.delete<{ Params: { id: string } }>('/admin/:id', {
    preHandler: [authenticateUser, requireRole('owner')],
  }, async (request, reply) => {
    const { id } = request.params;
    const [deleted] = await db.delete(contactMessages)
      .where(eq(contactMessages.id, id))
      .returning({ id: contactMessages.id });

    if (!deleted) return reply.status(404).send({ error: 'Message not found' });
    return { ok: true };
  });
};

export default contactRoutes;
