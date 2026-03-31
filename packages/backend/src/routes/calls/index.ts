import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, authenticateApiKey } from '../../middleware/auth.js';
import * as callService from '../../services/call.service.js';

const startCallSchema = z.object({
  to: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format'),
  agent_profile_id: z.string().uuid().optional(),
  goal: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  language: z.enum(['en', 'ru']).optional(),
  conversation_owner: z.enum(['internal', 'external']).optional(),
  outcome_schema: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const listCallsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  status: z.enum(['initiated', 'ringing', 'in_progress', 'completed', 'failed', 'canceled']).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const callRoutes: FastifyPluginAsync = async (app) => {
  // MCP route: POST /api/calls/start (API key auth)
  app.post('/start', {
    preHandler: [authenticateApiKey],
  }, async (request, reply) => {
    const body = startCallSchema.parse(request.body);

    // TODO: resolve telephony connection, agent profile, workspace defaults
    // TODO: initiate Twilio call
    // For now, create the call record

    const call = await callService.createCall({
      workspaceId: request.auth.workspaceId,
      direction: 'outbound',
      fromNumber: 'pending', // will be resolved from telephony connection
      toNumber: body.to,
      conversationOwnerRequested: body.conversation_owner ?? 'internal',
      agentProfileId: body.agent_profile_id,
      goal: body.goal,
      goalSource: request.auth.authMethod === 'api_key' ? 'mcp' : 'dashboard',
      context: body.context,
      outcomeSchema: body.outcome_schema,
      metadata: body.metadata,
    });

    // Create AI session
    await callService.createAiSession({
      callId: call.id,
      workspaceId: request.auth.workspaceId,
      agentProfileId: body.agent_profile_id,
      conversationOwner: body.conversation_owner ?? 'internal',
    });

    // Log event
    await callService.addCallEvent({
      callId: call.id,
      workspaceId: request.auth.workspaceId,
      eventType: 'call_initiated',
      eventData: {
        goal: body.goal,
        conversation_owner: body.conversation_owner ?? 'internal',
        source: request.auth.authMethod,
      },
    });

    reply.status(201);
    return {
      call_id: call.id,
      status: call.status,
      conversation_owner_requested: call.conversation_owner_requested,
      conversation_owner_actual: call.conversation_owner_actual,
      agent_profile_id: call.agent_profile_id,
      created_at: call.created_at,
    };
  });

  // GET /api/calls/:id/status (supports both auth methods)
  app.get('/:id/status', {
    preHandler: [authenticateApiKey],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const call = await callService.getCall(request.auth.workspaceId, id);

    return {
      call_id: call.id,
      status: call.status,
      direction: call.direction,
      conversation_owner_requested: call.conversation_owner_requested,
      conversation_owner_actual: call.conversation_owner_actual,
      initiated_at: call.initiated_at,
      connected_at: call.connected_at,
      ended_at: call.ended_at,
      duration_seconds: call.duration_seconds,
    };
  });

  // GET /api/calls/:id/artifacts
  app.get('/:id/artifacts', {
    preHandler: [authenticateApiKey],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const call = await callService.getCall(request.auth.workspaceId, id);
    const session = await callService.getAiSession(id);

    return {
      call_id: call.id,
      status: call.status,
      recording_url: session?.recording_url ?? null,
      transcript_available: !!session?.transcript,
      summary: session?.summary ?? null,
      outcome: session?.outcome ?? null,
      action_items: session?.action_items ?? [],
      conversation_owner_actual: call.conversation_owner_actual,
      fallback_reason: call.fallback_reason,
      artifacts: session ? {
        session_id: session.id,
        sentiment: session.sentiment,
        quality_flags: session.quality_flags,
        qa_score: session.qa_score,
        total_turns: session.total_turns,
        cost_total: session.cost_total,
      } : null,
    };
  });

  // GET /api/calls (list)
  app.get('/', {
    preHandler: [authenticateApiKey],
  }, async (request) => {
    const query = listCallsSchema.parse(request.query);
    return callService.listCalls(request.auth.workspaceId, query);
  });

  // === Dashboard routes (user auth) ===

  // GET /api/calls/:id/detail (full call detail for dashboard)
  app.get('/:id/detail', {
    preHandler: [authenticateUser],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const [call, session, events] = await Promise.all([
      callService.getCall(request.auth.workspaceId, id),
      callService.getAiSession(id),
      callService.getCallEvents(id),
    ]);

    return { call, session, events };
  });
};

export default callRoutes;
