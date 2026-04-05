import { Worker, Queue } from 'bullmq';
import { redis } from '../config/redis.js';
import { createLLMProvider, type LLMMessage } from '../services/llm.service.js';
import * as callService from '../services/call.service.js';
import * as memoryService from '../services/memory.service.js';
import { deliverWebhookEvent } from '../services/webhook.service.js';
import { calculateLLMCost } from '../config/pricing.js';
import { db } from '../config/db.js';
import { qaEvaluations, calls, workspaces, aiCallSessions, missions, missionMessages } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { getIo } from '../realtime/io.js';
import pino from 'pino';

const logger = pino({ name: 'post-call-worker' });

export const postCallQueue = new Queue('post-call', { connection: redis });

interface PostCallJobData {
  callId: string;
  sessionId: string;
  workspaceId: string;
  callerProfileId?: string;
}

/**
 * Post-call processing worker.
 * Generates summary, extracts action items, updates memory.
 */
export function startPostCallWorker(): Worker {
  const worker = new Worker<PostCallJobData>(
    'post-call',
    async (job) => {
      const { callId, sessionId, workspaceId, callerProfileId } = job.data;
      logger.info({ callId, sessionId }, 'Processing post-call analytics');

      // Load session
      const session = await callService.getAiSession(callId);
      if (!session?.transcript) {
        logger.warn({ callId }, 'No transcript found, skipping');
        return;
      }

      const transcript = session.transcript as Array<{ speaker: string; text: string; timestamp: string }>;
      if (transcript.length === 0) return;

      // Format transcript for LLM
      const transcriptText = transcript
        .map(t => `${t.speaker}: ${t.text}`)
        .join('\n');

      try {
        // Get LLM provider — try anthropic first, fall back to xai, then openai
        let llm;
        for (const provider of ['anthropic', 'xai', 'openai'] as const) {
          try {
            llm = await createLLMProvider(workspaceId, provider);
            break;
          } catch { /* try next */ }
        }
        if (!llm) throw new Error('No LLM provider configured for post-call analysis');

        // Use workspace primary language for summary output
        const [ws] = await db.select({ languages: workspaces.languages })
          .from(workspaces)
          .where(eq(workspaces.id, workspaceId));
        const primaryLang = ws?.languages?.[0] || 'en';
        const langMap: Record<string, string> = { en: 'English', ru: 'Russian', es: 'Spanish', de: 'German', fr: 'French' };
        const summaryLang = langMap[primaryLang] || 'English';

        // Generate summary + action items in one call
        const messages: LLMMessage[] = [
          {
            role: 'system',
            content: `You are an analytics assistant. Analyze the following phone call transcript and provide:
1. A concise summary (2-3 sentences)
2. Action items (if any)
3. Sentiment (positive/neutral/negative)
4. Key facts about the caller that should be remembered
5. QA evaluation: score 0-10 and criteria breakdown

IMPORTANT: Write ALL output (summary, action_items, extracted_facts, quality_flags, qa_criteria comments) in ${summaryLang}.
CRITICAL: Do NOT localize or adapt proper nouns, brand names, institutions, or cultural references. Keep them exactly as mentioned in the conversation. For example: DMV stays DMV (not ГИБДД), Costco stays Costco, etc. Write in ${summaryLang} but preserve original terminology.

Respond in JSON format:
{
  "summary": "...",
  "action_items": ["..."],
  "sentiment": "positive|neutral|negative",
  "quality_flags": ["..."],
  "extracted_facts": [{"type": "issue|preference|promise|follow_up|appointment|general", "content": "..."}],
  "qa_score": 8.5,
  "qa_criteria": [
    {"name": "greeting", "score": 9, "max": 10, "comment": "..."},
    {"name": "problem_resolution", "score": 8, "max": 10, "comment": "..."},
    {"name": "professionalism", "score": 9, "max": 10, "comment": "..."},
    {"name": "closing", "score": 8, "max": 10, "comment": "..."}
  ]
}`,
          },
          {
            role: 'user',
            content: `Transcript:\n${transcriptText}`,
          },
        ];

        let result: any = null;
        let postCallTokensIn = 0;
        let postCallTokensOut = 0;

        // Use appropriate model based on provider
        const model = (llm as any).client?.baseURL?.includes('x.ai') ? 'grok-3-mini-fast'
          : (llm as any).client?.apiKey ? 'gpt-4o-mini' : 'claude-sonnet-4-5-20250514';
        await llm.generateStream(messages, model, 0.3, {
          onToken: () => {},
          onComplete: (response) => {
            postCallTokensIn = response.tokensIn;
            postCallTokensOut = response.tokensOut;
            try {
              // Extract JSON from response
              const jsonMatch = response.text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
              }
            } catch {
              logger.warn({ callId }, 'Failed to parse post-call analysis');
            }
          },
          onError: (err) => {
            logger.error({ err, callId }, 'Post-call LLM error');
          },
        });

        if (!result) return;

        // Update AI session
        const qaScore = typeof result.qa_score === 'number' ? result.qa_score : null;
        await callService.updateAiSession(sessionId, {
          summary: result.summary,
          action_items: result.action_items ?? [],
          extracted_facts: result.extracted_facts ?? [],
          sentiment: result.sentiment,
          quality_flags: result.quality_flags ?? [],
          qa_score: qaScore != null ? String(qaScore) : null,
        } as any);

        // Increment LLM cost with post-call analysis tokens
        if (postCallTokensIn > 0 || postCallTokensOut > 0) {
          const postCallCost = calculateLLMCost(model, postCallTokensIn, postCallTokensOut);
          await db.update(aiCallSessions)
            .set({
              cost_llm: sql`(coalesce(cost_llm, 0) + ${postCallCost.toFixed(6)}::numeric)::numeric(10,6)`,
              cost_total: sql`(coalesce(cost_total, 0) + ${postCallCost.toFixed(6)}::numeric)::numeric(10,6)`,
              total_tokens_in: sql`coalesce(total_tokens_in, 0) + ${postCallTokensIn}`,
              total_tokens_out: sql`coalesce(total_tokens_out, 0) + ${postCallTokensOut}`,
            })
            .where(eq(aiCallSessions.id, sessionId));
          logger.info({ callId, postCallCost, postCallTokensIn, postCallTokensOut }, 'Post-call LLM cost added');
        }

        // Insert QA evaluation
        if (qaScore != null) {
          await db.insert(qaEvaluations).values({
            session_id: sessionId,
            workspace_id: workspaceId,
            criteria: result.qa_criteria ?? [],
            overall_score: String(qaScore),
            evaluated_by: 'system',
          });
        }

        // Resolve caller profile — find by phone if not passed
        let resolvedProfileId = callerProfileId;
        if (!resolvedProfileId) {
          const [call] = await db.select({ from_number: calls.from_number }).from(calls).where(eq(calls.id, callId));
          if (call?.from_number) {
            const profile = await memoryService.findOrCreateCallerProfile(workspaceId, call.from_number);
            resolvedProfileId = profile.id;
            // Also update the call record
            await db.update(calls).set({ caller_profile_id: resolvedProfileId }).where(eq(calls.id, callId));
          }
        }

        // Update caller memory
        if (resolvedProfileId && result.extracted_facts) {
          for (const fact of result.extracted_facts) {
            await memoryService.addMemoryFact({
              callerProfileId: resolvedProfileId,
              workspaceId,
              factType: fact.type ?? 'general',
              content: fact.content,
              sourceCallId: callId,
            });
          }

          // Save summary as memory
          if (result.summary) {
            await memoryService.extractAndSaveMemory({
              workspaceId,
              callId,
              callerProfileId: resolvedProfileId,
              transcript,
              summary: result.summary,
            });
          }
        }

        // Log event
        await callService.addCallEvent({
          callId,
          workspaceId,
          eventType: 'post_call_analysis_complete',
          eventData: {
            summary: result.summary,
            sentiment: result.sentiment,
            actionItemCount: result.action_items?.length ?? 0,
            factCount: result.extracted_facts?.length ?? 0,
            qaScore: qaScore,
          },
        });

        // Update mission if this call belongs to one
        try {
          let [mission] = await db.select().from(missions).where(eq(missions.call_id, callId));
          // Fallback: find any mission stuck in 'calling' for this workspace
          if (!mission) {
            const { and: andOp } = await import('drizzle-orm');
            [mission] = await db.select().from(missions)
              .where(andOp(eq(missions.status, 'calling'), eq(missions.workspace_id, workspaceId)))
              .limit(1);
          }
          if (mission) {
            await db.update(missions).set({
              status: 'completed',
              outcome: { summary: result.summary, action_items: result.action_items, sentiment: result.sentiment, qa_score: qaScore },
              completed_at: new Date(),
              updated_at: new Date(),
            }).where(eq(missions.id, mission.id));

            // Add report message to mission chat
            const reportText = `✅ Call completed!\n${result.summary ?? 'No summary available.'}`;
            await db.insert(missionMessages).values({
              mission_id: mission.id,
              sender_type: 'system',
              content: reportText,
              message_type: 'report',
            });

            // Emit to mission room
            const io = getIo();
            io?.to(`mission:${mission.id}`).emit('mission:status', { mission_id: mission.id, status: 'completed' });
            io?.to(`mission:${mission.id}`).emit('mission:message', {
              mission_id: mission.id,
              sender_type: 'system',
              content: reportText,
              message_type: 'report',
              created_at: new Date().toISOString(),
            });

            logger.info({ callId, missionId: mission.id }, 'Mission updated with call result');
          }
        } catch (missionErr) {
          logger.error({ missionErr, callId }, 'Failed to update mission after call');
        }

        // Deliver session.summary_ready webhook
        deliverWebhookEvent(workspaceId, 'session.summary_ready', {
          call_id: callId,
          session_id: sessionId,
          summary: result.summary,
          sentiment: result.sentiment,
          qa_score: qaScore,
          action_items: result.action_items ?? [],
        }).catch((err: unknown) => { logger.warn({ err, callId }, 'Webhook delivery failed for session.summary_ready'); });

        logger.info({ callId }, 'Post-call analysis complete');
      } catch (err) {
        logger.error({ err, callId }, 'Post-call processing failed');
        throw err; // Will retry
      }
    },
    {
      connection: redis,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Post-call job failed');
  });

  return worker;
}

/**
 * Queue a call for post-call processing.
 */
export async function queuePostCallProcessing(data: PostCallJobData): Promise<void> {
  await postCallQueue.add('process', data, {
    delay: 2000, // 2s delay to ensure session data is flushed
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
}
