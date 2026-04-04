import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import * as agentService from '../../services/agent.service.js';

const createPromptPackSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  content: z.string().min(1),
  category: z.string().optional(),
  is_active: z.boolean().optional(),
});

const promptPackRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // GET /api/prompt-packs
  app.get('/', async (request) => {
    const promptPacks = await agentService.listPromptPacks(request.auth.workspaceId);
    return { prompt_packs: promptPacks };
  });

  // GET /api/prompt-packs/:id
  app.get('/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return agentService.getPromptPack(request.auth.workspaceId, id);
  });

  // POST /api/prompt-packs
  app.post('/', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const body = createPromptPackSchema.parse(request.body);
    const pack = await agentService.createPromptPack(request.auth.workspaceId, body);
    reply.status(201);
    return pack;
  });

  // PATCH /api/prompt-packs/:id
  app.patch('/:id', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = createPromptPackSchema.partial().parse(request.body);
    return agentService.updatePromptPack(request.auth.workspaceId, id, body);
  });

  // DELETE /api/prompt-packs/:id
  app.delete('/:id', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await agentService.deletePromptPack(request.auth.workspaceId, id);
    return { deleted: true };
  });
};

export default promptPackRoutes;
