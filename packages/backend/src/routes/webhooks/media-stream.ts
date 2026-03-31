import type { FastifyPluginAsync } from 'fastify';
import websocket from '@fastify/websocket';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { calls as callsTable, callerProfiles, callerMemoryFacts } from '../../db/schema.js';
import * as callService from '../../services/call.service.js';
import * as agentService from '../../services/agent.service.js';
import { createSTTProvider } from '../../services/stt.service.js';
import { createTTSProvider } from '../../services/tts.service.js';
import { createLLMProvider } from '../../services/llm.service.js';
import { CallOrchestrator } from '../../services/call-orchestrator.js';
import type { DeepgramSTT } from '../../services/stt.service.js';
import pino from 'pino';

const logger = pino({ name: 'media-stream' });

const mediaStreamRoutes: FastifyPluginAsync = async (app) => {
  await app.register(websocket);

  app.get('/media-stream/:callId', { websocket: true }, async (socket, request) => {
    const callId = (request.params as any).callId;

    logger.info({ callId }, 'Twilio MediaStream WebSocket connected');

    let orchestrator: CallOrchestrator | null = null;
    let streamSid: string | null = null;

    socket.on('message', async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.event === 'start') {
          streamSid = msg.start.streamSid;
          logger.info({ callId, streamSid }, 'Stream started');

          const [call] = await db.select().from(callsTable).where(eq(callsTable.id, callId));

          if (!call) {
            logger.error({ callId }, 'Call not found');
            socket.close();
            return;
          }

          await callService.updateCallStatus(callId, 'in_progress');

          const agentProfile = call.agent_profile_id
            ? await agentService.getAgentProfile(call.workspace_id, call.agent_profile_id)
            : await agentService.getDefaultAgentProfile(call.workspace_id);

          if (!agentProfile) {
            logger.error({ callId }, 'No agent profile found');
            socket.close();
            return;
          }

          const promptPacks = await agentService.getAgentPromptPacks(agentProfile.id);
          const systemPrompt = buildSystemPrompt(agentProfile, promptPacks);

          const [stt, tts, llm] = await Promise.all([
            createSTTProvider(call.workspace_id, agentProfile.stt_provider as any),
            createTTSProvider(call.workspace_id, agentProfile.voice_provider as any, agentProfile.voice_id ?? undefined),
            createLLMProvider(call.workspace_id, agentProfile.llm_provider as any),
          ]);

          const callerContext = await loadCallerContext(call.workspace_id, call.from_number);

          orchestrator = new CallOrchestrator({
            call: call as any,
            agentProfile: agentProfile as any,
            stt: stt as DeepgramSTT,
            tts,
            llm,
            twilioWs: socket as any,
            streamSid: streamSid!,
            language: agentProfile.language,
            systemPrompt,
            callerContext,
          });

          orchestrator.on('stopped', async (result) => {
            logger.info({ callId, reason: result.reason }, 'Orchestrator stopped');
            const session = await callService.getAiSession(callId);
            if (session) {
              await callService.updateAiSession(session.id, {
                transcript: result.conversationHistory,
                total_turns: result.turnCount,
                total_tokens_in: result.totalTokensIn,
                total_tokens_out: result.totalTokensOut,
                avg_latency_ms: result.avgLatencyMs,
              } as any);
            }
            await callService.updateCallStatus(callId, 'completed');
          });

          orchestrator.on('error', (err) => {
            logger.error({ err, callId }, 'Orchestrator error');
          });

          orchestrator.start();
        }

        if (msg.event === 'stop') {
          if (orchestrator) orchestrator.stop('stream_stopped');
        }
      } catch (err) {
        logger.error({ err, callId }, 'Error processing WebSocket message');
      }
    });

    socket.on('close', () => {
      logger.info({ callId }, 'Twilio MediaStream WebSocket closed');
      if (orchestrator) orchestrator.stop('ws_closed');
    });
  });
};

function buildSystemPrompt(agentProfile: any, promptPacks: any[]): string {
  const parts: string[] = [];
  parts.push(`You are ${agentProfile.display_name}, an AI phone agent.`);
  if (agentProfile.company_name) parts.push(`You represent ${agentProfile.company_name}.`);
  if (agentProfile.company_identity) parts.push(agentProfile.company_identity);
  if (agentProfile.system_prompt) parts.push(agentProfile.system_prompt);

  for (const pack of promptPacks) {
    if (pack.content) parts.push(`--- ${pack.name} ---\n${pack.content}`);
  }

  if (agentProfile.language === 'ru') {
    parts.push('Speak in Russian. Respond naturally as if on a phone call.');
  } else {
    parts.push('Speak in English. Respond naturally as if on a phone call.');
  }
  parts.push('Keep responses concise — this is a phone conversation, not a chat.');
  parts.push('Never use markdown, bullet points, or formatting. Speak naturally.');
  parts.push('If you need to end the call, say goodbye politely.');

  return parts.join('\n\n');
}

async function loadCallerContext(workspaceId: string, phoneNumber: string): Promise<string | undefined> {
  const [profile] = await db.select().from(callerProfiles)
    .where(and(
      eq(callerProfiles.workspace_id, workspaceId),
      eq(callerProfiles.phone_number, phoneNumber),
    ));

  if (!profile) return undefined;

  const facts = await db.select().from(callerMemoryFacts)
    .where(and(
      eq(callerMemoryFacts.caller_profile_id, profile.id),
      eq(callerMemoryFacts.is_resolved, false),
    ))
    .orderBy(desc(callerMemoryFacts.created_at))
    .limit(10);

  const parts: string[] = [];
  if (profile.name) parts.push(`Caller name: ${profile.name}`);
  if (profile.relationship) parts.push(`Relationship: ${profile.relationship}`);
  parts.push(`Previous calls: ${profile.total_calls}`);

  if (facts.length > 0) {
    parts.push('Recent context:');
    for (const fact of facts) {
      parts.push(`- [${fact.fact_type}] ${fact.content}`);
    }
  }

  return parts.join('\n');
}

export default mediaStreamRoutes;
