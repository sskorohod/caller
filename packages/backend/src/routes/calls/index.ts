import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, authenticateApiKey } from '../../middleware/auth.js';
import * as callService from '../../services/call.service.js';
import * as telephonyService from '../../services/telephony.service.js';
import * as agentService from '../../services/agent.service.js';
import { ValidationError, AppError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { db } from '../../config/db.js';
import { calls } from '../../db/schema.js';
import { eq, and, sql, gte } from 'drizzle-orm';

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
  limit: z.coerce.number().min(1).max(1000).optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  status: z.enum(['initiated', 'ringing', 'in_progress', 'completed', 'failed', 'canceled']).optional(),
  offset: z.coerce.number().min(0).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  agent_profile_id: z.string().uuid().optional(),
  sentiment: z.string().optional(),
  min_duration: z.coerce.number().min(0).optional(),
  max_duration: z.coerce.number().min(0).optional(),
});

const callRoutes: FastifyPluginAsync = async (app) => {
  // MCP route: POST /api/calls/start (API key auth)
  app.post('/start', {
    preHandler: [authenticateApiKey],
  }, async (request, reply) => {
    const body = startCallSchema.parse(request.body);

    // Idempotency: check for existing call with same key within 24 hours
    const idempotencyKey = (request.headers as Record<string, string | undefined>)['idempotency-key'];
    if (idempotencyKey) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [existing] = await db
        .select()
        .from(calls)
        .where(
          and(
            eq(calls.workspace_id, request.auth.workspaceId),
            sql`${calls.metadata}->>'idempotency_key' = ${idempotencyKey}`,
            gte(calls.created_at, twentyFourHoursAgo),
          ),
        )
        .limit(1);

      if (existing) {
        reply.status(200);
        return {
          call_id: existing.id,
          status: existing.status,
          conversation_owner_requested: existing.conversation_owner_requested,
          conversation_owner_actual: existing.conversation_owner_actual,
          agent_profile_id: existing.agent_profile_id,
          created_at: existing.created_at,
          twilio_call_sid: existing.twilio_call_sid,
          idempotent: true,
        };
      }
    }

    const connection = await telephonyService.getOutboundConnection(request.auth.workspaceId);
    const resolvedAgentProfileId = body.agent_profile_id ?? connection.default_agent_profile_id ?? undefined;

    let agentProfile = resolvedAgentProfileId
      ? await agentService.getAgentProfile(request.auth.workspaceId, resolvedAgentProfileId)
      : await agentService.getDefaultAgentProfile(request.auth.workspaceId);

    if (!agentProfile) {
      throw new ValidationError('No active agent profile configured for outbound calls');
    }

    const call = await callService.createCall({
      workspaceId: request.auth.workspaceId,
      direction: 'outbound',
      fromNumber: connection.phone_number,
      toNumber: body.to,
      telephonyConnectionId: connection.id,
      conversationOwnerRequested: body.conversation_owner ?? 'internal',
      agentProfileId: agentProfile.id,
      goal: body.goal,
      goalSource: request.auth.authMethod === 'api_key' ? 'mcp' : 'dashboard',
      context: body.context,
      outcomeSchema: body.outcome_schema,
      metadata: {
        ...body.metadata,
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      },
    });

    // Create AI session
    await callService.createAiSession({
      callId: call.id,
      workspaceId: request.auth.workspaceId,
      agentProfileId: agentProfile.id,
      conversationOwner: body.conversation_owner ?? 'internal',
      promptSnapshot: agentProfile.system_prompt ?? undefined,
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

    const statusCallbackUrl = `https://${env.API_DOMAIN}/webhooks/twilio/status`;
    const streamUrl = `wss://${env.API_DOMAIN}/webhooks/ws/media-stream/${call.id}`;

    try {
      const twilioCallSid = await telephonyService.initiateOutboundCall({
        workspaceId: request.auth.workspaceId,
        to: body.to,
        from: connection.phone_number,
        callId: call.id,
        statusCallbackUrl,
        streamUrl,
      });

      const updatedCall = await callService.updateCallStatus(call.id, 'initiated', {
        twilio_call_sid: twilioCallSid,
        twilio_status: 'queued',
      } as any);

      reply.status(201);
      return {
        call_id: updatedCall.id,
        status: updatedCall.status,
        conversation_owner_requested: updatedCall.conversation_owner_requested,
        conversation_owner_actual: updatedCall.conversation_owner_actual,
        agent_profile_id: updatedCall.agent_profile_id,
        created_at: updatedCall.created_at,
        twilio_call_sid: twilioCallSid,
      };
    } catch (error) {
      await callService.updateCallStatus(call.id, 'failed', {
        fallback_reason: error instanceof Error ? error.message : 'Failed to initiate outbound call',
      } as any);

      await callService.addCallEvent({
        callId: call.id,
        workspaceId: request.auth.workspaceId,
        eventType: 'outbound_call_failed_to_start',
        eventData: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new ValidationError(
        error instanceof Error ? error.message : 'Failed to initiate outbound call',
      );
    }
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

  // GET /api/calls (list) — supports both JWT (dashboard) and API key (MCP)
  app.get('/', {
    preHandler: [
      async (request, reply) => {
        const token = request.headers.authorization?.replace('Bearer ', '') ?? '';
        if (token.startsWith('mcp_')) {
          return authenticateApiKey(request, reply);
        }
        return authenticateUser(request, reply);
      },
    ],
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
