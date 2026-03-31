import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser } from '../../middleware/auth.js';
import * as memoryService from '../../services/memory.service.js';

const memoryRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // GET /api/memory/caller/:phone
  app.get('/caller/:phone', async (request) => {
    const { phone } = z.object({ phone: z.string() }).parse(request.params);
    return memoryService.loadCallerContext(request.auth.workspaceId, phone);
  });

  // POST /api/memory/facts
  app.post('/facts', async (request) => {
    const body = z.object({
      caller_profile_id: z.string().uuid(),
      fact_type: z.enum(['issue', 'preference', 'promise', 'follow_up', 'appointment', 'general']),
      content: z.string().min(1),
      source_call_id: z.string().uuid().optional(),
    }).parse(request.body);

    return memoryService.addMemoryFact({
      callerProfileId: body.caller_profile_id,
      workspaceId: request.auth.workspaceId,
      factType: body.fact_type,
      content: body.content,
      sourceCallId: body.source_call_id,
    });
  });

  // PATCH /api/memory/facts/:id/resolve
  app.patch('/facts/:id/resolve', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await memoryService.resolveFact(id, request.auth.workspaceId);
    return { resolved: true };
  });
};

export default memoryRoutes;
