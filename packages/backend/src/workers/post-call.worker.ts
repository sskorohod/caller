import { Worker, Queue } from 'bullmq';
import { redis } from '../config/redis.js';
import { createLLMProvider, type LLMMessage } from '../services/llm.service.js';
import * as callService from '../services/call.service.js';
import * as memoryService from '../services/memory.service.js';
import { deliverWebhookEvent } from '../services/webhook.service.js';
import { db } from '../config/db.js';
import { qaEvaluations, calls } from '../db/schema.js';
import { eq } from 'drizzle-orm';
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

        // Detect transcript language (use first caller utterance)
        const firstCallerText = transcript.find(t => t.speaker === 'caller')?.text || '';
        const hasRussian = /[а-яА-ЯёЁ]/.test(firstCallerText);
        const hasSpanish = /[ñÑáéíóú¿¡]/.test(firstCallerText);
        const transcriptLang = hasRussian ? 'Russian' : hasSpanish ? 'Spanish' : 'English';

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

IMPORTANT: Write the summary, action_items, and extracted_facts content in ${transcriptLang} — the same language as the conversation.

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

        // Use appropriate model based on provider
        const model = (llm as any).client?.baseURL?.includes('x.ai') ? 'grok-3-mini-fast'
          : (llm as any).client?.apiKey ? 'gpt-4o-mini' : 'claude-sonnet-4-5-20250514';
        await llm.generateStream(messages, model, 0.3, {
          onToken: () => {},
          onComplete: (response) => {
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

        // Deliver session.summary_ready webhook
        deliverWebhookEvent(workspaceId, 'session.summary_ready', {
          call_id: callId,
          session_id: sessionId,
          summary: result.summary,
          sentiment: result.sentiment,
          qa_score: qaScore,
          action_items: result.action_items ?? [],
        }).catch(() => {});

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
