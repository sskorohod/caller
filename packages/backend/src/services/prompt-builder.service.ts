/**
 * System prompt builder for AI call agents.
 *
 * Extracted from routes/webhooks/media-stream.ts to reduce file size
 * and make prompt logic independently testable.
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../config/db.js';
import { calls as callsTable, aiCallSessions, callerProfiles, callerMemoryFacts } from '../db/schema.js';
import { getLangName } from '../config/languages.js';

export function buildSystemPrompt(
  agentProfile: any,
  promptPacks: any[],
  attachedSkills: any[] = [],
  allSkills: any[] = [],
  call?: any,
  attachedKBs: any[] = [],
): string {
  const parts: string[] = [];

  // Identity block
  if (call?.direction === 'outbound') {
    const ctx = call.context as import('../models/types.js').CallContext;
    const targetName = ctx?.target_name || ctx?.name || ctx?.contact_name;
    const clientName = ctx?.client_name;

    const identityLines = [
      `- YOUR name is: ${agentProfile.display_name}${agentProfile.company_name ? ` (from ${agentProfile.company_name})` : ''}`,
      `- You are making an OUTBOUND phone call to: ${call.to_number}`,
    ];
    if (targetName) {
      identityLines.push(`- The person you are CALLING (who picks up the phone) is: ${targetName}`);
    }
    if (clientName) {
      identityLines.push(`- The CLIENT you are doing this for is: ${clientName}`);
      identityLines.push(`- When speaking to ${targetName || 'the other person'}, say: "Я хотела бы записать ${clientName}..." or "I'd like to book for ${clientName}..."`);
      identityLines.push(`- NEVER say "${clientName} is calling" or "This is ${clientName}". YOU are ${agentProfile.display_name}, and you are booking/arranging something FOR ${clientName}.`);
    }
    identityLines.push(`- REMEMBER: YOU are ${agentProfile.display_name}. Introduce yourself as ${agentProfile.display_name}. NEVER introduce yourself as ${clientName || 'the client'}.`);

    parts.push(`WHO IS WHO:\n${identityLines.join('\n')}`);
  } else {
    parts.push(`You are ${agentProfile.display_name}, an AI phone agent.`);
    if (agentProfile.company_name) parts.push(`You represent ${agentProfile.company_name}.`);
  }
  if (agentProfile.company_identity) parts.push(agentProfile.company_identity);
  if (agentProfile.system_prompt) parts.push(agentProfile.system_prompt);

  // Mission briefing from call goal/context
  if (call?.goal) {
    const missionParts: string[] = [];

    missionParts.push(`MISSION GOAL: ${call.goal}`);

    if (call.context && Object.keys(call.context).length > 0) {
      const skipKeys = ['name', 'target_name', 'contact_name', 'client_name'];
      const contextLines = Object.entries(call.context)
        .filter(([key]) => !skipKeys.includes(key))
        .map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`)
        .join('\n');
      if (contextLines) {
        missionParts.push(`Context (use when relevant, do NOT dump all at once):\n${contextLines}`);
      }
    }

    // Conversation discipline for outbound calls
    if (call.direction === 'outbound') {
      const ctx = call.context as import('../models/types.js').CallContext;
      const clientForGreeting = ctx?.client_name || '';
      const targetForGreeting = ctx?.target_name || ctx?.name || ctx?.contact_name || '';
      missionParts.push(`HOW TO CONDUCT THIS CALL:
- This is a DIALOG, not a monologue. Speak 1-2 sentences, then STOP and WAIT for their response.
- Step 1: GREETING + PURPOSE — Introduce yourself and immediately state why you're calling: "Здравствуйте, меня зовут ${agentProfile.display_name}, я виртуальный помощник. Звоню от имени ${clientForGreeting || 'клиента'}." Then say the purpose in one sentence. Then STOP and WAIT.
- Do NOT ask "Это ${targetForGreeting}?" or confirm identity — just introduce yourself and get to the point.
- NEVER ask "Вам удобно говорить?" — if they picked up, they can talk. Go straight to the point.
- Step 3: Listen. Respond to what THEY said. Ask ONE question at a time.
- NEVER speak more than 2 sentences in a row.
- NEVER mention alternatives or fallbacks upfront. Try the main approach FIRST. Only suggest alternatives if the other person says no.
- NEVER dump all context at once. Use it piece by piece as the conversation flows.
- When done, briefly confirm the result and say goodbye.
- NUMBERS & IDs: When someone dictates a number, ID, passport, phone number, or any sequence of digits/letters — repeat it back DIGIT BY DIGIT, LETTER BY LETTER (e.g. "С-Л-четыре-четыре-один-восемь-Д"). Never group digits (not "44 18" but "четыре, четыре, один, восемь"). This prevents mishearing.`);
    }

    parts.push(missionParts.join('\n\n'));
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

  // Optional skills
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

  // Determine agent gender from voice for correct grammar
  const femaleVoices = ['eve', 'tara', 'ara', 'nova', 'shimmer', 'alloy', 'coral'];
  const isFemale = femaleVoices.includes((agentProfile.voice_id || '').toLowerCase());

  // Language
  const callLanguage = (call?.context as any)?.language || agentProfile.language || 'en';
  const langName = getLangName(callLanguage);

  if (callLanguage === 'ru') {
    parts.push(`Speak in Russian. Respond naturally as if on a phone call.${isFemale ? '\nВАЖНО: Ты женщина. Используй женский род в речи (я позвонила, я записала, я уточнила, рада помочь). НИКОГДА не используй мужской род (позвонил, записал, уточнил).' : ''}`);
  } else {
    parts.push(`Speak in ${langName}. Respond naturally as if on a phone call. ALL your speech MUST be in ${langName} — never switch to another language unless explicitly asked.`);
  }
  parts.push('Keep responses concise — this is a phone conversation, not a chat.');

  // Tone
  const callTone = (call?.context as any)?.tone;
  if (callTone === 'friendly') {
    parts.push('TONE: Friendly, warm, and casual. Use informal register ("ты"). Be cheerful, can use light humor. Sound like a friend helping out.');
  } else if (callTone === 'formal') {
    parts.push('TONE: Strictly formal and official. Use formal register ("вы"). Be very polite, structured, business-like. No jokes or casual language.');
  } else {
    parts.push('TONE: Professional and polite. Use formal register ("вы"). Be respectful but efficient.');
  }
  parts.push('Never use markdown, bullet points, or formatting. Speak naturally.');
  parts.push(`CALL ENDING RULES:
- When the caller says goodbye ("bye", "пока", "до свидания", "всё, пока") — say ONE short farewell (max 5 words) and add [END_CALL] at the end.
- When you have completed your goal/mission — say a brief closing and add [END_CALL].
- NEVER say goodbye more than once. One farewell + [END_CALL]. That's it.
- Do NOT repeat farewell phrases. If you already said goodbye, do NOT generate another response.`);

  return parts.join('\n\n');
}

/**
 * Load context about the caller from memory (profile, facts, previous call summaries).
 */
export async function loadCallerContext(
  workspaceId: string,
  phoneNumber: string,
  direction: string = 'inbound',
): Promise<string | undefined> {
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

  const isOutbound = direction === 'outbound';
  const personLabel = isOutbound ? 'Person you are calling' : 'Caller';

  const parts: string[] = [];
  if (profile.name) parts.push(`${personLabel} name: ${profile.name}`);
  if (profile.relationship) parts.push(`Relationship: ${profile.relationship}`);
  parts.push(`Previous calls: ${profile.total_calls}`);

  if (facts.length > 0) {
    parts.push('Recent context:');
    for (const fact of facts) {
      parts.push(`- [${fact.fact_type}] ${fact.content}`);
    }
  }

  // Load summaries from previous calls
  try {
    const previousCalls = await db.select({
      id: callsTable.id,
      created_at: callsTable.created_at,
    }).from(callsTable)
      .where(and(
        eq(callsTable.workspace_id, workspaceId),
        eq(callsTable.status, 'completed'),
        sql`(${callsTable.to_number} = ${phoneNumber} OR ${callsTable.from_number} = ${phoneNumber})`,
      ))
      .orderBy(desc(callsTable.created_at))
      .limit(3);

    if (previousCalls.length > 0) {
      parts.push('');
      parts.push('Previous call summaries:');
      for (const pc of previousCalls) {
        const [sess] = await db.select({ summary: aiCallSessions.summary }).from(aiCallSessions).where(eq(aiCallSessions.call_id, pc.id));
        if (sess?.summary) {
          const date = new Date(pc.created_at as any).toLocaleString('en-US', { month: 'short', day: 'numeric' });
          parts.push(`- ${date}: ${sess.summary}`);
        }
      }
    }
  } catch { /* ignore — summaries are optional context */ }

  return parts.join('\n');
}
