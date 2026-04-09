import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { db } from '../../config/db.js';
import { translatorSessions, workspaces, telephonyConnections } from '../../db/schema.js';

const translatorRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // GET /api/translator/phone — get the phone number to call for translator
  app.get('/phone', async (request) => {
    const [own] = await db.select({ phone_number: telephonyConnections.phone_number })
      .from(telephonyConnections)
      .where(and(
        eq(telephonyConnections.workspace_id, request.auth.workspaceId),
        eq(telephonyConnections.ai_answering_enabled, true),
      ))
      .limit(1);
    if (own) return { phone_number: own.phone_number };

    // Fallback: platform connection
    const [platform] = await db.select({ phone_number: telephonyConnections.phone_number })
      .from(telephonyConnections)
      .where(eq(telephonyConnections.ai_answering_enabled, true))
      .limit(1);
    return { phone_number: platform?.phone_number || null };
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
      who_hears: z.enum(['subscriber', 'both']).optional(),
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
