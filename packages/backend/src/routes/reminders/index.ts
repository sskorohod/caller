import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser } from '../../middleware/auth.js';
import * as reminderService from '../../services/reminder.service.js';

/**
 * Reminders REST API — workspace-scoped (request.auth.workspaceId).
 * The Telegram chat id for new dashboard-created reminders is resolved
 * from the workspace's telegram provider credential.
 */
const reminderRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // GET /api/reminders — list (optionally ?status=pending|done|cancelled)
  app.get('/', async (request) => {
    const { status } = z.object({ status: z.string().optional() }).parse(request.query);
    const items = await reminderService.listReminders(request.auth.workspaceId, status);
    return { reminders: items };
  });

  // POST /api/reminders — create from the dashboard
  app.post('/', async (request, reply) => {
    const body = z.object({
      text: z.string().min(1).max(500),
      remind_at: z.string(), // ISO
      recurrence: z.enum(['daily', 'weekdays', 'weekly']).nullable().optional(),
      timezone: z.string().optional(),
    }).parse(request.body);

    const remindAt = new Date(body.remind_at);
    if (isNaN(remindAt.getTime())) {
      return reply.status(400).send({ error: 'Invalid remind_at' });
    }

    // Resolve the workspace's Telegram chat for notification delivery.
    const { db } = await import('../../config/db.js');
    const { providerCredentials } = await import('../../db/schema.js');
    const { eq } = await import('drizzle-orm');
    const { decrypt } = await import('../../lib/crypto.js');
    const creds = await db.select({ provider: providerCredentials.provider, credential_data: providerCredentials.credential_data })
      .from(providerCredentials).where(eq(providerCredentials.workspace_id, request.auth.workspaceId));
    let chatId = '';
    let tz = body.timezone || 'America/Los_Angeles';
    for (const c of creds) {
      if (c.provider !== 'telegram') continue;
      try {
        const parsed = JSON.parse(decrypt(c.credential_data)) as { chat_id?: string };
        if (parsed.chat_id) chatId = parsed.chat_id;
      } catch { /* skip */ }
    }
    if (!chatId) {
      return reply.status(400).send({ error: 'Telegram is not connected for this workspace' });
    }

    const row = await reminderService.createReminder({
      workspaceId: request.auth.workspaceId,
      chatId,
      text: body.text,
      remindAt,
      timezone: tz,
      recurrence: body.recurrence ?? null,
    });
    reply.status(201);
    return { reminder: row };
  });

  // PATCH /api/reminders/:id — snooze / complete
  app.patch('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      action: z.enum(['snooze', 'complete']),
      snooze_minutes: z.number().optional(),
    }).parse(request.body);

    const existing = await reminderService.getReminder(id, request.auth.workspaceId);
    if (!existing) return reply.status(404).send({ error: 'Not found' });

    if (body.action === 'complete') {
      await reminderService.completeReminder(id, request.auth.workspaceId);
    } else {
      await reminderService.snoozeReminder(id, body.snooze_minutes ?? 10, request.auth.workspaceId);
    }
    return { ok: true };
  });

  // DELETE /api/reminders/:id — cancel
  app.delete('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const existing = await reminderService.getReminder(id, request.auth.workspaceId);
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await reminderService.cancelReminder(id, request.auth.workspaceId);
    return { ok: true };
  });
};

export default reminderRoutes;
