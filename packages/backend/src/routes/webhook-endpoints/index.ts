import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import * as webhookService from '../../services/webhook.service.js';
import * as auditService from '../../services/audit.service.js';
import { NotFoundError } from '../../lib/errors.js';
import type { WebhookEventType } from '../../services/webhook.service.js';

const VALID_EVENTS: WebhookEventType[] = [
  'call.started',
  'call.completed',
  'call.failed',
  'session.summary_ready',
];

const createSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum([
    'call.started',
    'call.completed',
    'call.failed',
    'session.summary_ready',
  ])).min(1),
  secret: z.string().min(16).optional(),
});

const updateSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum([
    'call.started',
    'call.completed',
    'call.failed',
    'session.summary_ready',
  ])).min(1).optional(),
  secret: z.string().min(16).optional(),
  is_active: z.boolean().optional(),
});

const webhookEndpointRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // GET /api/webhook-endpoints
  app.get('/', async (request) => {
    return webhookService.listEndpoints(request.auth.workspaceId);
  });

  // POST /api/webhook-endpoints
  app.post('/', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const body = createSchema.parse(request.body);
    const endpoint = await webhookService.createEndpoint(request.auth.workspaceId, body);

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'webhook_endpoint.created',
      resourceType: 'webhook_endpoint',
      resourceId: endpoint!.id,
      changes: { url: body.url, events: body.events },
    });

    reply.status(201);
    return endpoint;
  });

  // PATCH /api/webhook-endpoints/:id
  app.patch('/:id', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = updateSchema.parse(request.body);

    const updated = await webhookService.updateEndpoint(request.auth.workspaceId, id, body);
    if (!updated) throw new NotFoundError('WebhookEndpoint', id);

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'webhook_endpoint.updated',
      resourceType: 'webhook_endpoint',
      resourceId: id,
      changes: body,
    });

    return updated;
  });

  // DELETE /api/webhook-endpoints/:id
  app.delete('/:id', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const deleted = await webhookService.deleteEndpoint(request.auth.workspaceId, id);
    if (!deleted) throw new NotFoundError('WebhookEndpoint', id);

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'webhook_endpoint.deleted',
      resourceType: 'webhook_endpoint',
      resourceId: id,
    });

    return { deleted: true };
  });

  // POST /api/webhook-endpoints/:id/test
  app.post('/:id/test', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const endpoint = await webhookService.getEndpoint(request.auth.workspaceId, id);
    if (!endpoint) throw new NotFoundError('WebhookEndpoint', id);

    // Deliver a test event directly to this single endpoint
    await webhookService.deliverWebhookEvent(
      request.auth.workspaceId,
      'call.completed',
      {
        test: true,
        message: 'This is a test webhook event',
        endpoint_id: id,
        timestamp: new Date().toISOString(),
      },
    );

    return { sent: true };
  });
};

export default webhookEndpointRoutes;
