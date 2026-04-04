import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, authenticateApiKey, requireRole } from '../../middleware/auth.js';
import * as callService from '../../services/call.service.js';
import * as telephonyService from '../../services/telephony.service.js';
import * as agentService from '../../services/agent.service.js';
import * as memoryService from '../../services/memory.service.js';
import { ValidationError, AppError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { db } from '../../config/db.js';
import { calls } from '../../db/schema.js';
import { eq, and, or, sql, gte, desc } from 'drizzle-orm';
import { aiCallSessions, providerCredentials as providerCredsTable } from '../../db/schema.js';

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

      // Telegram notification (fire-and-forget)
      (async () => {
        try {
          const [telegramCreds] = await db
            .select()
            .from(providerCredsTable)
            .where(and(
              eq(providerCredsTable.workspace_id, request.auth.workspaceId),
              eq(providerCredsTable.provider, 'telegram'),
            ));
          if (telegramCreds) {
            const { sendCallNotification } = await import('../../services/telegram.service.js');
            const { decrypt } = await import('../../lib/crypto.js');
            const creds = JSON.parse(decrypt(telegramCreds.credential_data)) as { bot_token: string; chat_id: string };
            const shareToken = await callService.createShareToken(call.id);
            const monitorUrl = `https://${env.API_DOMAIN}/calls/${call.id}/monitor?token=${shareToken}`;
            sendCallNotification(creds.bot_token, creds.chat_id, {
              phone: body.to,
              direction: 'outbound',
              name: null,
              company: null,
              total_calls: 0,
              agent_name: agentProfile?.display_name ?? agentProfile?.name ?? '',
              recent_facts: [],
              monitor_url: monitorUrl,
            }).catch(() => {});
          }
        } catch { /* non-critical */ }
      })();

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

  // GET /api/calls/stats — aggregated dashboard stats
  app.get('/stats', {
    preHandler: [authenticateUser],
  }, async (request) => {
    const wid = request.auth.workspaceId;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // All queries in parallel
    const [
      totalRow,
      todayRow,
      weekRow,
      activeRow,
      statusRows,
      directionRows,
      sentimentRows,
      costRow,
      avgDurationRow,
      dailyRows,
      topAgentRows,
    ] = await Promise.all([
      // Total calls all time
      db.select({ count: sql<number>`count(*)::int` }).from(calls).where(eq(calls.workspace_id, wid)),
      // Today's calls
      db.select({ count: sql<number>`count(*)::int` }).from(calls).where(and(eq(calls.workspace_id, wid), gte(calls.created_at, today))),
      // Week calls
      db.select({ count: sql<number>`count(*)::int` }).from(calls).where(and(eq(calls.workspace_id, wid), gte(calls.created_at, sevenDaysAgo))),
      // Active calls
      db.select({ count: sql<number>`count(*)::int` }).from(calls).where(and(eq(calls.workspace_id, wid), eq(calls.status, 'in_progress'))),
      // Status breakdown (last 30 days)
      db.select({ status: calls.status, count: sql<number>`count(*)::int` }).from(calls).where(and(eq(calls.workspace_id, wid), gte(calls.created_at, thirtyDaysAgo))).groupBy(calls.status),
      // Direction breakdown (last 30 days)
      db.select({ direction: calls.direction, count: sql<number>`count(*)::int` }).from(calls).where(and(eq(calls.workspace_id, wid), gte(calls.created_at, thirtyDaysAgo))).groupBy(calls.direction),
      // Sentiment (last 30 days)
      db.select({ sentiment: aiCallSessions.sentiment, count: sql<number>`count(*)::int` }).from(aiCallSessions).where(and(eq(aiCallSessions.workspace_id, wid), gte(aiCallSessions.created_at, thirtyDaysAgo))).groupBy(aiCallSessions.sentiment),
      // Cost & quality (last 30 days)
      db.select({
        total_cost: sql<string>`coalesce(sum(cost_total), 0)::text`,
        cost_llm: sql<string>`coalesce(sum(cost_llm), 0)::text`,
        cost_tts: sql<string>`coalesce(sum(cost_tts), 0)::text`,
        cost_stt: sql<string>`coalesce(sum(cost_stt), 0)::text`,
        cost_telephony: sql<string>`coalesce(sum(cost_telephony), 0)::text`,
        avg_qa: sql<string>`coalesce(avg(qa_score), 0)::text`,
        total_turns: sql<number>`coalesce(sum(total_turns), 0)::int`,
      }).from(aiCallSessions).where(and(eq(aiCallSessions.workspace_id, wid), gte(aiCallSessions.created_at, thirtyDaysAgo))),
      // Avg duration (last 30 days, completed only)
      db.select({
        avg: sql<number>`coalesce(avg(duration_seconds), 0)::int`,
        total_minutes: sql<number>`coalesce(sum(duration_seconds) / 60, 0)::int`,
      }).from(calls).where(and(eq(calls.workspace_id, wid), eq(calls.status, 'completed'), gte(calls.created_at, thirtyDaysAgo))),
      // Daily calls (last 7 days)
      db.select({
        day: sql<string>`to_char(created_at, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      }).from(calls).where(and(eq(calls.workspace_id, wid), gte(calls.created_at, sevenDaysAgo))).groupBy(sql`to_char(created_at, 'YYYY-MM-DD')`).orderBy(sql`to_char(created_at, 'YYYY-MM-DD')`),
      // Top agents by call count (last 30 days)
      db.select({
        agent_profile_id: calls.agent_profile_id,
        count: sql<number>`count(*)::int`,
      }).from(calls).where(and(eq(calls.workspace_id, wid), gte(calls.created_at, thirtyDaysAgo), sql`agent_profile_id IS NOT NULL`)).groupBy(calls.agent_profile_id).orderBy(sql`count(*) desc`).limit(5),
    ]);

    const statusMap = Object.fromEntries(statusRows.map(r => [r.status, r.count]));
    const directionMap = Object.fromEntries(directionRows.map(r => [r.direction, r.count]));
    const sentimentMap = Object.fromEntries(sentimentRows.filter(r => r.sentiment).map(r => [r.sentiment!, r.count]));
    const completed = statusMap['completed'] ?? 0;
    const total30 = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const successRate = total30 > 0 ? Math.round((completed / total30) * 100) : 0;

    return {
      total_calls: totalRow[0]?.count ?? 0,
      today_calls: todayRow[0]?.count ?? 0,
      week_calls: weekRow[0]?.count ?? 0,
      active_calls: activeRow[0]?.count ?? 0,
      success_rate: successRate,
      status_breakdown: statusMap,
      direction_breakdown: directionMap,
      sentiment_breakdown: sentimentMap,
      avg_duration_seconds: avgDurationRow[0]?.avg ?? 0,
      total_minutes_30d: avgDurationRow[0]?.total_minutes ?? 0,
      cost_total_30d: parseFloat(costRow[0]?.total_cost ?? '0'),
      cost_llm_30d: parseFloat(costRow[0]?.cost_llm ?? '0'),
      cost_tts_30d: parseFloat(costRow[0]?.cost_tts ?? '0'),
      cost_stt_30d: parseFloat(costRow[0]?.cost_stt ?? '0'),
      cost_telephony_30d: parseFloat(costRow[0]?.cost_telephony ?? '0'),
      avg_qa_score: parseFloat(parseFloat(costRow[0]?.avg_qa ?? '0').toFixed(1)),
      total_turns_30d: costRow[0]?.total_turns ?? 0,
      daily_calls: dailyRows,
      top_agents: topAgentRows,
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

  // GET /api/calls/:id/recording — resolve recording URL (MinIO presigned or Twilio redirect)
  app.get('/:id/recording', {
    preHandler: [authenticateUser],
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const session = await callService.getAiSession(id);

    if (!session?.recording_url) {
      reply.status(404).send({ error: 'No recording available' });
      return;
    }

    const url = session.recording_url;

    if (url.startsWith('minio://')) {
      const key = url.replace('minio://', '');
      const { getPresignedUrl } = await import('../../services/recording-storage.service.js');
      const presigned = await getPresignedUrl(key);
      reply.redirect(presigned);
      return;
    }

    // Twilio URL — redirect directly
    reply.redirect(url);
  });

  // GET /api/calls/by-phone/:phone — caller history by phone number
  app.get('/by-phone/:phone', {
    preHandler: [authenticateUser],
  }, async (request) => {
    const { phone } = z.object({ phone: z.string().min(1) }).parse(request.params);
    const decoded = decodeURIComponent(phone);

    const rows = await db
      .select({
        call: calls,
        summary: aiCallSessions.summary,
        sentiment: aiCallSessions.sentiment,
        total_turns: aiCallSessions.total_turns,
      })
      .from(calls)
      .leftJoin(aiCallSessions, eq(aiCallSessions.call_id, calls.id))
      .where(
        and(
          eq(calls.workspace_id, request.auth.workspaceId),
          or(
            eq(calls.from_number, decoded),
            eq(calls.to_number, decoded),
          ),
        ),
      )
      .orderBy(desc(calls.created_at))
      .limit(20);

    const profile = await memoryService.findOrCreateCallerProfile(request.auth.workspaceId, decoded);
    const facts = await memoryService.getUnresolvedFacts(profile.id, 10);

    return {
      calls: rows.map((r) => ({
        ...r.call,
        summary: r.summary,
        sentiment: r.sentiment,
        total_turns: r.total_turns,
      })),
      memory_facts: facts.map((f: any) => f.content),
      caller: {
        name: profile.name,
        company: profile.company,
        total_calls: profile.total_calls,
        last_call_at: profile.last_call_at,
      },
    };
  });

  // POST /api/calls/translate — translate text using workspace LLM provider
  app.post('/translate', {
    preHandler: [authenticateUser],
  }, async (request) => {
    const { text, target } = z.object({
      text: z.string().min(1),
      target: z.string().min(1),
    }).parse(request.body);

    const { getProviderCredential } = await import('../../services/provider.service.js');

    // Try xAI first, fall back to openai
    let apiKey: string;
    let provider: 'xai' | 'openai' = 'xai';
    try {
      const creds = await getProviderCredential(request.auth.workspaceId, 'xai');
      apiKey = creds.api_key;
    } catch {
      const creds = await getProviderCredential(request.auth.workspaceId, 'openai');
      apiKey = creds.api_key;
      provider = 'openai';
    }

    const baseUrl = provider === 'xai'
      ? 'https://api.x.ai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const model = provider === 'xai' ? 'grok-3-mini' : 'gpt-4o-mini';

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: `You are a translator. Translate the following text to ${target}. Return ONLY the translated text, nothing else.` },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      throw new AppError(502, 'TRANSLATION_FAILED', 'Translation provider returned an error');
    }

    const data = await res.json() as { choices: { message: { content: string } }[] };
    return { translated: data.choices[0]?.message?.content?.trim() ?? '' };
  });

  // POST /api/calls/dial — manual call from browser (no AI agent)
  app.post('/dial', {
    preHandler: [authenticateUser],
  }, async (request, reply) => {
    const body = z.object({
      to: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format'),
      stt_language: z.enum(['auto', 'en', 'ru', 'es', 'de', 'fr']).optional().default('en'),
      stt_provider: z.enum(['deepgram', 'openai']).optional().default('deepgram'),
      voice_translate: z.boolean().optional().default(false),
      voice_translate_mode: z.enum(['sequential', 'translated']).optional(),
      tts_provider: z.enum(['elevenlabs', 'openai', 'xai']).optional(),
      tts_voice_id: z.string().optional(),
      translate_to_language: z.string().optional(),
    }).parse(request.body);

    const connection = await telephonyService.getOutboundConnection(request.auth.workspaceId);

    const call = await callService.createCall({
      workspaceId: request.auth.workspaceId,
      direction: 'outbound',
      fromNumber: connection.phone_number,
      toNumber: body.to,
      telephonyConnectionId: connection.id,
      conversationOwnerRequested: 'manual',
      metadata: {
        stt_language: body.stt_language,
        stt_provider: body.stt_provider,
        voice_translate: body.voice_translate,
        voice_translate_mode: body.voice_translate_mode,
        tts_provider: body.tts_provider,
        tts_voice_id: body.tts_voice_id,
        translate_to_language: body.translate_to_language,
      },
    });

    await callService.createAiSession({
      callId: call.id,
      workspaceId: request.auth.workspaceId,
      conversationOwner: 'manual',
    });

    await callService.addCallEvent({
      callId: call.id,
      workspaceId: request.auth.workspaceId,
      eventType: 'call_initiated',
      eventData: { source: 'dialer', stt_language: body.stt_language },
    });

    // Telegram notification for dialer calls (fire-and-forget)
    (async () => {
      try {
        const [telegramCreds] = await db
          .select()
          .from(providerCredsTable)
          .where(and(
            eq(providerCredsTable.workspace_id, request.auth.workspaceId),
            eq(providerCredsTable.provider, 'telegram'),
          ));
        if (telegramCreds) {
          const { sendCallNotification } = await import('../../services/telegram.service.js');
          const { decrypt } = await import('../../lib/crypto.js');
          const creds = JSON.parse(decrypt(telegramCreds.credential_data)) as { bot_token: string; chat_id: string };
          const shareToken = await callService.createShareToken(call.id);
          const monitorUrl = `https://${env.API_DOMAIN}/calls/${call.id}/monitor?token=${shareToken}`;
          sendCallNotification(creds.bot_token, creds.chat_id, {
            phone: body.to,
            direction: 'outbound',
            name: null,
            company: null,
            total_calls: 0,
            agent_name: '',
            recent_facts: [],
            monitor_url: monitorUrl,
          }).catch(() => {});
        }
      } catch { /* non-critical */ }
    })();

    reply.status(201);
    return {
      call_id: call.id,
      from_number: connection.phone_number,
      stt_language: body.stt_language,
    };
  });

  // GET /api/calls/voice-token — Twilio AccessToken for browser calling
  app.get('/voice-token', {
    preHandler: [authenticateUser],
  }, async (request) => {
    return telephonyService.generateVoiceToken(request.auth.workspaceId, request.auth.userId);
  });

  // POST /api/calls/:id/takeover — stop AI and connect operator
  app.post('/:id/takeover', {
    preHandler: [authenticateUser],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      mode: z.enum(['phone', 'browser']),
      phone_number: z.string().optional(),
    }).parse(request.body);

    // Get call from DB
    const call = await callService.getCall(request.auth.workspaceId, id);
    if (!call.twilio_call_sid) throw new ValidationError('No Twilio call SID');

    // Stop AI orchestrator
    const { getActiveOrchestrator } = await import('../../routes/webhooks/media-stream.js');
    const orch = getActiveOrchestrator(id);
    if (orch) orch.stop('operator_takeover');

    // Get workspace outbound number for caller ID
    const conn = await telephonyService.getOutboundConnection(request.auth.workspaceId);

    let twiml: string;
    if (body.mode === 'browser') {
      // Browser takeover — dial Twilio Client identity
      const identity = `operator_${request.auth.userId}`;
      twiml = `<Response><Say>Connecting you to an operator.</Say><Dial callerId="${conn.phone_number}"><Client>${identity}</Client></Dial></Response>`;
    } else {
      // Phone takeover — dial phone number
      twiml = `<Response><Say>Connecting you to an operator.</Say><Dial callerId="${conn.phone_number}"><Number>${body.phone_number}</Number></Dial></Response>`;
    }

    await telephonyService.updateActiveCall(request.auth.workspaceId, call.twilio_call_sid, twiml);

    // Update call status
    await callService.updateCallStatus(id, 'in_progress', {
      conversation_owner_actual: 'internal',
      fallback_reason: 'operator_takeover',
    } as any);

    // Emit event
    const io = (await import('../../realtime/io.js')).getIo();
    io?.to(`call:${id}`).emit('call:takeover:started', { call_id: id, mode: body.mode });

    return { ok: true, mode: body.mode };
  });

  // POST /api/calls/:id/translate/start — start live translation
  app.post('/:id/translate/start', {
    preHandler: [authenticateUser],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      target_language: z.string().min(2).max(5),
      mode: z.enum(['translate', 'copilot']).default('translate'),
      my_language: z.string().optional(),
      context: z.string().optional(),
      instant: z.boolean().optional(),
      source_language: z.string().optional(),
    }).parse(request.body);

    const { getActiveTranslators } = await import('../../routes/webhooks/media-stream.js');
    const translators = getActiveTranslators();

    // Stop existing translator if running
    const existing = translators.get(id);
    if (existing) existing.stop();

    // Check if this is a manual call — skip STT since calleeStt feeds text directly
    const call = await callService.getCall(request.auth.workspaceId, id);
    const isManualCall = call.conversation_owner_requested === 'manual';

    const { LiveTranslator } = await import('../../services/live-translate.service.js');
    const translator = new LiveTranslator({
      callId: id,
      workspaceId: request.auth.workspaceId,
      targetLanguage: body.target_language,
      mode: body.mode,
      myLanguage: body.my_language,
      context: body.context,
      instant: body.instant,
      sourceLanguage: body.source_language,
      skipStt: isManualCall,
    });

    await translator.start();
    translators.set(id, translator);

    return { ok: true, mode: body.mode };
  });

  // POST /api/calls/:id/translate/stop — stop live translation
  app.post('/:id/translate/stop', {
    preHandler: [authenticateUser],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const { getActiveTranslators } = await import('../../routes/webhooks/media-stream.js');
    const translators = getActiveTranslators();
    const translator = translators.get(id);
    if (translator) {
      translator.stop();
      translators.delete(id);
    }

    return { ok: true };
  });

  // POST /api/calls/:id/hangup — explicitly end a call (hang up callee in voice translate)
  app.post('/:id/hangup', {
    preHandler: [authenticateUser],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    // Hang up callee call in voice translate session
    const { getActiveVoiceTranslateSessions } = await import('../../routes/webhooks/media-stream.js');
    const vt = getActiveVoiceTranslateSessions().get(id);
    if (vt?.calleeCallSid) {
      await telephonyService.hangupCall(vt.workspaceId, vt.calleeCallSid).catch(() => {});
    }

    // Also try to complete via call record
    const call = await callService.getCall(request.auth.workspaceId, id);
    if (call.twilio_call_sid && call.status !== 'completed') {
      await telephonyService.hangupCall(request.auth.workspaceId, call.twilio_call_sid).catch(() => {});
    }

    await callService.updateCallStatus(id, 'completed').catch(() => {});
    return { ok: true };
  });

  // DELETE /api/calls/:id
  app.delete('/:id', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await callService.deleteCall(request.auth.workspaceId, id);
    return { deleted: true };
  });

  // POST /api/calls/bulk-delete
  app.post('/bulk-delete', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const { ids } = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(request.body);
    let deleted = 0;
    for (const id of ids) {
      try {
        await callService.deleteCall(request.auth.workspaceId, id);
        deleted++;
      } catch { /* skip not found */ }
    }
    return { deleted };
  });

  // GET /api/calls/:id/live-public?token=xxx — public access to live call data (no JWT required)
  app.get('/:id/live-public', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { token } = z.object({ token: z.string().min(1) }).parse(request.query);

    const valid = await callService.validateShareToken(id, token);
    if (!valid) {
      reply.status(403).send({ error: 'Invalid or expired share token' });
      return;
    }

    const [call, session, events] = await Promise.all([
      db.select().from(calls).where(eq(calls.id, id)).then(r => r[0]),
      callService.getAiSession(id),
      callService.getCallEvents(id),
    ]);

    if (!call) {
      reply.status(404).send({ error: 'Call not found' });
      return;
    }

    return { call, session, events };
  });
};

export default callRoutes;
