import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { db } from '../../config/db.js';
import { translatorSubscribers, translatorSessions, balanceTransactions, workspaces, telephonyConnections } from '../../db/schema.js';

const DEFAULT_GREETINGS: Record<string, string> = {
  ru: 'Здравствуйте, я ваш живой переводчик. Я буду переводить этот разговор.',
  en: 'Hello, I am your live translator. I will be translating this conversation.',
  es: 'Hola, soy su traductor en vivo. Estaré traduciendo esta conversación.',
  de: 'Hallo, ich bin Ihr Live-Übersetzer. Ich werde dieses Gespräch übersetzen.',
  fr: 'Bonjour, je suis votre traducteur en direct. Je vais traduire cette conversation.',
};

const createSchema = z.object({
  phone_number: z.string().min(7).max(20),
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  my_language: z.string().min(2).max(10).default('ru'),
  target_language: z.string().min(2).max(10).default('en'),
  mode: z.enum(['voice', 'text', 'both']).default('voice'),
  who_hears: z.enum(['subscriber', 'both']).default('subscriber'),
  translation_mode: z.enum(['bidirectional', 'unidirectional']).default('bidirectional'),
  tone: z.enum(['neutral', 'business', 'friendly', 'medical', 'legal']).default('business'),
  personal_context: z.string().max(2000).optional(),
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

  // GET /api/translator/phone — get the phone number to call for translator
  // Returns own workspace connection first, falls back to platform connection
  app.get('/phone', async (request) => {
    // Try own workspace telephony connection
    const [own] = await db.select({ phone_number: telephonyConnections.phone_number })
      .from(telephonyConnections)
      .where(and(
        eq(telephonyConnections.workspace_id, request.auth.workspaceId),
        eq(telephonyConnections.ai_answering_enabled, true),
      ))
      .limit(1);
    if (own) return { phone_number: own.phone_number };

    // Fallback: platform connection (any workspace with ai_answering_enabled)
    const [platform] = await db.select({ phone_number: telephonyConnections.phone_number })
      .from(telephonyConnections)
      .where(eq(telephonyConnections.ai_answering_enabled, true))
      .limit(1);
    return { phone_number: platform?.phone_number || null };
  });

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
    // Greeting is heard by the OTHER party, so use target_language
    const greeting = body.greeting_text || DEFAULT_GREETINGS[body.target_language] || DEFAULT_GREETINGS.en;
    const [row] = await db
      .insert(translatorSubscribers)
      .values({
        workspace_id: request.auth.workspaceId,
        ...body,
        greeting_text: greeting,
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

  // GET /api/translator/sessions/active — active sessions for live monitor
  app.get('/sessions/active', async (request) => {
    const rows = await db
      .select({
        id: translatorSessions.id,
        subscriber_id: translatorSessions.subscriber_id,
        call_id: translatorSessions.call_id,
        duration_seconds: translatorSessions.duration_seconds,
        created_at: translatorSessions.created_at,
        subscriber_name: translatorSubscribers.name,
        subscriber_phone: translatorSubscribers.phone_number,
      })
      .from(translatorSessions)
      .innerJoin(translatorSubscribers, eq(translatorSubscribers.id, translatorSessions.subscriber_id))
      .where(
        and(
          eq(translatorSessions.workspace_id, request.auth.workspaceId),
          eq(translatorSessions.status, 'active'),
        ),
      )
      .orderBy(desc(translatorSessions.created_at));
    return { sessions: rows };
  });

  // POST /api/translator/subscribers/:id/balance — adjust subscriber balance
  app.post('/subscribers/:id/balance', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      minutes: z.number(),
      type: z.enum(['topup', 'gift', 'refund']),
      comment: z.string().optional(),
    }).parse(request.body);

    // Verify subscriber belongs to workspace
    const [sub] = await db.select().from(translatorSubscribers)
      .where(and(eq(translatorSubscribers.id, id), eq(translatorSubscribers.workspace_id, request.auth.workspaceId)));
    if (!sub) throw { statusCode: 404, message: 'Subscriber not found' };

    // Update balance
    const [updated] = await db.update(translatorSubscribers)
      .set({ balance_minutes: sql`balance_minutes + ${String(body.minutes)}::numeric`, updated_at: new Date() })
      .where(eq(translatorSubscribers.id, id))
      .returning({ balance_minutes: translatorSubscribers.balance_minutes });

    // Record transaction
    await db.insert(balanceTransactions).values({
      subscriber_id: id,
      type: body.type,
      minutes: String(body.minutes),
      comment: body.comment || `Admin ${body.type}`,
      admin_user_id: request.auth.userId,
    });

    return { success: true, new_balance: parseFloat(updated.balance_minutes as string) };
  });

  // GET /api/translator/subscribers/:id/transactions — balance history
  app.get('/subscribers/:id/transactions', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    // Verify subscriber belongs to workspace
    const [sub] = await db.select({ id: translatorSubscribers.id }).from(translatorSubscribers)
      .where(and(eq(translatorSubscribers.id, id), eq(translatorSubscribers.workspace_id, request.auth.workspaceId)));
    if (!sub) throw { statusCode: 404, message: 'Subscriber not found' };

    const rows = await db.select().from(balanceTransactions)
      .where(eq(balanceTransactions.subscriber_id, id))
      .orderBy(desc(balanceTransactions.created_at))
      .limit(100);

    return { transactions: rows.map(t => ({ ...t, minutes: parseFloat(t.minutes as string) })) };
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

  // GET /api/translator/defaults — workspace-level translator settings
  app.get('/defaults', async (request) => {
    const [ws] = await db.select({ translator_defaults: workspaces.translator_defaults })
      .from(workspaces)
      .where(eq(workspaces.id, request.auth.workspaceId));
    return ws?.translator_defaults || {};
  });

  // PUT /api/translator/defaults — update workspace-level translator settings
  app.put('/defaults', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const body = z.object({
      greeting_text: z.string().max(500).optional(),
      tts_voice_id: z.string().max(100).optional(),
      tone: z.enum(['neutral', 'business', 'friendly', 'medical', 'legal']).optional(),
      personal_context: z.string().max(2000).optional(),
      my_language: z.string().min(2).max(10).optional(),
      target_language: z.string().min(2).max(10).optional(),
      translation_mode: z.enum(['bidirectional', 'unidirectional']).optional(),
    }).parse(request.body);

    const [ws] = await db.select({ translator_defaults: workspaces.translator_defaults })
      .from(workspaces)
      .where(eq(workspaces.id, request.auth.workspaceId));
    const current = (ws?.translator_defaults as Record<string, unknown>) || {};
    const updated = { ...current, ...body };

    await db.update(workspaces)
      .set({ translator_defaults: updated, updated_at: new Date() })
      .where(eq(workspaces.id, request.auth.workspaceId));

    return updated;
  });
};

export default translatorRoutes;
