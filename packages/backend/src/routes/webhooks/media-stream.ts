import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import websocket from '@fastify/websocket';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { calls as callsTable, callerProfiles, callerMemoryFacts } from '../../db/schema.js';
import * as callService from '../../services/call.service.js';
import * as agentService from '../../services/agent.service.js';
import * as workspaceService from '../../services/workspace.service.js';
import { createSTTProvider } from '../../services/stt.service.js';
import { createTTSProvider } from '../../services/tts.service.js';
import { createLLMProvider } from '../../services/llm.service.js';
import { CallOrchestrator } from '../../services/call-orchestrator.js';
import { GrokRealtimeOrchestrator } from '../../services/grok-realtime.service.js';
import { sendBootstrapWebhook, ExternalAgentSession } from '../../services/external-handoff.service.js';
import { getProviderCredential } from '../../services/provider.service.js';
import * as knowledgeService from '../../services/knowledge.service.js';
import { env } from '../../config/env.js';
import { queuePostCallProcessing } from '../../workers/post-call.worker.js';
import { calculateLLMCost, calculateTTSCost, calculateSTTCost, calculateTelephonyCost } from '../../config/pricing.js';
import type { DeepgramSTT } from '../../services/stt.service.js';
import type { Call } from '../../models/types.js';
import { getIo } from '../../realtime/io.js';
import pino from 'pino';

const logger = pino({ name: 'media-stream' });

const activeOrchestrators = new Map<string, CallOrchestrator | GrokRealtimeOrchestrator>();
const activeTranslators = new Map<string, { feedAudio: (buf: Buffer) => void; stop: () => void }>();

interface ManualSession {
  calleeStt: DeepgramSTT;    // inbound track — person on the other end
  operatorStt: DeepgramSTT;  // outbound track — operator in browser
  transcript: Array<{ speaker: string; text: string; timestamp: string }>;
  callId: string;
  sessionId?: string;
  stop: () => void;
}
const activeManualSessions = new Map<string, ManualSession>();

export function getActiveTranslators() { return activeTranslators; }

export function getActiveOrchestrator(callId: string): CallOrchestrator | GrokRealtimeOrchestrator | undefined {
  return activeOrchestrators.get(callId);
}

const CORRECTION_MODELS: Record<string, string> = {
  xai: 'grok-3-mini-fast',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-5-20250514',
};

async function correctOperatorSpeech(
  callId: string,
  text: string,
  llm: import('../../services/llm.service.js').LLMProvider,
  providerName: string,
): Promise<void> {
  const model = CORRECTION_MODELS[providerName] ?? 'gpt-4o-mini';

  const messages: import('../../services/llm.service.js').LLMMessage[] = [
    {
      role: 'system',
      content: `You help correct English speech during phone calls. The user said something aloud.
If the English is imperfect or unnatural, suggest a more natural way to say it.
If it's already good natural English, return exactly: {"corrected":null}
Return JSON only: {"corrected": "better version" | null, "explanation": "brief note"}`,
    },
    { role: 'user', content: `"${text}"` },
  ];

  let result = '';
  await new Promise<void>((resolve) => {
    llm.generateStream(messages, model, 0.3, {
      onToken: (token: string) => { result += token; },
      onComplete: () => resolve(),
      onError: (err: Error) => {
        logger.error({ err, callId }, 'Correction LLM error');
        resolve();
      },
    });
  });

  if (!result.trim()) return;

  let parsed: { corrected: string | null; explanation?: string };
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    logger.warn({ callId, raw: result }, 'Failed to parse correction JSON');
    return;
  }

  if (!parsed.corrected) return;

  const io = getIo();
  if (!io) return;

  io.to(`call:${callId}`).emit('call:speech-correction', {
    call_id: callId,
    original: text,
    corrected: parsed.corrected,
    explanation: parsed.explanation ?? null,
    timestamp: new Date().toISOString(),
  });

  logger.debug({ callId, original: text, corrected: parsed.corrected }, 'Speech correction emitted');
}

const mediaStreamRoutes: FastifyPluginAsync = async (app) => {
  await app.register(websocket);

  // Track active external sessions by callId so external WS can find them
  const externalSessions = new Map<string, ExternalAgentSession>();

  app.get('/media-stream/:callId', { websocket: true }, async (socket, request) => {
    const callId = z.string().uuid().parse((request.params as any).callId);

    logger.info({ callId }, 'Twilio MediaStream WebSocket connected');

    let orchestrator: CallOrchestrator | GrokRealtimeOrchestrator | null = null;
    let externalSession: ExternalAgentSession | null = null;
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

          // --- Manual call path (no AI agent, just STT transcription) ---
          if (call.conversation_owner_requested === 'manual') {
            logger.info({ callId }, 'Manual call — starting dual STT for transcription');
            try {
              const sttLanguage = (call.metadata as any)?.stt_language === 'ru' ? 'ru' : ((call.metadata as any)?.stt_language ?? 'en-US');
              const calleeStt = await createSTTProvider(call.workspace_id, 'deepgram') as DeepgramSTT;
              const operatorStt = await createSTTProvider(call.workspace_id, 'deepgram') as DeepgramSTT;

              const transcript: ManualSession['transcript'] = [];
              const io = getIo();

              // Get AI session ID for later transcript save
              const aiSession = await callService.getAiSession(callId);

              const wireSTT = (stt: DeepgramSTT, speaker: 'caller' | 'operator') => {
                stt.on('transcript', (evt: import('../../services/stt.service.js').TranscriptEvent) => {
                  if (io) {
                    io.to(`call:${callId}`).emit('call:transcript', {
                      call_id: callId,
                      speaker,
                      text: evt.text,
                      timestamp: evt.timestamp,
                      isFinal: evt.isFinal,
                    });
                  }
                  if (evt.isFinal && evt.text.trim()) {
                    transcript.push({ speaker, text: evt.text.trim(), timestamp: evt.timestamp });
                  }
                });
              };

              wireSTT(calleeStt, 'caller');
              wireSTT(operatorStt, 'operator');

              // Resolve LLM for speech correction (prefer fast/cheap models)
              let correctionLlm: import('../../services/llm.service.js').LLMProvider | null = null;
              let correctionProvider = 'openai';
              for (const provider of ['xai', 'openai', 'anthropic'] as const) {
                try {
                  correctionLlm = await createLLMProvider(call.workspace_id, provider);
                  correctionProvider = provider;
                  break;
                } catch { /* try next */ }
              }

              // Wire operator speech correction
              if (correctionLlm) {
                let operatorAccumulated = '';
                operatorStt.on('transcript', (evt: import('../../services/stt.service.js').TranscriptEvent) => {
                  if (evt.isFinal && evt.text.trim()) {
                    operatorAccumulated += (operatorAccumulated ? ' ' : '') + evt.text.trim();
                  }
                });
                operatorStt.on('utterance_end', () => {
                  const text = operatorAccumulated.trim();
                  operatorAccumulated = '';
                  if (text && correctionLlm) {
                    correctOperatorSpeech(callId, text, correctionLlm, correctionProvider).catch(err =>
                      logger.error({ err, callId }, 'Speech correction error'),
                    );
                  }
                });
              }

              calleeStt.connect({ language: sttLanguage });
              operatorStt.connect({ language: sttLanguage });

              const manualSession: ManualSession = {
                calleeStt,
                operatorStt,
                transcript,
                callId,
                sessionId: aiSession?.id,
                stop: () => {
                  calleeStt.close();
                  operatorStt.close();
                  // Save transcript
                  if (manualSession.sessionId && transcript.length > 0) {
                    callService.updateAiSession(manualSession.sessionId, {
                      transcript: transcript as any,
                      total_turns: transcript.length,
                    } as any).catch(err => logger.error({ err, callId }, 'Failed to save manual call transcript'));
                  }
                  activeManualSessions.delete(callId);
                },
              };

              activeManualSessions.set(callId, manualSession);
            } catch (err) {
              logger.error({ err, callId }, 'Failed to start manual call STT');
            }
            return; // Manual call — no orchestrator needed
          }

          const agentProfile = call.agent_profile_id
            ? await agentService.getAgentProfile(call.workspace_id, call.agent_profile_id)
            : await agentService.getDefaultAgentProfile(call.workspace_id);

          if (!agentProfile) {
            logger.error({ callId }, 'No agent profile found');
            socket.close();
            return;
          }

          // --- External handoff path ---
          if (call.conversation_owner_requested === 'external') {
            const started = await startExternalHandoff(
              call as unknown as Call,
              agentProfile,
              callId,
              streamSid!,
              socket as any,
              externalSessions,
            );
            if (started) {
              externalSession = started;
              return; // External agent owns the call now
            }
            // Fallback: continue to internal orchestrator below
            logger.info({ callId }, 'External handoff failed, falling back to internal orchestrator');
          }

          // --- Internal orchestrator path ---
          orchestrator = await startInternalOrchestrator(
            call,
            agentProfile,
            callId,
            streamSid!,
            socket as any,
          );
        }

        if (msg.event === 'media' && msg.media?.payload) {
          const audioBuffer = Buffer.from(msg.media.payload, 'base64');
          const track = msg.media.track as string | undefined; // 'inbound' | 'outbound' when both_tracks

          // --- Manual call: route audio to per-track STT ---
          const manualSession = activeManualSessions.get(callId);
          if (manualSession) {
            if (track === 'outbound') {
              manualSession.operatorStt.sendAudio(audioBuffer);
            } else {
              // 'inbound' or no track (default = callee audio)
              manualSession.calleeStt.sendAudio(audioBuffer);
            }

            // Forward to LiveTranslator (callee audio only)
            const translator = activeTranslators.get(callId);
            if (translator && track !== 'outbound') {
              translator.feedAudio(audioBuffer);
            }

            // Broadcast audio for monitoring
            const io = getIo();
            if (io) {
              io.to(`call:${callId}:audio`).volatile.emit('call:audio', {
                source: track === 'outbound' ? 'agent' : 'caller',
                payload: msg.media.payload,
              });
            }
            return;
          }

          // --- AI orchestrator path ---
          // Forward audio to Grok Realtime orchestrator
          if (orchestrator && orchestrator instanceof GrokRealtimeOrchestrator) {
            (orchestrator as GrokRealtimeOrchestrator).sendAudio(msg.media.payload);
          }
          // Standard CallOrchestrator receives audio via STT directly (wired in start())

          // Forward caller audio to listen room for browser monitoring
          const io = getIo();
          if (io) {
            io.to(`call:${callId}:audio`).volatile.emit('call:audio', {
              source: 'caller',
              payload: msg.media.payload,
            });
          }

          // Forward to active LiveTranslator if running
          const translator = activeTranslators.get(callId);
          if (translator) {
            translator.feedAudio(audioBuffer);
          }
        }

        if (msg.event === 'stop') {
          const ms = activeManualSessions.get(callId);
          if (ms) ms.stop();
          if (orchestrator) orchestrator.stop('stream_stopped');
          if (externalSession) externalSession.sendCallEnded('stream_stopped');
        }
      } catch (err) {
        logger.error({ err, callId }, 'Error processing WebSocket message');
      }
    });

    socket.on('close', () => {
      logger.info({ callId }, 'Twilio MediaStream WebSocket closed');
      const ms = activeManualSessions.get(callId);
      if (ms) ms.stop();
      if (orchestrator) orchestrator.stop('ws_closed');
      if (externalSession) {
        externalSession.sendCallEnded('ws_closed');
        externalSessions.delete(callId);
      }
    });
  });

  /**
   * Attempt external handoff. Returns ExternalAgentSession if successful, null if fallback needed.
   */
  async function startExternalHandoff(
    call: Call,
    agentProfile: any,
    callId: string,
    streamSid: string,
    twilioSocket: import('ws').WebSocket,
    sessions: Map<string, ExternalAgentSession>,
  ): Promise<ExternalAgentSession | null> {
    const workspace = await workspaceService.getWorkspace(call.workspace_id);

    if (!workspace.external_inbound_webhook_url || !workspace.external_inbound_auth_secret) {
      logger.warn({ callId }, 'No external webhook URL configured, falling back to internal');
      await callService.updateCallStatus(callId, 'in_progress', {
        conversation_owner_actual: 'internal',
        external_bootstrap_status: 'failed',
        fallback_reason: 'no_webhook_url_configured',
      } as any);
      await callService.addCallEvent({
        callId,
        workspaceId: call.workspace_id,
        eventType: 'external_handoff_fallback',
        eventData: { reason: 'no_webhook_url_configured' },
      });
      return null;
    }

    const readyTimeoutMs = workspace.external_ready_timeout_ms ?? 8000;
    const sessionId = `es_${callId.slice(0, 8)}_${Date.now()}`;

    // Update bootstrap status to requested
    await callService.updateCallStatus(callId, 'in_progress', {
      external_bootstrap_status: 'requested',
    } as any);

    // Send bootstrap webhook
    const wsBaseUrl = `wss://${env.API_DOMAIN}`;
    const { accepted, sessionToken } = await sendBootstrapWebhook({
      callId,
      sessionId,
      workspaceId: call.workspace_id,
      calledNumber: call.to_number,
      callerNumber: call.from_number,
      agentProfileId: agentProfile.id,
      language: agentProfile.language,
      webhookUrl: workspace.external_inbound_webhook_url,
      authSecret: workspace.external_inbound_auth_secret,
      readyTimeoutMs,
      wsBaseUrl,
    });

    if (!accepted) {
      logger.warn({ callId }, 'External agent rejected bootstrap webhook');
      await callService.updateCallStatus(callId, 'in_progress', {
        conversation_owner_actual: 'internal',
        external_bootstrap_status: 'failed',
        fallback_reason: 'bootstrap_webhook_rejected',
      } as any);
      await callService.addCallEvent({
        callId,
        workspaceId: call.workspace_id,
        eventType: 'external_handoff_fallback',
        eventData: { reason: 'bootstrap_webhook_rejected' },
      });
      return null;
    }

    await callService.updateCallStatus(callId, 'in_progress', {
      external_bootstrap_status: 'accepted',
    } as any);

    // Create session and wait for external agent to connect
    const session = new ExternalAgentSession(callId, sessionId);
    sessions.set(callId, session);

    return new Promise<ExternalAgentSession | null>((resolve) => {
      const timeout = setTimeout(async () => {
        sessions.delete(callId);
        logger.warn({ callId }, 'External agent connection timed out');
        await callService.updateCallStatus(callId, 'in_progress', {
          conversation_owner_actual: 'internal',
          external_bootstrap_status: 'timed_out',
          fallback_reason: 'external_agent_connection_timeout',
        } as any);
        await callService.addCallEvent({
          callId,
          workspaceId: call.workspace_id,
          eventType: 'external_handoff_fallback',
          eventData: { reason: 'external_agent_connection_timeout', timeout_ms: readyTimeoutMs },
        });
        resolve(null);
      }, readyTimeoutMs);

      session.on('ready', async () => {
        clearTimeout(timeout);
        logger.info({ callId }, 'External agent is ready, handing off call');
        await callService.updateCallStatus(callId, 'in_progress', {
          conversation_owner_actual: 'external',
          external_bootstrap_status: 'ready',
          external_runtime_connected_at: new Date().toISOString(),
        } as any);
        await callService.addCallEvent({
          callId,
          workspaceId: call.workspace_id,
          eventType: 'external_agent_ready',
          eventData: { session_id: sessionId },
        });

        // Pipe Twilio audio to external agent via events
        // The ExternalAgentSession handles sending transcript deltas;
        // for raw audio piping, forward media events directly
        setupExternalAudioBridge(twilioSocket, session, streamSid);

        resolve(session);
      });

      session.on('timeout', async () => {
        clearTimeout(timeout);
        sessions.delete(callId);
        await callService.updateCallStatus(callId, 'in_progress', {
          conversation_owner_actual: 'internal',
          external_bootstrap_status: 'timed_out',
          fallback_reason: 'external_agent_readiness_timeout',
        } as any);
        resolve(null);
      });

      session.on('disconnected', async () => {
        clearTimeout(timeout);
        sessions.delete(callId);
        logger.info({ callId }, 'External agent disconnected');
        await callService.addCallEvent({
          callId,
          workspaceId: call.workspace_id,
          eventType: 'external_agent_disconnected',
          eventData: { session_id: sessionId },
        });
      });
    });
  }

  /**
   * Set up bidirectional audio bridge between Twilio WebSocket and external agent session.
   * Forward Twilio media events to external agent, and external agent replies back to Twilio.
   */
  function setupExternalAudioBridge(
    twilioSocket: import('ws').WebSocket,
    session: ExternalAgentSession,
    streamSid: string,
  ): void {
    // External agent reply_text events -> TTS would be handled by the external agent itself.
    // The external agent sends audio back via its own WebSocket; we listen for control events.
    session.on('control', (controlName: string) => {
      if (controlName === 'hangup') {
        logger.info('External agent requested hangup');
        twilioSocket.close();
      }
    });
  }

  /** Start the internal STT->LLM->TTS orchestrator (or Grok Realtime when both voice + LLM are xAI) */
  async function startInternalOrchestrator(
    call: any,
    agentProfile: any,
    callId: string,
    streamSid: string,
    twilioSocket: import('ws').WebSocket,
  ): Promise<CallOrchestrator | GrokRealtimeOrchestrator> {
    // Ensure conversation_owner_actual is set to internal
    await callService.updateCallStatus(callId, 'in_progress', {
      conversation_owner_actual: 'internal',
    } as any);

    const [promptPacks, attachedSkills, allSkills, attachedKBs] = await Promise.all([
      agentService.getAgentPromptPacks(agentProfile.id),
      agentService.getAgentSkillPacks(agentProfile.id),
      agentService.listSkillPacks(call.workspace_id),
      agentService.getAgentKnowledgeBases(agentProfile.id),
    ]);
    const systemPrompt = buildSystemPrompt(agentProfile, promptPacks, attachedSkills, allSkills, call, attachedKBs);
    const callerContext = await loadCallerContext(call.workspace_id, call.from_number);

    // Load workspace timezone
    const workspace = await workspaceService.getWorkspace(call.workspace_id);
    const timezone = workspace?.timezone || 'America/Los_Angeles';

    // --- Grok Realtime path: skip STT/TTS/LLM when both voice and LLM are xAI ---
    const useGrokRealtime =
      agentProfile.voice_provider === 'xai' && agentProfile.llm_provider === 'xai';

    if (useGrokRealtime) {
      logger.info({ callId }, 'Using Grok Realtime (voice-to-voice) orchestrator');

      const xaiCreds = await getProviderCredential(call.workspace_id, 'xai');
      const apiKey = xaiCreds.api_key;

      const grokOrchestrator = new GrokRealtimeOrchestrator({
        call: call as any,
        agentProfile: agentProfile as any,
        twilioWs: twilioSocket,
        streamSid,
        systemPrompt,
        callerContext,
        apiKey,
        timezone,
      });

      // Audio forwarding handled in main socket.on('message') handler
      wireOrchestratorEvents(grokOrchestrator, call, callId);
      grokOrchestrator.start();
      return grokOrchestrator;
    }

    // --- Standard STT -> LLM -> TTS pipeline ---
    const [stt, tts, llm] = await Promise.all([
      createSTTProvider(call.workspace_id, agentProfile.stt_provider as any),
      createTTSProvider(call.workspace_id, agentProfile.voice_provider as any, agentProfile.voice_id ?? undefined),
      createLLMProvider(call.workspace_id, agentProfile.llm_provider as any),
    ]);

    const orchestrator = new CallOrchestrator({
      call: call as any,
      agentProfile: agentProfile as any,
      stt: stt as DeepgramSTT,
      tts,
      llm,
      twilioWs: twilioSocket,
      streamSid,
      language: agentProfile.language,
      systemPrompt,
      callerContext,
      knowledgeSearch: attachedKBs.length > 0
        ? (query: string) => knowledgeService.searchKnowledgeForAgent(
            call.workspace_id, agentProfile.id, query, 3,
          )
        : undefined,
    });

    wireOrchestratorEvents(orchestrator, call, callId);
    orchestrator.start();
    return orchestrator;
  }

  /** Wire up stopped/error event handlers shared by both orchestrator types */
  function wireOrchestratorEvents(
    orchestrator: CallOrchestrator | GrokRealtimeOrchestrator,
    call: any,
    callId: string,
  ): void {
    // Store orchestrator for live monitoring access
    activeOrchestrators.set(callId, orchestrator);

    // Forward transcript events to Socket.IO for live monitoring
    orchestrator.on('transcript', (entry: { speaker: string; text: string; timestamp: string; isFinal: boolean }) => {
      const io = getIo();
      logger.info({ callId, speaker: entry.speaker, text: entry.text?.slice(0, 50), hasIo: !!io }, 'Forwarding transcript to Socket.IO');
      io?.to(`call:${callId}`).emit('call:transcript', { call_id: callId, ...entry });
    });

    // Forward agent TTS audio to browser listen room
    orchestrator.on('agent_audio', (data: { payload: string }) => {
      const io = getIo();
      if (io) {
        io.to(`call:${callId}:audio`).volatile.emit('call:audio', {
          source: 'agent',
          payload: data.payload,
        });
      }
    });

    orchestrator.on('skill_activated', (data: { intent: string }) => {
      const io = getIo();
      io?.to(`call:${callId}`).emit('call:transcript', {
        call_id: callId,
        speaker: 'system',
        text: `[Skill activated: ${data.intent}]`,
        timestamp: new Date().toISOString(),
        isFinal: true,
      });
    });

    orchestrator.on('stopped', async (result: any) => {
      activeOrchestrators.delete(callId);
      logger.info({ callId, reason: result.reason }, 'Orchestrator stopped');
      const session = await callService.getAiSession(callId);
      if (session) {
        // Calculate costs based on actual usage
        const costLlm = calculateLLMCost(
          result.llmModel ?? 'claude-sonnet-4-5-20250514',
          result.totalTokensIn ?? 0,
          result.totalTokensOut ?? 0,
        );
        const costTts = calculateTTSCost(
          result.voiceProvider ?? 'elevenlabs',
          result.totalTtsCharacters ?? 0,
        );
        const costStt = calculateSTTCost(
          result.sttProvider ?? 'deepgram',
          (result.sttAudioDurationMs ?? 0) / 60_000,
        );
        // Get call duration for telephony cost
        const callRecord = await callService.getCall(call.workspace_id, callId);
        const durationMin = (callRecord?.duration_seconds ?? 0) / 60;
        const costTelephony = calculateTelephonyCost('twilio', durationMin);
        const costTotal = costLlm + costTts + costStt + costTelephony;

        await callService.updateAiSession(session.id, {
          transcript: result.conversationHistory,
          total_turns: result.turnCount,
          total_tokens_in: result.totalTokensIn,
          total_tokens_out: result.totalTokensOut,
          avg_latency_ms: result.avgLatencyMs,
          cost_llm: costLlm.toFixed(6),
          cost_tts: costTts.toFixed(6),
          cost_stt: costStt.toFixed(6),
          cost_telephony: costTelephony.toFixed(6),
          cost_total: costTotal.toFixed(6),
        } as any);

        logger.info({ callId, costLlm, costTts, costStt, costTelephony, costTotal }, 'Call costs calculated');

        // Queue post-call processing (summary, sentiment, fact extraction, memory)
        queuePostCallProcessing({
          callId,
          sessionId: session.id,
          workspaceId: call.workspace_id,
          callerProfileId: call.caller_profile_id ?? undefined,
        }).catch(err => logger.error({ err, callId }, 'Failed to queue post-call processing'));
      }
      await callService.updateCallStatus(callId, 'completed');
    });

    orchestrator.on('error', (err) => {
      logger.error({ err, callId }, 'Orchestrator error');
    });
  }
};

function buildSystemPrompt(agentProfile: any, promptPacks: any[], attachedSkills: any[] = [], allSkills: any[] = [], call?: any, attachedKBs: any[] = []): string {
  const parts: string[] = [];
  parts.push(`You are ${agentProfile.display_name}, an AI phone agent.`);
  if (agentProfile.company_name) parts.push(`You represent ${agentProfile.company_name}.`);
  if (agentProfile.company_identity) parts.push(agentProfile.company_identity);
  if (agentProfile.system_prompt) parts.push(agentProfile.system_prompt);

  // Mission briefing from call goal/context
  if (call?.goal) {
    const missionParts = [`MISSION BRIEFING:\nGoal: ${call.goal}`];
    if (call.context && Object.keys(call.context).length > 0) {
      missionParts.push(`Context data to use during the call: ${JSON.stringify(call.context)}`);
    }
    parts.push(missionParts.join('\n'));
  }

  for (const pack of promptPacks) {
    if (pack.content) parts.push(`--- ${pack.name} ---\n${pack.content}`);
  }

  // Core skills (always active — full conversation rules)
  if (attachedSkills.length > 0) {
    const coreSkillParts = attachedSkills
      .filter(s => s.conversation_rules)
      .map(s => `[${s.name}]: ${s.conversation_rules}`);
    if (coreSkillParts.length > 0) {
      parts.push(`CORE SKILLS (always active):\n${coreSkillParts.join('\n')}`);
    }
  }

  // Optional skills (available but not attached — agent can activate if needed)
  const attachedIds = new Set(attachedSkills.map((s: any) => s.id));
  const optionalSkills = allSkills.filter(s => !attachedIds.has(s.id) && s.is_active);
  if (optionalSkills.length > 0) {
    const optParts = optionalSkills.map(s =>
      `- ${s.intent}: ${s.description || s.name}`
    );
    parts.push(`OPTIONAL SKILLS (activate when the conversation requires it — say [ACTIVATE:skill_intent] to enable):\n${optParts.join('\n')}`);
  }

  // Knowledge bases
  if (attachedKBs.length > 0) {
    const kbNames = attachedKBs.map((kb: any) => kb.name).join(', ');
    parts.push(`KNOWLEDGE BASES: You have access to these knowledge bases: ${kbNames}. Relevant excerpts will be provided during the conversation. Use them to give accurate, informed answers.`);
  }

  if (agentProfile.language === 'ru') {
    parts.push('Speak in Russian. Respond naturally as if on a phone call.');
  } else {
    parts.push('Speak in English. Respond naturally as if on a phone call.');
  }
  parts.push('Keep responses concise — this is a phone conversation, not a chat.');
  parts.push('Never use markdown, bullet points, or formatting. Speak naturally.');
  parts.push(`CALL ENDING RULES:
- When the caller says goodbye ("bye", "пока", "до свидания", "всё, пока") — say ONE short farewell (max 5 words) and add [END_CALL] at the end.
- When you have completed your goal/mission — say a brief closing and add [END_CALL].
- NEVER say goodbye more than once. One farewell + [END_CALL]. That's it.
- Do NOT repeat farewell phrases. If you already said goodbye, do NOT generate another response.`);

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
