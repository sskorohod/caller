import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import * as agentService from '../../services/agent.service.js';
import * as auditService from '../../services/audit.service.js';

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  display_name: z.string().min(1).max(100),
  company_name: z.string().optional(),
  company_identity: z.string().optional(),
  language: z.enum(['en', 'ru']).default('en'),
  voice_provider: z.enum(['elevenlabs', 'openai']).default('elevenlabs'),
  voice_id: z.string().optional(),
  llm_provider: z.enum(['anthropic', 'openai', 'xai']).default('anthropic'),
  llm_model: z.string().default('claude-sonnet-4-5-20250514'),
  stt_provider: z.enum(['deepgram', 'openai']).default('deepgram'),
  system_prompt: z.string().optional(),
  greeting_message: z.string().optional(),
  business_mode: z.string().optional(),
  is_default: z.boolean().default(false),
});

const agentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // GET /api/agents
  app.get('/', async (request) => {
    return agentService.listAgentProfiles(request.auth.workspaceId);
  });

  // GET /api/agents/:id
  app.get('/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const profile = await agentService.getAgentProfile(request.auth.workspaceId, id);

    // Also load attached packs
    const [promptPacks, skillPacks] = await Promise.all([
      agentService.getAgentPromptPacks(id),
      agentService.getAgentSkillPacks(id),
    ]);

    return { ...profile, prompt_packs: promptPacks, skill_packs: skillPacks };
  });

  // POST /api/agents
  app.post('/', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const body = createAgentSchema.parse(request.body);
    const profile = await agentService.createAgentProfile(request.auth.workspaceId, body as any);

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'agent_profile.created',
      resourceType: 'agent_profile',
      resourceId: profile.id,
      changes: { name: body.name },
    });

    reply.status(201);
    return profile;
  });

  // PATCH /api/agents/:id
  app.patch('/:id', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = createAgentSchema.partial().parse(request.body);

    const profile = await agentService.updateAgentProfile(request.auth.workspaceId, id, body as any);

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'agent_profile.updated',
      resourceType: 'agent_profile',
      resourceId: id,
      changes: body,
    });

    return profile;
  });

  // DELETE /api/agents/:id
  app.delete('/:id', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await agentService.deleteAgentProfile(request.auth.workspaceId, id);

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'agent_profile.deleted',
      resourceType: 'agent_profile',
      resourceId: id,
    });

    return { deleted: true };
  });

  // POST /api/agents/:id/prompt-packs
  app.post('/:id/prompt-packs', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      prompt_pack_id: z.string().uuid(),
      priority: z.number().optional(),
    }).parse(request.body);

    await agentService.attachPromptPack(id, body.prompt_pack_id, body.priority);
    return { attached: true };
  });

  // POST /api/agents/:id/skill-packs
  app.post('/:id/skill-packs', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      skill_pack_id: z.string().uuid(),
      priority: z.number().optional(),
    }).parse(request.body);

    await agentService.attachSkillPack(id, body.skill_pack_id, body.priority);
    return { attached: true };
  });
};

export default agentRoutes;
