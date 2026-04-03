import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser } from '../../middleware/auth.js';

const missionRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // POST /api/missions — create new mission
  app.post('/', async (request, reply) => {
    const { createMission, addMessage } = await import('../../services/mission.service.js');
    const mission = await createMission(request.auth.workspaceId, request.auth.userId);
    reply.status(201);
    return { mission };
  });

  // GET /api/missions — list missions
  app.get('/', async (request) => {
    const { listMissions } = await import('../../services/mission.service.js');
    const query = request.query as Record<string, string>;
    const missions = await listMissions(request.auth.workspaceId, {
      status: query.status,
      limit: query.limit ? parseInt(query.limit) : undefined,
    });
    return { missions };
  });

  // GET /api/missions/:id — get mission detail + messages
  app.get('/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { getMission, getMessages } = await import('../../services/mission.service.js');
    const mission = await getMission(request.auth.workspaceId, id);
    const messages = await getMessages(id);
    return { mission, messages };
  });

  // POST /api/missions/:id/messages — send chat message (triggers AI processing)
  app.post('/:id/messages', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ content: z.string().min(1) }).parse(request.body);
    const { processChatMessage, getMission } = await import('../../services/mission.service.js');

    const aiResponse = await processChatMessage(request.auth.workspaceId, id, body.content);
    const mission = await getMission(request.auth.workspaceId, id);

    return { ai_response: aiResponse, mission };
  });

  // POST /api/missions/:id/execute — start the call
  app.post('/:id/execute', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { executeMission } = await import('../../services/mission.service.js');
    await executeMission(request.auth.workspaceId, id);
    return { ok: true };
  });

  // PATCH /api/missions/:id — update mission
  app.patch('/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      title: z.string().optional(),
      status: z.string().optional(),
      agent_profile_id: z.string().uuid().nullable().optional(),
      target_phone: z.string().nullable().optional(),
      goal: z.string().nullable().optional(),
      fallback_action: z.string().optional(),
      scheduled_at: z.string().nullable().optional(),
    }).parse(request.body);

    const { updateMission } = await import('../../services/mission.service.js');
    const mission = await updateMission(id, body as any);
    return { mission };
  });

  // DELETE /api/missions/:id — cancel/delete mission
  app.delete('/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { deleteMission } = await import('../../services/mission.service.js');
    await deleteMission(request.auth.workspaceId, id);
    return { deleted: true };
  });

  // POST /api/missions/:id/retry — retry the call
  app.post('/:id/retry', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { executeMission, updateMission } = await import('../../services/mission.service.js');
    await updateMission(id, { status: 'ready', retry_count: 0 } as any);
    await executeMission(request.auth.workspaceId, id);
    return { ok: true };
  });
};

export default missionRoutes;
