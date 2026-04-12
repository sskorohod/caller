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
  const defaultAgent = agents[0];
  const systemPrompt = `You set up phone calls. Collect info, show plan, output JSON.

CRITICAL RULE: When you have all info OR user confirms, you MUST end your message with this JSON block:
{"action":"ready","plan":{"title":"...","target_phone":"+1...","goal":"...","agent_profile_id":"${defaultAgent?.id || ''}","language":"ru","context":{"target_name":"...","client_name":"..."},"fallback_action":"report"}}
If your message does NOT end with this JSON when the plan is complete, the system BREAKS. The JSON triggers the call button.

Current date/time: ${now}
Agents: ${agentsList}
${callerContext}
Mission state: ${JSON.stringify({ status: mission.status, title: mission.title, target_phone: mission.target_phone, goal: mission.goal, context: mission.context })}

WORKFLOW:
1. User describes what they need
2. If anything is missing (phone, purpose, name), ask in ONE short message
3. When you have everything → show plan summary + JSON at the end
4. If user confirms ("да", "давай", "ок", "готово") → repeat plan briefly + JSON at the end again
5. If user wants to edit ("добавь", "измени", "ещё нужно...") → update the plan and show it again with JSON

REQUIRED before showing plan:
- Phone number (add +1 if 10 digits)
- SPECIFIC purpose (стрижка, консультация, etc.). If user says "запиши меня" without saying WHAT for → ask "На что записать?". NEVER invent a purpose.
- Client name (user's name). If not given → ask "Как вас зовут?"
- Language for the call: "На каком языке вести разговор?" (русский, английский, etc.). Set "language" field accordingly.

OPTIONAL (do NOT insist):
- Preferred appointment time — if user said "на сегодня" without a time, include "в любое удобное время" in goal. If user gives approximate time like "с 6 до 8" → use common sense (PM for haircut). Do NOT demand AM/PM clarification for obvious cases.

DO NOT ASK:
- Duration, how long it will take, or any info the user didn't mention.

Ask ALL missing REQUIRED fields in ONE message.

RULES:
- Respond in user's language. Write goal in user's language.
- Be concise: 2-3 sentences + JSON.
- Times in US format: 2:00 PM, 10:30 AM. Use common sense for AM/PM.
- "language" = primary conversation language ("ru" if user writes Russian).
- If user says "greet in Armenian, talk in Russian" → language="ru", put greeting in goal.
- target_name = who picks up the phone (nominative case: "Манук" not "МанУКу")
- client_name = who the call is FOR (nominative case)
- These are TWO DIFFERENT people.

EXAMPLE correct response:
"Звоним Манук по +18182775070, чтобы записать Славу на стрижку сегодня. Приветствие на армянском, разговор на русском.
{"action":"ready","plan":{"title":"Запись на стрижку","target_phone":"+18182775070","goal":"Позвонить Манук, поздороваться на армянском, записать Славу на стрижку на сегодня, если не получится — на завтра.","agent_profile_id":"${defaultAgent?.id || ''}","language":"ru","context":{"target_name":"Манук","client_name":"Слава"},"fallback_action":"report"}}"
`;

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
        // Treat execute same as ready — show green button
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

  // Save AI response WITH JSON — frontend extracts JSON to render plan card + execute button
  const aiMsg = await addMessage(missionId, 'ai', aiText, 'chat');
  emitMessage(missionId, aiMsg);

  return aiText;
}

// ─── Execute Mission (Start Call) ───────────────────────────────────────────

export async function executeMission(workspaceId: string, missionId: string): Promise<void> {
  const mission = await getMission(workspaceId, missionId);
  if (!mission.target_phone) {
    throw Object.assign(new Error('Mission is not ready — no phone number set. Please complete the plan first.'), { statusCode: 400 });
  }

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

  // Create AI session (promptSnapshot is for audit — actual prompt built at call connect time by buildSystemPrompt)
  await callService.createAiSession({
    callId: call.id,
    workspaceId,
    agentProfileId: agentProfile.id,
    promptSnapshot: agentProfile.system_prompt ?? '',
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
