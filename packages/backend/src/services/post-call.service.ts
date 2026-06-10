/**
 * Lightweight post-call analysis (summary, title, action items, sentiment).
 *
 * Replaces the BullMQ post-call worker removed in the translator-only split —
 * deleting the worker silently dropped the "queue post-call" step from
 * finalizeSession, so calls after 2026-06-06 had no summary/short_title.
 * Translator calls only need the analytics subset, so this is a single LLM
 * call fired-and-forgotten from finalizeSession — no queue.
 */
import { eq, sql } from 'drizzle-orm';
import pino from 'pino';
import { db } from '../config/db.js';
import { aiCallSessions, workspaces } from '../db/schema.js';
import { calculateLLMCost } from '../config/pricing.js';
import * as callService from './call.service.js';
import { createLLMProvider, type LLMMessage, type LLMProvider } from './llm.service.js';

const log = pino({ name: 'post-call' });

export async function runPostCallAnalysis(params: {
  callId: string;
  sessionId: string;
  workspaceId: string;
}): Promise<void> {
  const { callId, sessionId, workspaceId } = params;

  const session = await callService.getAiSession(callId);
  const transcript = (session?.transcript ?? []) as Array<{ speaker: string; text: string }>;
  if (transcript.length === 0) {
    log.info({ callId }, 'No transcript, skipping post-call analysis');
    return;
  }
  if (session?.summary) return; // already analyzed (also makes backfill idempotent)

  const transcriptText = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');

  // LLM provider fallback chain (resolved from the platform admin's credentials)
  let llm: LLMProvider | undefined;
  let selectedProvider: 'anthropic' | 'xai' | 'openai' = 'anthropic';
  for (const provider of ['anthropic', 'xai', 'openai'] as const) {
    try {
      llm = await createLLMProvider(workspaceId, provider);
      selectedProvider = provider;
      break;
    } catch { /* try next */ }
  }
  if (!llm) {
    log.warn({ callId }, 'No LLM provider configured for post-call analysis');
    return;
  }

  // Summary language = workspace primary language
  const [ws] = await db.select({ languages: workspaces.languages })
    .from(workspaces).where(eq(workspaces.id, workspaceId));
  const primaryLang = ws?.languages?.[0] || 'en';
  const { getLangName } = await import('../config/languages.js');
  const summaryLang = getLangName(primaryLang);

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `You are an analytics assistant. Analyze the following phone call transcript and provide:
1. A short title (max 5-6 words) — the essence of what the call was about.
2. A concise summary (2-3 sentences)
3. Action items (if any)
4. Sentiment (positive/neutral/negative)

IMPORTANT: Write ALL output (short_title, summary, action_items) in ${summaryLang}.
CRITICAL: Do NOT localize or adapt proper nouns, brand names, institutions, or cultural references. Keep them exactly as mentioned in the conversation (DMV stays DMV, Costco stays Costco).

Respond in JSON format:
{
  "short_title": "...",
  "summary": "...",
  "action_items": ["..."],
  "sentiment": "positive|neutral|negative"
}`,
    },
    { role: 'user', content: `Transcript:\n${transcriptText}` },
  ];

  const providerModelMap: Record<string, string> = {
    anthropic: 'claude-sonnet-4-6-20250827',
    xai: 'grok-3-mini-fast',
    openai: 'gpt-4o-mini',
  };
  const model = providerModelMap[selectedProvider];

  // `unknown` (not a narrowed union) because the assignment happens inside a
  // callback TypeScript's control-flow analysis can't see.
  let resultRaw: unknown = null;
  let tokensIn = 0;
  let tokensOut = 0;
  await llm.generateStream(messages, model, 0.3, {
    onToken: () => {},
    onComplete: (response) => {
      tokensIn = response.tokensIn;
      tokensOut = response.tokensOut;
      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) resultRaw = JSON.parse(jsonMatch[0]);
      } catch {
        log.warn({ callId }, 'Failed to parse post-call analysis');
      }
    },
    onError: (err) => {
      log.error({ err, callId }, 'Post-call LLM error');
    },
  });
  const analysis = resultRaw as { short_title?: string; summary?: string; action_items?: string[]; sentiment?: string } | null;
  if (!analysis) return;

  await callService.updateAiSession(sessionId, {
    summary: analysis.summary ?? null,
    short_title: analysis.short_title ?? null,
    action_items: analysis.action_items ?? [],
    sentiment: analysis.sentiment ?? null,
  } as any);

  // Bill the analysis tokens like any other LLM usage (admin's own usage is
  // exempt inside deductUsageCost).
  if (tokensIn > 0 || tokensOut > 0) {
    const cost = calculateLLMCost(model, tokensIn, tokensOut);
    await db.update(aiCallSessions)
      .set({
        cost_llm: sql`(coalesce(cost_llm, 0) + ${cost.toFixed(6)}::numeric)::numeric(10,6)`,
        cost_total: sql`(coalesce(cost_total, 0) + ${cost.toFixed(6)}::numeric)::numeric(10,6)`,
        total_tokens_in: sql`coalesce(total_tokens_in, 0) + ${tokensIn}`,
        total_tokens_out: sql`coalesce(total_tokens_out, 0) + ${tokensOut}`,
      })
      .where(eq(aiCallSessions.id, sessionId));
    try {
      const { deductUsageCost } = await import('./billing.service.js');
      await deductUsageCost({
        workspaceId,
        providerCosts: { stt: 0, llm: cost, tts: 0, telephony: 0, llmProvider: selectedProvider },
        providerConfig: {},
        referenceType: 'call_session',
        referenceId: sessionId,
      });
    } catch (err) {
      log.error({ err, callId }, 'Failed to deduct post-call LLM cost');
    }
  }

  log.info({ callId, provider: selectedProvider }, 'Post-call analysis complete');
}

/**
 * Recover a missing transcript from the stored call recording (MinIO) via the
 * Deepgram pre-recorded API. Used when live transcription produced nothing but
 * the recording exists (e.g. the STT/Grok session died mid-call).
 *
 * Not billed: live STT for the call was already billed at finalization; this
 * is recovery from a platform-side failure.
 *
 * Returns true if a transcript was recovered and saved.
 */
export async function transcribeFromRecording(params: {
  callId: string;
  sessionId: string;
  workspaceId: string;
}): Promise<boolean> {
  const { callId, sessionId, workspaceId } = params;

  const session = await callService.getAiSession(callId);
  if (!session) return false;
  const existing = (session.transcript ?? []) as unknown[];
  if (existing.length > 0) return false; // live transcript exists — nothing to recover
  const url = session.recording_url;
  if (!url || !url.startsWith('minio://')) {
    log.info({ callId, url }, 'No MinIO recording to transcribe');
    return false;
  }

  const { getRecordingBuffer } = await import('./recording-storage.service.js');
  const audio = await getRecordingBuffer(url.replace('minio://', ''));

  const { resolveCredentials } = await import('./credential-resolver.service.js');
  const { api_key } = await resolveCredentials<{ api_key: string }>(workspaceId, 'deepgram');

  // multichannel: Twilio dual-channel recordings put each leg on its own channel
  const dgUrl = 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&utterances=true&multichannel=true&detect_language=true';
  const res = await fetch(dgUrl, {
    method: 'POST',
    headers: { Authorization: `Token ${api_key}`, 'Content-Type': 'audio/mpeg' },
    body: new Uint8Array(audio),
  });
  if (!res.ok) {
    log.error({ callId, status: res.status, body: (await res.text()).slice(0, 200) }, 'Deepgram prerecorded request failed');
    return false;
  }
  const data = await res.json() as {
    results?: {
      utterances?: Array<{ start: number; channel: number; transcript: string }>;
      channels?: Array<{ alternatives?: Array<{ transcript?: string }> }>;
    };
  };

  const startedAt = session.created_at ? new Date(session.created_at as unknown as string).getTime() : Date.now();
  let turns: Array<{ speaker: string; text: string; timestamp: string }> = [];

  const utterances = data.results?.utterances ?? [];
  if (utterances.length > 0) {
    turns = utterances
      .filter(u => u.transcript.trim())
      .map(u => ({
        speaker: u.channel === 0 ? 'caller' : 'operator',
        text: u.transcript.trim(),
        timestamp: new Date(startedAt + u.start * 1000).toISOString(),
      }));
  } else {
    // Mono / no utterances — fall back to the full channel transcript
    const full = data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
    if (full) turns = [{ speaker: 'caller', text: full, timestamp: new Date(startedAt).toISOString() }];
  }

  if (turns.length === 0) {
    log.info({ callId }, 'Recording transcription returned no speech');
    return false;
  }

  await callService.updateAiSession(sessionId, {
    transcript: turns as any,
    total_turns: turns.length,
  } as any);
  log.info({ callId, turns: turns.length }, 'Transcript recovered from recording');
  return true;
}

/**
 * If a session has a recording but no transcript, recover the transcript from
 * the recording and run the summary analysis. Fire-and-forget safe.
 */
export async function recoverTranscriptIfMissing(params: {
  callId: string;
  sessionId: string;
  workspaceId: string;
}): Promise<void> {
  const recovered = await transcribeFromRecording(params);
  if (recovered) await runPostCallAnalysis(params);
}

/**
 * Backfill summaries for completed sessions that have a transcript but no
 * summary (calls finalized while the post-call step was missing).
 */
export async function backfillMissingSummaries(limit = 20): Promise<number> {
  const rows = await db.select({
    call_id: aiCallSessions.call_id,
    id: aiCallSessions.id,
    workspace_id: aiCallSessions.workspace_id,
  })
    .from(aiCallSessions)
    .where(sql`${aiCallSessions.summary} IS NULL AND jsonb_array_length(coalesce(${aiCallSessions.transcript}, '[]'::jsonb)) > 0`)
    .limit(limit);

  let done = 0;
  for (const row of rows) {
    try {
      await runPostCallAnalysis({ callId: row.call_id, sessionId: row.id, workspaceId: row.workspace_id });
      done++;
    } catch (err) {
      log.error({ err, callId: row.call_id }, 'Backfill analysis failed');
    }
  }
  return done;
}

/**
 * Backfill transcripts for sessions whose live transcription produced nothing
 * but a MinIO recording exists (≥5s). Recovers the transcript from the
 * recording, then generates the summary.
 */
export async function backfillMissingTranscripts(limit = 20): Promise<number> {
  const rows = await db.select({
    call_id: aiCallSessions.call_id,
    id: aiCallSessions.id,
    workspace_id: aiCallSessions.workspace_id,
  })
    .from(aiCallSessions)
    .where(sql`jsonb_array_length(coalesce(${aiCallSessions.transcript}, '[]'::jsonb)) = 0
      AND ${aiCallSessions.recording_url} LIKE 'minio://%'
      AND coalesce(${aiCallSessions.recording_duration_seconds}, 0) >= 5`)
    .limit(limit);

  let done = 0;
  for (const row of rows) {
    try {
      const recovered = await transcribeFromRecording({ callId: row.call_id, sessionId: row.id, workspaceId: row.workspace_id });
      if (recovered) {
        await runPostCallAnalysis({ callId: row.call_id, sessionId: row.id, workspaceId: row.workspace_id });
        done++;
      }
    } catch (err) {
      log.error({ err, callId: row.call_id }, 'Transcript backfill failed');
    }
  }
  return done;
}
