import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import * as agentService from '../../services/agent.service.js';

const createSkillPackSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  intent: z.string().min(1),
  activation_rules: z.record(z.unknown()).optional(),
  required_data: z.array(z.unknown()).optional(),
  tool_sequence: z.array(z.unknown()).optional(),
  allowed_tools: z.array(z.string()).optional(),
  escalation_conditions: z.array(z.unknown()).optional(),
  completion_criteria: z.record(z.unknown()).optional(),
  conversation_rules: z.string().optional(),
});

const skillPackRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // GET /api/skill-packs
  app.get('/', async (request) => {
    const skillPacks = await agentService.listSkillPacks(request.auth.workspaceId);
    return { skill_packs: skillPacks };
  });

  // GET /api/skill-packs/:id
  app.get('/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return agentService.getSkillPack(request.auth.workspaceId, id);
  });

  // POST /api/skill-packs
  app.post('/', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const body = createSkillPackSchema.parse(request.body);
    const pack = await agentService.createSkillPack(request.auth.workspaceId, body as any);
    reply.status(201);
    return pack;
  });

  // PATCH /api/skill-packs/:id
  app.patch('/:id', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = createSkillPackSchema.partial().parse(request.body);
    return agentService.updateSkillPack(request.auth.workspaceId, id, body as any);
  });

  // DELETE /api/skill-packs/:id
  app.delete('/:id', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await agentService.deleteSkillPack(request.auth.workspaceId, id);
    return { deleted: true };
  });
};

export default skillPackRoutes;
