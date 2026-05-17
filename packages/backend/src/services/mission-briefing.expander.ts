/**
 * Mission briefing expander.
 *
 * Takes the operator's ORIGINAL dictation (verbatim, may be 200+ words) and
 * expands it into a structured Markdown briefing the calling agent uses as its
 * PRIMARY instruction block. The short `mission.goal` produced by the planner
 * is good for UI confirmation but compresses away nuance — branches, exact
 * phrasing, specific jokes. The expander does the OPPOSITE: it never adds new
 * requirements (anti-hallucination contract) and writes NULL whenever the
 * dictation doesn't specify something.
 *
 * Runs in the background right after the planner emits {action: 'ready'}.
 * Result is stored on `missions.briefing` and rendered into the system prompt
 * by prompt-builder.service.ts. Idempotent: each ready re-generates and
 * overwrites the briefing.
 */
import pino from 'pino';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import { missions, missionMessages } from '../db/schema.js';
import { createLLMProvider, type LLMMessage } from './llm.service.js';
import { getIo } from '../realtime/io.js';

const logger = pino({ name: 'mission-briefing-expander' });

const EXPANDER_SYSTEM_PROMPT = `You are an agent briefing writer.

Your job: take an operator's RAW DICTATION of a phone-call task plus a few context fields, and write a STRUCTURED BRIEFING that the calling AI agent will follow.

CRITICAL ANTI-HALLUCINATION CONTRACT:
- NEVER invent requirements, branches, jokes, or phrases that are NOT in the dictation.
- If a section has no data in the dictation, write literally "NULL" — do NOT make something up.
- For EXACT PHRASING, only quote the operator verbatim (in quotation marks). Do not paraphrase. If they didn't ask for specific words, write NULL.
- Preserve the operator's first-person/third-person framing exactly.
- Preserve conditional branches verbatim ("if X then Y" structure).
- Do not invent the operator's tone unless they specified it.

OUTPUT FORMAT — exactly these 6 sections in Markdown, in this order:

**PRIMARY GOAL**
One sentence stating the main objective. Keep operator's framing (e.g. "записать клиента на стрижку у Манука сегодня после 4").

**CONDITIONAL BRANCHES**
List each IF/THEN branch the operator described. Use this format:
- IF <condition> THEN <action>
- IF <condition> THEN <action>
If the dictation has no conditional logic, write NULL.

**EXACT PHRASING**
Quotes from the operator showing words the agent MUST say verbatim (greetings, scripted lines, etc.). Each on its own bullet, in double quotes. If the operator didn't specify exact words, write NULL.

**HUMOR / TONE CUES**
Specific jokes, tonal direction, or playful asides the operator wants. Quote or paraphrase only what's in the dictation. If they said "пошути что-нибудь" without specifying content — write "Operator wants one short playful line, content open." If no humor was requested, write NULL.

**INFO TO COLLECT**
Bullet list of facts the agent needs to gather/confirm during the call (target's availability, prices, names, addresses, etc.). If nothing needs collecting, write NULL.

**REPORT-BACK**
What information the operator expects in the final summary (e.g. "confirmed appointment time", "reason for refusal", "alternative offered"). If not stated, write NULL.

Write in the operator's language (Russian if dictation is in Russian, English if English). Be concise — 50-100 words per section is plenty. No fluff, no commentary, no introduction. Start the output with the first **PRIMARY GOAL** heading.`;

export async function expandMissionBriefing(missionId: string, workspaceId: string): Promise<string | null> {
  try {
    // Fetch mission for context fields
    const [mission] = await db.select().from(missions).where(eq(missions.id, missionId)).limit(1);
    if (!mission) {
      logger.warn({ missionId }, 'Mission not found, skipping briefing expansion');
      return null;
    }

    // Pull operator's first chat message — the verbatim dictation
    const [firstUserMsg] = await db.select({ content: missionMessages.content })
      .from(missionMessages)
      .where(and(
        eq(missionMessages.mission_id, missionId),
        eq(missionMessages.sender_type, 'user'),
        eq(missionMessages.message_type, 'chat'),
      ))
      .orderBy(asc(missionMessages.created_at))
      .limit(1);

    const dictation = firstUserMsg?.content;
    if (!dictation || dictation.trim().length < 10) {
      logger.info({ missionId }, 'No usable operator dictation found, skipping briefing expansion');
      return null;
    }

    // Select an LLM provider — try anthropic first, fall back to xai, then openai
    let llm;
    let selectedProvider: string = 'anthropic';
    for (const provider of ['anthropic', 'xai', 'openai'] as const) {
      try {
        llm = await createLLMProvider(workspaceId, provider);
        selectedProvider = provider;
        break;
      } catch { /* try next */ }
    }
    if (!llm) {
      logger.warn({ missionId }, 'No LLM provider available for briefing expansion');
      return null;
    }

    const providerModelMap: Record<string, string> = {
      anthropic: 'claude-sonnet-4-5-20250514',
      xai: 'grok-3-mini-fast',
      openai: 'gpt-4o-mini',
    };
    const model = providerModelMap[selectedProvider] || 'claude-sonnet-4-5-20250514';

    const ctx = (mission.context as Record<string, unknown>) ?? {};
    const contextLines: string[] = [];
    if (ctx.target_name) contextLines.push(`Target: ${ctx.target_name}`);
    if (ctx.client_name) contextLines.push(`Client (on whose behalf the call is made): ${ctx.client_name}`);
    if (ctx.language) contextLines.push(`Language: ${ctx.language}`);
    if (ctx.tone) contextLines.push(`Tone preset: ${ctx.tone}`);
    if (mission.target_phone) contextLines.push(`Phone: ${mission.target_phone}`);

    const userMsg = `CONTEXT:\n${contextLines.join('\n') || '(none)'}\n\nRAW OPERATOR DICTATION:\n"""${dictation}"""\n\nGenerate the 6-section briefing now.`;

    const messages: LLMMessage[] = [
      { role: 'system', content: EXPANDER_SYSTEM_PROMPT },
      { role: 'user', content: userMsg },
    ];

    let briefing = '';
    await llm.generateStream(messages, model, 0.2, {
      onToken: () => { /* unused */ },
      onComplete: (response) => {
        briefing = response.text.trim();
      },
      onError: (err) => {
        logger.error({ err, missionId }, 'Briefing expander LLM error');
      },
    });

    if (!briefing) {
      logger.warn({ missionId }, 'Briefing expander returned empty result');
      return null;
    }

    // Persist on mission
    await db.update(missions).set({ briefing, updated_at: new Date() }).where(eq(missions.id, missionId));

    // Write a system message into the mission chat as a preview
    const previewContent = `📋 <b>Инструктаж агента сгенерирован</b>\n\n${briefing}`;
    const [sysMsg] = await db.insert(missionMessages).values({
      mission_id: missionId,
      sender_type: 'system',
      message_type: 'briefing',
      content: previewContent,
      metadata: { source: 'briefing_expander', provider: selectedProvider, model },
    }).returning();

    // Emit to socket room so the dashboard chat updates live
    try {
      const io = getIo();
      io?.to(`mission:${missionId}`).emit('mission:message', sysMsg);
    } catch { /* socket optional */ }

    logger.info({ missionId, length: briefing.length, provider: selectedProvider }, 'Mission briefing expanded');
    return briefing;
  } catch (err) {
    logger.error({ err, missionId }, 'Briefing expansion failed (non-fatal)');
    return null;
  }
}
