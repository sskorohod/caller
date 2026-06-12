import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import twilio from 'twilio';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { requireResourceLimit } from '../../middleware/plan-gate.js';
import * as telephonyService from '../../services/telephony.service.js';

const telephonyRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // GET /api/telephony/availability — whether the platform admin has configured
  // Twilio (drives the dialer's "configured" UX without exposing credentials).
  app.get('/availability', async () => {
    const { hasOwnCredentials } = await import('../../services/credential-resolver.service.js');
    const twilioReady = await hasOwnCredentials('', 'twilio');
    return { twilio: twilioReady };
  });

  // GET /api/telephony/numbers — fetch available numbers from the platform
  // admin's Twilio account (provider management is centralized).
  app.get('/numbers', async (request, reply) => {
    try {
      const { resolveCredentials } = await import('../../services/credential-resolver.service.js');
      const creds = await resolveCredentials<{ account_sid: string; auth_token: string }>(
        request.auth.workspaceId, 'twilio',
      );
      const client = twilio(creds.account_sid, creds.auth_token);
      const numbers = await client.incomingPhoneNumbers.list({ limit: 50 });
      return numbers.map(n => ({
        sid: n.sid,
        phone_number: n.phoneNumber,
        friendly_name: n.friendlyName || n.phoneNumber,
        voice_enabled: (n.capabilities as any)?.voice ?? true,
        sms_enabled: (n.capabilities as any)?.sms ?? false,
      }));
    } catch (e: any) {
      reply.status(400);
      return { error: 'twilio_error', message: e.message || 'Failed to connect to Twilio' };
    }
  });

  // GET /api/telephony/connections — list saved connections
  app.get('/connections', async (request) => {
    return telephonyService.listTelephonyConnections(request.auth.workspaceId);
  });

  // ─── Personal number (rented, billed monthly from balance) ──────────
  // Not behind requireResourceLimit: the 1-per-workspace limit is enforced
  // by the partial unique index + the service guard.

  // GET /api/telephony/personal-number — current number + price
  app.get('/personal-number', async (request) => {
    const { getPersonalNumber, getPersonalNumberPrice } = await import('../../services/personal-number.service.js');
    const [number, price] = await Promise.all([
      getPersonalNumber(request.auth.workspaceId),
      getPersonalNumberPrice(),
    ]);
    return { number, price_usd: price };
  });

  // POST /api/telephony/personal-number — one-click purchase
  app.post('/personal-number', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const { purchasePersonalNumber } = await import('../../services/personal-number.service.js');
    const number = await purchasePersonalNumber({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
    });
    reply.status(201);
    return { number };
  });

  // PATCH /api/telephony/personal-number — toggle auto-renew
  app.patch('/personal-number', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const body = z.object({ auto_renew: z.boolean() }).parse(request.body);
    const { setAutoRenew } = await import('../../services/personal-number.service.js');
    const number = await setAutoRenew({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      autoRenew: body.auto_renew,
    });
    return { number };
  });

  // DELETE /api/telephony/personal-number — immediate release, no refund
  app.delete('/personal-number', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { releasePersonalNumber } = await import('../../services/personal-number.service.js');
    await releasePersonalNumber({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      reason: 'user_request',
    });
    return { released: true };
  });

  // POST /api/telephony/connections — save selected number
  app.post('/connections', {
    preHandler: [requireRole('owner', 'admin'), requireResourceLimit('connection')],
  }, async (request, reply) => {
    const body = z.object({
      phone_number: z.string(),
      friendly_name: z.string().optional(),
      twilio_sid: z.string().optional(),
      inbound_enabled: z.boolean().optional(),
      outbound_enabled: z.boolean().optional(),
    }).parse(request.body);

    // Upsert: if number already exists update, else create
    const existing = await telephonyService.getConnectionByNumber(
      request.auth.workspaceId, body.phone_number,
    );

    if (existing) {
      return existing;
    }

    reply.status(201);
    return telephonyService.createTelephonyConnection({
      workspaceId: request.auth.workspaceId,
      phoneNumber: body.phone_number,
      friendlyName: body.friendly_name,
      twilioSid: body.twilio_sid,
      inboundEnabled: body.inbound_enabled ?? true,
      outboundEnabled: body.outbound_enabled ?? true,
      aiAnsweringEnabled: false,
    });
  });

  // PATCH /api/telephony/connections/:id — update connection settings (agent, AI answering)
  app.patch('/connections/:id', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      ai_answering_enabled: z.boolean().optional(),
      inbound_enabled: z.boolean().optional(),
      outbound_enabled: z.boolean().optional(),
      friendly_name: z.string().optional(),
    }).parse(request.body);

    const { db } = await import('../../config/db.js');
    const { telephonyConnections } = await import('../../db/schema.js');
    const { eq, and } = await import('drizzle-orm');

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (body.ai_answering_enabled !== undefined) updates.ai_answering_enabled = body.ai_answering_enabled;
    if (body.inbound_enabled !== undefined) updates.inbound_enabled = body.inbound_enabled;
    if (body.outbound_enabled !== undefined) updates.outbound_enabled = body.outbound_enabled;
    if (body.friendly_name !== undefined) updates.friendly_name = body.friendly_name;

    const [updated] = await db
      .update(telephonyConnections)
      .set(updates)
      .where(
        and(
          eq(telephonyConnections.id, id),
          eq(telephonyConnections.workspace_id, request.auth.workspaceId),
          // Personal numbers are managed only via /personal-number routes
          eq(telephonyConnections.is_personal, false),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error('Connection not found');
    }

    // Auto-configure Twilio webhook when ai_answering_enabled changes
    if (body.ai_answering_enabled !== undefined && updated.twilio_sid) {
      telephonyService.configureTwilioInboundWebhook(
        request.auth.workspaceId, updated.twilio_sid, body.ai_answering_enabled,
      ).catch(err => {
        request.log.warn({ err, connectionId: id }, 'Failed to configure Twilio inbound webhook');
      });
    }

    return updated;
  });

  // DELETE /api/telephony/connections/:id
  app.delete('/connections/:id', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { db } = await import('../../config/db.js');
    const { telephonyConnections } = await import('../../db/schema.js');
    const { eq, and } = await import('drizzle-orm');
    await db.delete(telephonyConnections).where(
      and(
        eq(telephonyConnections.id, id),
        eq(telephonyConnections.workspace_id, request.auth.workspaceId),
        // Personal numbers must go through release (Twilio cleanup + history)
        eq(telephonyConnections.is_personal, false),
      ),
    );
    return { deleted: true };
  });
};

export default telephonyRoutes;
