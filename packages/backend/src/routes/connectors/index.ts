import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import * as connectorService from '../../services/connector.service.js';
import * as auditService from '../../services/audit.service.js';
import { NotFoundError } from '../../lib/errors.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  connector_type: z.string().min(1).max(50),
  config: z.record(z.unknown()),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  connector_type: z.string().min(1).max(50).optional(),
  config: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

const executeSchema = z.object({
  action: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});

const connectorRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // GET /api/connectors
  app.get('/', async (request) => {
    return connectorService.listConnectors(request.auth.workspaceId);
  });

  // POST /api/connectors
  app.post('/', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const body = createSchema.parse(request.body);
    const connector = await connectorService.createConnector(request.auth.workspaceId, body);

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'connector.created',
      resourceType: 'data_connector',
      resourceId: connector!.id,
      changes: { name: body.name, connector_type: body.connector_type },
    });

    reply.status(201);
    return connector;
  });

  // PATCH /api/connectors/:id
  app.patch('/:id', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = updateSchema.parse(request.body);

    const updated = await connectorService.updateConnector(request.auth.workspaceId, id, body);
    if (!updated) throw new NotFoundError('Connector', id);

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'connector.updated',
      resourceType: 'data_connector',
      resourceId: id,
      changes: body,
    });

    return updated;
  });

  // DELETE /api/connectors/:id
  app.delete('/:id', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const deleted = await connectorService.deleteConnector(request.auth.workspaceId, id);
    if (!deleted) throw new NotFoundError('Connector', id);

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'connector.deleted',
      resourceType: 'data_connector',
      resourceId: id,
    });

    return { deleted: true };
  });

  // POST /api/connectors/:id/test
  app.post('/:id/test', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await connectorService.testConnection(request.auth.workspaceId, id);
    if (result.error === 'Connector not found') throw new NotFoundError('Connector', id);
    return result;
  });

  // POST /api/connectors/:id/execute
  app.post('/:id/execute', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { action, payload } = executeSchema.parse(request.body);
    const result = await connectorService.executeConnectorAction(
      request.auth.workspaceId,
      id,
      action,
      payload,
    );
    if (result.error === 'Connector not found') throw new NotFoundError('Connector', id);
    return result;
  });
};

export default connectorRoutes;
