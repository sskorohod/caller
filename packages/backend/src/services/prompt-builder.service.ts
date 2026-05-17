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

function renderCoreSkill(s: any, opts: { disableEscalation?: boolean } = {}): string {
  const lines: string[] = [`[${s.name}]`];
  if (s.conversation_rules) lines.push(s.conversation_rules);
  if (s.opening_line) lines.push(`Opening line: "${s.opening_line}"`);
  if (s.talk_listen_ratio) lines.push(`Talk-listen ratio target: speak no more than ${Math.round(Number(s.talk_listen_ratio) * 100)}% of the time.`);

  if (s.bridging_phrases?.length) {
    lines.push(`When you need a moment (lookup, thinking), use one of: ${s.bridging_phrases.map((p: string) => `"${p}"`).join(', ')}.`);
  }

  const branches = Array.isArray(s.objection_branches) ? s.objection_branches : [];
  if (branches.length) {
    const tree = branches
      .map((b: any) => `- If "${b.trigger}" → ${b.response}${b.action ? ` (then: ${b.action})` : ''}`)
      .join('\n');
    lines.push(`Objection handling:\n${tree}`);
  }

  // Skip escalation_tags entirely on outbound mission calls — there is no
  // human available to take the hand-off. The outbound prompt block adds an
  // explicit "no escalation" override to neutralize any escalation language
  // that may still be in conversation_rules.
  if (!opts.disableEscalation && s.escalation_tags?.length) {
    lines.push(`Escalate to a human (do NOT improvise) when the call hits any of: ${s.escalation_tags.join(', ')}. Acknowledge, tag the call, and offer a human callback.`);
  }

  if (s.requires_explicit_confirmation) {
    lines.push(`Before marking the goal as complete, repeat the outcome back and get an explicit "yes/да". Do not assume agreement from silence.`);
  }

  return lines.join('\n');
}

export function buildSystemPrompt(
  agentProfile: any,
  promptPacks: any[],
  attachedSkills: any[] = [],
  allSkills: any[] = [],
  call?: any,
  attachedKBs: any[] = [],
  timezone: string = 'America/Los_Angeles',
): string {
  const parts: string[] = [];

  // CURRENT DATE & TIME (first thing in the prompt) — so the agent always
  // knows what "today / tomorrow / в пятницу / next week / после 4" means
  // when scheduling. Always uses the workspace timezone.
  try {
    const now = new Date();
    const dateFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const timeFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
    const cityFromTz = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;
    parts.push(`CURRENT DATE & TIME: ${dateFmt.format(now)}, ${timeFmt.format(now)} (${cityFromTz} time, ${timezone}).\nUse this when scheduling — "today/сегодня" = this exact date, "tomorrow/завтра" = the next day, "next Monday/в следующий понедельник" = the next occurrence of that weekday. Never invent dates.`);
  } catch { /* timezone parse error — skip block rather than crash */ }

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

    // Briefing-expander output is the PRIMARY instruction block when present
    // (generated from the operator's verbatim dictation right after the planner
    // emits {action: 'ready'}). The short MISSION GOAL becomes UI-only. The
    // original dictation stays nearby verbatim as the source of truth.
    const briefing = (call.context as any)?.briefing as string | undefined;
    const originalInstructions = (call.context as any)?.original_instructions as string | undefined;

    if (briefing) {
      missionParts.push(`AGENT BRIEFING (PRIMARY — follow this. Generated from the operator's verbatim instructions):\n${briefing}`);
      if (originalInstructions) {
        missionParts.push(`ORIGINAL OPERATOR INSTRUCTIONS (source of truth — refer to this when the briefing is ambiguous):\n"${originalInstructions}"`);
      }
    } else {
      // Fallback: legacy behavior when no briefing was generated (older missions,
      // expander failure). Use the short goal + original instructions if available.
      missionParts.push(`MISSION GOAL: ${call.goal}`);
      if (originalInstructions) {
        missionParts.push(`ORIGINAL OPERATOR INSTRUCTIONS (verbatim — use for nuance, exact phrasing, and any conditional branches the short goal may have lost):\n"${originalInstructions}"`);
      }
    }

    if (call.context && Object.keys(call.context).length > 0) {
      const skipKeys = ['name', 'target_name', 'contact_name', 'client_name', 'original_instructions', 'briefing'];
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
      // Detect joke/humor request in the goal — keyword scan.
      const goalLower = (call.goal || '').toLowerCase();
      const wantsHumor = /\b(пошутить|шутку|шутка|с юмором|joke|funny|light|playful|with humor)\b/.test(goalLower);
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
- NUMBERS & IDs: When someone dictates a number, ID, passport, phone number, or any sequence of digits/letters — repeat it back DIGIT BY DIGIT, LETTER BY LETTER (e.g. "С-Л-четыре-четыре-один-восемь-Д"). Never group digits (not "44 18" but "четыре, четыре, один, восемь"). This prevents mishearing.${wantsHumor ? `
- HUMOR REQUESTED: The goal asks you to be playful. Drop ONE short light remark or playful aside RIGHT BEFORE the farewell — situational, not a stand-up routine. Examples: "Ну, со стрижкой главное не моргнуть!", "Передам Славе — пусть готовится выглядеть на миллион!", "А я ему скажу не опаздывать, а то на улицу не пустим без причёски!". Keep it ≤10 words. Do NOT force a joke if the call went poorly or the other person sounded annoyed.` : ''}
- NO HUMAN HAND-OFF: You are an autonomous outbound caller. NEVER offer to "transfer to a human", "connect to a specialist", "let a colleague call back", or "передать коллеге / специалисту". There is no human available right now. If you genuinely cannot help, acknowledge politely, suggest the caller can email or call back during business hours, and end the call with [END_CALL]. This rule OVERRIDES any earlier escalation instructions from skills.${clientForGreeting ? `
- CALLER ROLE — YOU ARE THE SUPPLICANT: You are calling ${targetForGreeting || 'someone'} on behalf of ${clientForGreeting}. THEY are doing YOU a favor by taking this call and helping. Be deferential and grateful, not directive.
  - ASK politely — never DEMAND. "Удобно записать на 4?" not "Подтвердите время". "Скажите, пожалуйста, во сколько" not "Назовите время".
  - NEVER say "Подтвердите" / "Confirm". Use "Удобно так?", "Всё верно?", "Подходит?", "Можно так?" instead.
  - If they already gave information, do NOT ask them to repeat or confirm it. One implicit acknowledgement is enough. ("Хорошо, на 4 — записываем Славу.") Then move on.
  - When they offer something (a time, a slot) — accept it gracefully. Don't second-guess or re-confirm.
  - End with thanks: "Спасибо большое!" / "Thanks so much!" — not just "до свидания".
  - DO NOT demand confirmation of names, dates, or numbers that the OTHER side gave you. Repeat once for clarity, then accept. Only repeat-back applies when YOU dictate to them (rare in supplicant role).
  - WHEN THEY PROPOSE — JUST ACCEPT. If the other side PROPOSED a specific time, slot, or option themselves ("В пять подойдёт?", "Могу записать на 3", "Давайте в среду") — they already decided it works FOR THEM. NEVER ask "удобно так?" / "is it convenient?" — that's redundant and slightly rude (they wouldn't propose what doesn't work). Just acknowledge directly: "Отлично, на пять — записываем!" / "Среда — супер!". Move straight to thanks/closing.` : ''}`);
    }

    parts.push(missionParts.join('\n\n'));
  }

  for (const pack of promptPacks) {
    if (pack.content) parts.push(`--- ${pack.name} ---\n${pack.content}`);
  }

  // Core skills (always active — full conversation rules + human-likeness fields)
  const isOutbound = call?.direction === 'outbound';
  if (attachedSkills.length > 0) {
    const coreSkillParts = attachedSkills
      .filter(s => s.conversation_rules || s.opening_line || (s.objection_branches?.length))
      .map(s => renderCoreSkill(s, { disableEscalation: isOutbound }));
    if (coreSkillParts.length > 0) {
      parts.push(`CORE SKILLS (always active):\n${coreSkillParts.join('\n\n')}`);
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

  // Tone — each preset combines a register choice with concrete VOCAL DIRECTION
  // so the LLM (and Grok realtime) shape prosody, not just word choice.
  const callTone = (call?.context as any)?.tone;
  if (callTone === 'cheerful') {
    parts.push(`TONE: Cheerful, upbeat, playful. WARMTH ≠ INFORMALITY.
REGISTER: Default to "вы" with strangers, service providers, anyone older, or in a business context. Switch to "ты" ONLY if (a) you clearly know them personally, (b) they switched to "ты" first, or (c) the goal/context says to. With a barber, dentist, receptionist, or other service provider you've never met — stay on "вы" no matter how cheerful the tone. (In English just be warm.)
VOCAL DIRECTION: Smile audibly while speaking. Vary your pitch — up on questions, down on warmth. Use contractions everywhere ("I'd", "у нас", "не-а"). Occasional gentle laugh ("ха", "hehe") where appropriate. Light, energetic pace — never rushed. Small affirmations ("отлично", "супер", "класс", "love that") when the caller shares something.`);
  } else if (callTone === 'friendly') {
    parts.push(`TONE: Friendly, warm, and casual. WARMTH ≠ INFORMALITY.
REGISTER: Default to "вы" with strangers, service providers, anyone older, or in a business context. Switch to "ты" ONLY if (a) you know them personally, (b) they used "ты" first, or (c) the goal explicitly says so. Warmth comes from tone, not from register.
VOCAL DIRECTION: Slight smile in your voice. Use contractions ("я", "не", "у нас"). Vary pitch and pace — don't be flat. Occasional "ага", "понял", "ну да" between thoughts. Empathy markers when caller mentions a problem ("понимаю", "ох").`);
  } else if (callTone === 'formal') {
    parts.push('TONE: Strictly formal and official. Use formal register ("вы"). Be very polite, structured, business-like. No jokes or casual language. VOCAL DIRECTION: Even pace, neutral pitch, deliberate enunciation. No filler interjections.');
  } else {
    parts.push('TONE: Professional and polite. Use formal register ("вы"). Be respectful but efficient. VOCAL DIRECTION: Steady warm pace, slight melodic variation on questions, no sing-song.');
  }

  // Per-agent custom voice direction — overrides nothing, layers on top.
  // Users write something like "слегка игривый, тёплый, с короткими паузами
  // перед именами, без формальностей" and it gets injected verbatim.
  if (agentProfile.voice_vibe?.trim()) {
    parts.push(`VOICE DIRECTION (custom for this agent): ${agentProfile.voice_vibe.trim()}`);
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
