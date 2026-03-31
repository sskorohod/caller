import { Worker, Queue } from 'bullmq';
import { redis } from '../config/redis.js';
import { createLLMProvider, type LLMMessage } from '../services/llm.service.js';
import * as callService from '../services/call.service.js';
import * as memoryService from '../services/memory.service.js';
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
        // Get LLM provider (use workspace default or cheaper model)
        const llm = await createLLMProvider(workspaceId, 'anthropic');

        // Generate summary + action items in one call
        const messages: LLMMessage[] = [
          {
            role: 'system',
            content: `You are an analytics assistant. Analyze the following phone call transcript and provide:
1. A concise summary (2-3 sentences)
2. Action items (if any)
3. Sentiment (positive/neutral/negative)
4. Key facts about the caller that should be remembered

Respond in JSON format:
{
  "summary": "...",
  "action_items": ["..."],
  "sentiment": "positive|neutral|negative",
  "quality_flags": ["..."],
  "extracted_facts": [{"type": "issue|preference|promise|follow_up|appointment|general", "content": "..."}]
}`,
          },
          {
            role: 'user',
            content: `Transcript:\n${transcriptText}`,
          },
        ];

        let result: any = null;

        await llm.generateStream(messages, 'claude-sonnet-4-5-20250514', 0.3, {
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
        await callService.updateAiSession(sessionId, {
          summary: result.summary,
          action_items: result.action_items ?? [],
          extracted_facts: result.extracted_facts ?? [],
          sentiment: result.sentiment,
          quality_flags: result.quality_flags ?? [],
        } as any);

        // Update caller memory
        if (callerProfileId && result.extracted_facts) {
          for (const fact of result.extracted_facts) {
            await memoryService.addMemoryFact({
              callerProfileId,
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
              callerProfileId,
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
          },
        });

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
