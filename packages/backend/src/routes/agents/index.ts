import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import * as agentService from '../../services/agent.service.js';
import * as auditService from '../../services/audit.service.js';
import * as uploadService from '../../services/upload.service.js';
import { createLLMProvider } from '../../services/llm.service.js';

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  display_name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  company_name: z.string().nullable().optional(),
  company_identity: z.string().nullable().optional(),
  language: z.enum(['en', 'ru', 'es', 'de', 'fr', 'auto']).default('auto'),
  voice_provider: z.enum(['elevenlabs', 'openai', 'xai']).default('elevenlabs'),
  voice_id: z.string().nullable().optional(),
  llm_provider: z.enum(['anthropic', 'openai', 'xai']).default('anthropic'),
  llm_model: z.string().default('claude-sonnet-4-5-20250514'),
  stt_provider: z.enum(['deepgram', 'openai']).default('deepgram'),
  system_prompt: z.string().nullable().optional(),
  greeting_message: z.string().nullable().optional(),
  business_mode: z.string().nullable().optional(),
  is_default: z.boolean().default(false),
  is_active: z.boolean().optional(),
});

const agentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // GET /api/agents
  app.get('/', async (request) => {
    const agents = await agentService.listAgentProfiles(request.auth.workspaceId);

    // Resolve presigned URLs for MinIO avatars
    const resolved = await Promise.all(agents.map(async (a) => {
      if (uploadService.isMinioPath(a.avatar_url)) {
        try {
          return { ...a, avatar_url: await uploadService.getAvatarUrl(a.avatar_url!) };
        } catch { /* keep original */ }
      }
      return a;
    }));

    return { agents: resolved };
  });

  // GET /api/agents/:id
  app.get('/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const profile = await agentService.getAgentProfile(request.auth.workspaceId, id);

    // Generate presigned URL for MinIO avatars
    let avatarUrl = profile.avatar_url;
    if (uploadService.isMinioPath(avatarUrl)) {
      try {
        avatarUrl = await uploadService.getAvatarUrl(avatarUrl!);
      } catch { /* keep original path */ }
    }

    // Also load attached packs
    const [promptPacks, skillPacks, knowledgeBases] = await Promise.all([
      agentService.getAgentPromptPacks(id),
      agentService.getAgentSkillPacks(id),
      agentService.getAgentKnowledgeBases(id),
    ]);

    return { ...profile, avatar_url: avatarUrl, prompt_packs: promptPacks, skill_packs: skillPacks, knowledge_bases: knowledgeBases };
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

  // DELETE /api/agents/:id/prompt-packs — detach all prompt packs
  app.delete('/:id/prompt-packs', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await agentService.detachAllPromptPacks(id);
    return { deleted: true };
  });

  // DELETE /api/agents/:id/prompt-packs/:packId — detach single prompt pack
  app.delete('/:id/prompt-packs/:packId', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id, packId } = z.object({ id: z.string().uuid(), packId: z.string().uuid() }).parse(request.params);
    await agentService.detachPromptPack(id, packId);
    return { deleted: true };
  });

  // DELETE /api/agents/:id/skill-packs — detach all skill packs
  app.delete('/:id/skill-packs', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await agentService.detachAllSkillPacks(id);
    return { deleted: true };
  });

  // DELETE /api/agents/:id/skill-packs/:packId — detach single skill pack
  app.delete('/:id/skill-packs/:packId', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id, packId } = z.object({ id: z.string().uuid(), packId: z.string().uuid() }).parse(request.params);
    await agentService.detachSkillPack(id, packId);
    return { deleted: true };
  });

  // POST /api/agents/:id/knowledge-bases — attach a knowledge base
  app.post('/:id/knowledge-bases', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      knowledge_base_id: z.string().uuid(),
    }).parse(request.body);

    await agentService.attachKnowledgeBase(id, body.knowledge_base_id);
    return { attached: true };
  });

  // DELETE /api/agents/:id/knowledge-bases — detach all knowledge bases
  app.delete('/:id/knowledge-bases', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await agentService.detachAllKnowledgeBases(id);
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

  // PUT /api/agents/:id/skill-packs — batch sync skill packs (atomic)
  app.put('/:id/skill-packs', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      skill_pack_ids: z.array(z.string().uuid()),
    }).parse(request.body);

    await agentService.syncSkillPacks(request.auth.workspaceId, id, body.skill_pack_ids);
    return { synced: true, count: body.skill_pack_ids.length };
  });

  // PUT /api/agents/:id/prompt-packs — batch sync prompt packs (atomic)
  app.put('/:id/prompt-packs', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      prompt_pack_ids: z.array(z.string().uuid()),
    }).parse(request.body);

    await agentService.syncPromptPacks(request.auth.workspaceId, id, body.prompt_pack_ids);
    return { synced: true, count: body.prompt_pack_ids.length };
  });

  // POST /api/agents/:id/avatar — upload avatar image
  app.post('/:id/avatar', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const workspaceId = request.auth.workspaceId;

    const data = await request.file();
    if (!data) {
      reply.status(400);
      return { error: 'No file uploaded' };
    }

    const buffer = await data.toBuffer();
    const objectKey = await uploadService.uploadAvatar(workspaceId, id, buffer, data.mimetype);

    // Delete old avatar if it was a MinIO upload
    const profile = await agentService.getAgentProfile(workspaceId, id);
    if (uploadService.isMinioPath(profile.avatar_url)) {
      await uploadService.deleteAvatar(profile.avatar_url!);
    }

    await agentService.updateAgentProfile(workspaceId, id, { avatar_url: objectKey } as any);
    const url = await uploadService.getAvatarUrl(objectKey);
    return { avatar_url: url, object_key: objectKey };
  });

  // DELETE /api/agents/:id/avatar — remove avatar
  app.delete('/:id/avatar', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const workspaceId = request.auth.workspaceId;

    const profile = await agentService.getAgentProfile(workspaceId, id);
    if (uploadService.isMinioPath(profile.avatar_url)) {
      await uploadService.deleteAvatar(profile.avatar_url!);
    }

    await agentService.updateAgentProfile(workspaceId, id, { avatar_url: null } as any);
    return { deleted: true };
  });

  // POST /api/agents/:id/suggest-skills — AI-powered skill recommendations
  app.post('/:id/suggest-skills', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const workspaceId = request.auth.workspaceId;

    const profile = await agentService.getAgentProfile(workspaceId, id);
    const allSkills = await agentService.listSkillPacks(workspaceId);
    const attachedSkills = await agentService.getAgentSkillPacks(id);
    const attachedIds = new Set(attachedSkills.map(s => s.id));

    if (allSkills.length === 0) {
      return { suggestions: [] };
    }

    // Build prompt for skill suggestion
    const skillsList = allSkills.map(s =>
      `- ID: ${s.id}, Name: "${s.name}", Intent: "${s.intent}", Description: "${s.description ?? 'N/A'}"${attachedIds.has(s.id) ? ' [ALREADY ATTACHED]' : ''}`
    ).join('\n');

    const agentContext = [
      profile.display_name && `Name: ${profile.display_name}`,
      profile.description && `Description: ${profile.description}`,
      profile.system_prompt && `System prompt: ${profile.system_prompt.slice(0, 500)}`,
      profile.business_mode && `Business mode: ${profile.business_mode}`,
      profile.company_name && `Company: ${profile.company_name}`,
    ].filter(Boolean).join('\n');

    // Get LLM provider
    let llm;
    for (const provider of ['anthropic', 'xai', 'openai'] as const) {
      try {
        llm = await createLLMProvider(workspaceId, provider);
        break;
      } catch { /* try next */ }
    }
    if (!llm) return { suggestions: [] };

    let result: any[] = [];
    const model = (llm as any).client?.baseURL?.includes('x.ai') ? 'grok-3-mini-fast'
      : (llm as any).client?.apiKey ? 'gpt-4o-mini' : 'claude-sonnet-4-5-20250514';

    await llm.generateStream(
      [
        {
          role: 'system',
          content: `You analyze an AI phone agent's configuration and recommend which skills to attach.
Return a JSON array of recommendations. Only recommend skills that are NOT already attached.
Each item: {"skill_pack_id": "uuid", "name": "skill name", "reason": "1-sentence explanation why this skill is useful for this agent"}
If no skills are relevant, return an empty array [].`,
        },
        {
          role: 'user',
          content: `AGENT:\n${agentContext}\n\nAVAILABLE SKILLS:\n${skillsList}`,
        },
      ],
      model,
      0.3,
      {
        onToken: () => {},
        onComplete: (response) => {
          try {
            const match = response.text.match(/\[[\s\S]*\]/);
            if (match) result = JSON.parse(match[0]);
          } catch { /* parse error */ }
        },
        onError: () => {},
      },
    );

    return { suggestions: result };
  });
};

export default agentRoutes;
