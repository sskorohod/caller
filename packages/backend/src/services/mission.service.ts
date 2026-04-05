import pino from 'pino';
import { db } from '../config/db.js';
import { missions, missionMessages, callerProfiles, callerMemoryFacts, agentProfiles, calls, aiCallSessions } from '../db/schema.js';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { createLLMProvider, type LLMMessage } from './llm.service.js';
import * as agentService from './agent.service.js';
import * as callService from './call.service.js';
import * as telephonyService from './telephony.service.js';
import { env } from '../config/env.js';
import { getIo } from '../realtime/io.js';
import type { Mission, MissionMessage } from '../models/types.js';

const logger = pino({ name: 'mission' });

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function createMission(workspaceId: string, createdBy: string): Promise<Mission> {
  const [row] = await db.insert(missions).values({
    workspace_id: workspaceId,
    created_by: createdBy,
    status: 'draft',
  }).returning();
  return row as unknown as Mission;
}

export async function getMission(workspaceId: string, missionId: string): Promise<Mission> {
  const [row] = await db.select().from(missions)
    .where(and(eq(missions.workspace_id, workspaceId), eq(missions.id, missionId)));
  if (!row) throw new Error('Mission not found');
  return row as unknown as Mission;
}

export async function listMissions(workspaceId: string, filters?: { status?: string; limit?: number }): Promise<Mission[]> {
  let q = db.select().from(missions)
    .where(filters?.status
      ? and(eq(missions.workspace_id, workspaceId), eq(missions.status, filters.status))
      : eq(missions.workspace_id, workspaceId)
    )
    .orderBy(desc(missions.created_at))
    .limit(filters?.limit ?? 50);
  const rows = await q;
  return rows as unknown as Mission[];
}

export async function updateMission(missionId: string, updates: Partial<Record<string, unknown>>): Promise<Mission> {
  const [row] = await db.update(missions)
    .set({ ...updates, updated_at: new Date() } as any)
    .where(eq(missions.id, missionId))
    .returning();
  return row as unknown as Mission;
}

export async function deleteMission(workspaceId: string, missionId: string): Promise<void> {
  await db.delete(missions).where(and(eq(missions.workspace_id, workspaceId), eq(missions.id, missionId)));
}

export async function addMessage(
  missionId: string,
  senderType: string,
  content: string,
  messageType = 'chat',
  metadata: Record<string, unknown> = {},
): Promise<MissionMessage> {
  const [row] = await db.insert(missionMessages).values({
    mission_id: missionId,
    sender_type: senderType,
    content,
    message_type: messageType,
    metadata,
  }).returning();
  return row as unknown as MissionMessage;
}

export async function getMessages(missionId: string): Promise<MissionMessage[]> {
  const rows = await db.select().from(missionMessages)
    .where(eq(missionMessages.mission_id, missionId))
    .orderBy(asc(missionMessages.created_at));
  return rows as unknown as MissionMessage[];
}

// ─── AI Chat Processing ─────────────────────────────────────────────────────

const PHONE_REGEX = /\+?\d[\d\s\-()]{7,}\d/g;

async function loadCallerContext(workspaceId: string, phone: string): Promise<string | null> {
  const cleanPhone = phone.replace(/[\s\-()]/g, '');
  const [profile] = await db.select().from(callerProfiles)
    .where(and(eq(callerProfiles.workspace_id, workspaceId), eq(callerProfiles.phone_number, cleanPhone)));
  if (!profile) return null;

  const facts = await db.select().from(callerMemoryFacts)
    .where(and(eq(callerMemoryFacts.caller_profile_id, profile.id), eq(callerMemoryFacts.is_resolved, false)))
    .orderBy(desc(callerMemoryFacts.created_at)).limit(10);

  const parts: string[] = [];
  if (profile.name) parts.push(`Name: ${profile.name}`);
  if ((profile as any).company) parts.push(`Company: ${(profile as any).company}`);
  parts.push(`Previous calls: ${profile.total_calls}`);
  if (facts.length > 0) {
    parts.push('Recent facts:');
    facts.forEach(f => parts.push(`- [${f.fact_type}] ${f.content}`));
  }
  return parts.join('\n');
}

async function getLLM(workspaceId: string) {
  for (const provider of ['anthropic', 'xai', 'openai'] as const) {
    try { return { llm: await createLLMProvider(workspaceId, provider), provider }; } catch {}
  }
  throw new Error('No LLM provider available');
}

function getModelForProvider(provider: string): string {
  if (provider === 'xai') return 'grok-3-mini-fast';
  if (provider === 'openai') return 'gpt-4.1-mini';
  return 'claude-sonnet-4-5-20250514';
}

async function generateText(workspaceId: string, messages: LLMMessage[]): Promise<string> {
  const { llm, provider } = await getLLM(workspaceId);
  const model = getModelForProvider(provider);

  return new Promise((resolve, reject) => {
    let text = '';
    llm.generateStream(messages, model, 0.7, {
      onToken: (token: string) => { text += token; },
      onComplete: () => { resolve(text); },
      onError: (err: Error) => { reject(err); },
    });
  });
}

export async function processChatMessage(workspaceId: string, missionId: string, userMessage: string): Promise<string> {
  // Save user message
  const userMsg = await addMessage(missionId, 'user', userMessage, 'chat');
  emitMessage(missionId, userMsg);

  // Load state
  const mission = await getMission(workspaceId, missionId);
  const history = await getMessages(missionId);
  const agents = await agentService.listAgentProfiles(workspaceId);

  // Auto-context: find phone numbers and load caller memory
  const phones = userMessage.match(PHONE_REGEX);
  let callerContext = '';
  if (phones?.length) {
    const ctx = await loadCallerContext(workspaceId, phones[0]);
    if (ctx) callerContext = `\n\nCALLER MEMORY for ${phones[0]}:\n${ctx}`;
  }

  // Build agent list for prompt
  const agentsList = agents.map(a => {
    const desc = (a as any).description ? ` — ${(a as any).description}` : '';
    return `- ${a.name} (${a.display_name}, id: ${a.id})${desc}`;
  }).join('\n');

  // Build LLM messages
  const now = new Date().toISOString();
  const systemPrompt = `You are an AI mission planner for a phone call assistant platform.
The user wants you to make a phone call on their behalf.

Your job:
1. Understand what they need
2. Collect all necessary details (phone number, goal, personal data, time preferences)
3. Choose the best agent for the task from the available list
4. Confirm the plan with the user
5. Execute when confirmed

Current date/time: ${now}

AVAILABLE AGENTS:
${agentsList}
${callerContext}

CURRENT MISSION STATE:
${JSON.stringify({ status: mission.status, title: mission.title, target_phone: mission.target_phone, goal: mission.goal, agent_profile_id: mission.agent_profile_id, context: mission.context, fallback_action: mission.fallback_action, scheduled_at: mission.scheduled_at })}

RESPONSE FORMAT:
- For normal conversation: respond naturally in the user's language
- When you have all details, include JSON at the END of your message:
  {"action":"ready","plan":{"title":"...","target_phone":"+1...","goal":"...","agent_profile_id":"...","language":"en","context":{...},"fallback_action":"report"}}
- When user confirms to call NOW: {"action":"execute"}
- When user wants to schedule: {"action":"schedule","at":"2026-04-03T09:00:00Z"}

RULES:
- Respond in the same language as the user
- Be concise like a personal assistant
- Ask for phone number if missing
- ALL phone numbers MUST use +1 (US) country code. NEVER use +7 or any other country code.
- Format phone as E.164: +1XXXXXXXXXX (e.g. +18182775070)
- ALWAYS ask or detect the language of the call. Set "language" in the plan:
  "ru" for Russian, "en" for English, "es" for Spanish, etc.
  Default to "en" if unclear. This determines STT transcription language.
- Suggest the best agent by task type
- For fallback, options are: connect_operator, retry_later, voicemail, report, wait_instructions`;

  const llmMessages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Convert history to LLM messages (skip last user message — already in prompt context)
  for (const msg of history) {
    if (msg.sender_type === 'user') {
      llmMessages.push({ role: 'user', content: msg.content });
    } else if (msg.sender_type === 'ai') {
      llmMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  // Generate AI response
  let aiText: string;
  try {
    aiText = await generateText(workspaceId, llmMessages);
  } catch (err) {
    logger.error({ err, missionId }, 'LLM generation failed');
    aiText = 'Sorry, I encountered an error. Please try again.';
  }

  // Parse JSON actions from response
  const jsonMatch = aiText.match(/\{"action"\s*:\s*"[^"]+"/);
  if (jsonMatch) {
    try {
      const jsonStr = aiText.slice(aiText.indexOf(jsonMatch[0]));
      const jsonEnd = jsonStr.indexOf('}', jsonStr.lastIndexOf('}'));
      const fullJson = jsonStr.slice(0, jsonEnd + 1);
      // Try to find the outermost balanced JSON
      let depth = 0, end = 0;
      for (let i = 0; i < jsonStr.length; i++) {
        if (jsonStr[i] === '{') depth++;
        if (jsonStr[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      const actionJson = JSON.parse(jsonStr.slice(0, end + 1));

      if (actionJson.action === 'ready' && actionJson.plan) {
        const plan = actionJson.plan;
        // Merge language into context
        const mergedContext = { ...(mission.context as any ?? {}), ...(plan.context ?? {}) };
        if (plan.language) mergedContext.language = plan.language;
        await updateMission(missionId, {
          title: plan.title ?? mission.title,
          target_phone: plan.target_phone ?? mission.target_phone,
          goal: plan.goal ?? mission.goal,
          agent_profile_id: plan.agent_profile_id ?? mission.agent_profile_id,
          context: mergedContext,
          fallback_action: plan.fallback_action ?? mission.fallback_action,
          status: 'ready',
        });
        emitStatus(missionId, 'ready');
      } else if (actionJson.action === 'execute') {
        // Don't execute here — let the client call /execute endpoint after seeing the response
        await updateMission(missionId, { status: 'ready' });
        emitStatus(missionId, 'ready');
      } else if (actionJson.action === 'schedule' && actionJson.at) {
        await updateMission(missionId, {
          scheduled_at: actionJson.at,
          status: 'scheduled',
        });
        emitStatus(missionId, 'scheduled');
      }
    } catch (e) {
      logger.warn({ missionId, e }, 'Failed to parse action JSON');
    }
  }

  // Save AI response
  const aiMsg = await addMessage(missionId, 'ai', aiText, 'chat');
  emitMessage(missionId, aiMsg);

  return aiText;
}

// ─── Execute Mission (Start Call) ───────────────────────────────────────────

export async function executeMission(workspaceId: string, missionId: string): Promise<void> {
  const mission = await getMission(workspaceId, missionId);
  if (!mission.target_phone) throw new Error('No target phone number');

  // Safety: if stuck in 'calling', allow re-execute
  if (mission.status === 'calling') {
    await updateMission(missionId, { status: 'ready' } as any);
  }

  // Get agent
  let agentProfile;
  if (mission.agent_profile_id) {
    agentProfile = await agentService.getAgentProfile(workspaceId, mission.agent_profile_id);
  } else {
    agentProfile = await agentService.getDefaultAgentProfile(workspaceId);
  }
  if (!agentProfile) throw new Error('No agent available');

  // Get outbound connection
  const conn = await telephonyService.getOutboundConnection(workspaceId);

  // Create call record
  const call = await callService.createCall({
    workspaceId,
    direction: 'outbound',
    fromNumber: conn.phone_number,
    toNumber: mission.target_phone!,
    conversationOwnerRequested: 'internal',
    agentProfileId: agentProfile.id,
    goal: mission.goal ?? undefined,
    goalSource: 'mission',
    context: mission.context as any,
  });

  // Build enhanced system prompt with mission context
  const missionBriefing = `\n\nMISSION BRIEFING:
Goal: ${mission.goal}
Context: ${JSON.stringify(mission.context)}
Fallback: ${mission.fallback_action === 'connect_operator' ? 'If you cannot complete the goal, say "I need to connect you with someone who can help" and wait.' : mission.fallback_action === 'retry_later' ? 'If the other party asks to call back later, politely agree and end the call.' : 'Do your best to complete the goal. Report what happened.'}`;

  // Create AI session
  await callService.createAiSession({
    callId: call.id,
    workspaceId,
    agentProfileId: agentProfile.id,
    promptSnapshot: (agentProfile.system_prompt ?? '') + missionBriefing,
    conversationOwner: 'internal',
  });

  // Initiate Twilio call
  const callSid = await telephonyService.initiateOutboundCall({
    workspaceId,
    to: mission.target_phone,
    from: conn.phone_number,
    callId: call.id,
    statusCallbackUrl: `https://${env.API_DOMAIN}/webhooks/twilio/status`,
    streamUrl: `wss://${env.API_DOMAIN}/webhooks/ws/media-stream/${call.id}`,
  });

  await callService.updateCallStatus(call.id, 'initiated', { twilio_call_sid: callSid } as any);

  // Update mission
  await updateMission(missionId, {
    call_id: call.id,
    status: 'calling',
    started_at: new Date(),
  } as any);

  // Add system message
  const sysMsg = await addMessage(missionId, 'system', `📞 Calling ${mission.target_phone}...`, 'call_update');
  emitMessage(missionId, sysMsg);
  emitStatus(missionId, 'calling');

  logger.info({ missionId, callId: call.id, phone: mission.target_phone }, 'Mission call initiated');
}

// ─── Socket.IO Helpers ──────────────────────────────────────────────────────

function emitMessage(missionId: string, msg: MissionMessage): void {
  const io = getIo();
  io?.to(`mission:${missionId}`).emit('mission:message', msg);
}

function emitStatus(missionId: string, status: string): void {
  const io = getIo();
  io?.to(`mission:${missionId}`).emit('mission:status', { mission_id: missionId, status });
}
