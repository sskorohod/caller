import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { db } from '../../config/db.js';
import { translatorSubscribers, translatorSessions } from '../../db/schema.js';

const createSchema = z.object({
  phone_number: z.string().min(7).max(20),
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  my_language: z.string().min(2).max(10).default('ru'),
  target_language: z.string().min(2).max(10).default('en'),
  mode: z.enum(['voice', 'text', 'both']).default('voice'),
  who_hears: z.enum(['subscriber', 'both']).default('subscriber'),
  greeting_text: z.string().max(500).optional(),
  tts_provider: z.enum(['elevenlabs', 'openai', 'xai']).default('elevenlabs'),
  tts_voice_id: z.string().max(100).optional(),
  telegram_chat_id: z.string().max(50).optional(),
  balance_minutes: z.number().min(0).optional(),
  enabled: z.boolean().default(true),
});

const updateSchema = createSchema.partial();

const translatorRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // GET /api/translator/subscribers
  app.get('/subscribers', async (request) => {
    const rows = await db
      .select()
      .from(translatorSubscribers)
      .where(eq(translatorSubscribers.workspace_id, request.auth.workspaceId))
      .orderBy(translatorSubscribers.created_at);
    return { subscribers: rows };
  });

  // POST /api/translator/subscribers
  app.post('/subscribers', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const body = createSchema.parse(request.body);
    const [row] = await db
      .insert(translatorSubscribers)
      .values({
        workspace_id: request.auth.workspaceId,
        ...body,
        balance_minutes: body.balance_minutes != null ? String(body.balance_minutes) : '0',
      })
      .returning();
    reply.status(201);
    return row;
  });

  // GET /api/translator/subscribers/:id
  app.get('/subscribers/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const [row] = await db
      .select()
      .from(translatorSubscribers)
      .where(
        and(
          eq(translatorSubscribers.id, id),
          eq(translatorSubscribers.workspace_id, request.auth.workspaceId),
        ),
      );
    if (!row) {
      throw { statusCode: 404, message: 'Subscriber not found' };
    }
    return row;
  });

  // PUT /api/translator/subscribers/:id
  app.put('/subscribers/:id', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = updateSchema.parse(request.body);
    const values: Record<string, unknown> = { ...body, updated_at: new Date() };
    if (body.balance_minutes != null) {
      values.balance_minutes = String(body.balance_minutes);
    }
    const [row] = await db
      .update(translatorSubscribers)
      .set(values)
      .where(
        and(
          eq(translatorSubscribers.id, id),
          eq(translatorSubscribers.workspace_id, request.auth.workspaceId),
        ),
      )
      .returning();
    if (!row) {
      throw { statusCode: 404, message: 'Subscriber not found' };
    }
    return row;
  });

  // DELETE /api/translator/subscribers/:id
  app.delete('/subscribers/:id', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const [row] = await db
      .delete(translatorSubscribers)
      .where(
        and(
          eq(translatorSubscribers.id, id),
          eq(translatorSubscribers.workspace_id, request.auth.workspaceId),
        ),
      )
      .returning();
    if (!row) {
      throw { statusCode: 404, message: 'Subscriber not found' };
    }
    reply.status(204);
  });

  // GET /api/translator/sessions — history for workspace
  app.get('/sessions', async (request) => {
    const query = z.object({
      subscriber_id: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query);

    let conditions = eq(translatorSessions.workspace_id, request.auth.workspaceId);
    if (query.subscriber_id) {
      conditions = and(conditions, eq(translatorSessions.subscriber_id, query.subscriber_id))!;
    }

    const rows = await db
      .select()
      .from(translatorSessions)
      .where(conditions)
      .orderBy(translatorSessions.created_at)
      .limit(query.limit)
      .offset(query.offset);

    return { sessions: rows };
  });

  // GET /api/translator/subscribers/by-phone/:phone — lookup by phone (used by inbound webhook)
  app.get('/subscribers/by-phone/:phone', async (request) => {
    const { phone } = z.object({ phone: z.string() }).parse(request.params);
    const normalized = phone.replace(/[\s\-\(\)\+]/g, '');
    const [row] = await db
      .select()
      .from(translatorSubscribers)
      .where(
        and(
          eq(translatorSubscribers.phone_number, normalized),
          eq(translatorSubscribers.workspace_id, request.auth.workspaceId),
          eq(translatorSubscribers.enabled, true),
        ),
      );
    return row ?? null;
  });
};

export default translatorRoutes;
