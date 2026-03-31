import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import twilio from 'twilio';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import * as telephonyService from '../../services/telephony.service.js';
import * as providerService from '../../services/provider.service.js';

const telephonyRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // GET /api/telephony/numbers — fetch available numbers from Twilio account
  app.get('/numbers', async (request, reply) => {
    try {
      const creds = await providerService.getProviderCredential(
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

  // POST /api/telephony/connections — save selected number
  app.post('/connections', {
    preHandler: [requireRole('owner', 'admin')],
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
      ),
    );
    return { deleted: true };
  });
};

export default telephonyRoutes;
