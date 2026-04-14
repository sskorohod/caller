/**
 * Centralized session finalization logic.
 *
 * Replaces duplicated finalization code in:
 *   - media-stream.ts: finalizeVTSession(), finalizeManualSession()
 *   - conference-translator.ts: finalize()
 *
 * Handles: cost calculation → update AI session → deduct balance → update call status → post-call processing → frontend notification.
 */
import pino from 'pino';
import { eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import { calls as callsTable, workspaces as workspacesTable } from '../db/schema.js';
import * as callService from './call.service.js';
import { deductUsageCost } from './billing.service.js';
import { queuePostCallProcessing } from '../workers/post-call.worker.js';
import { getIo } from '../realtime/io.js';

const log = pino({ name: 'session-finalizer' });

export interface CostBreakdown {
  stt: number;
  llm: number;
  tts: number;
  telephony: number;
  sttProvider?: string;
  llmProvider?: string;
  ttsProvider?: string;
}

export interface FinalizeSessionParams {
  callId: string;
  workspaceId: string;
  sessionId: string;
  transcript: Array<{ speaker: string; text: string; [key: string]: unknown }>;
  costs: CostBreakdown;
  /** Duration in seconds. If not provided, calculated from call.connected_at. */
  durationSecs?: number;
}

/**
 * Finalize a call session: persist costs, deduct balance, update status, queue post-call.
 */
export async function finalizeSession(params: FinalizeSessionParams): Promise<void> {
  const { callId, workspaceId, sessionId, transcript, costs } = params;
  const costTotal = costs.stt + costs.llm + costs.tts + costs.telephony;

  // Resolve duration
  let durationSecs = params.durationSecs;
  if (durationSecs === undefined) {
    const [callRow] = await db.select({ connected_at: callsTable.connected_at })
      .from(callsTable).where(eq(callsTable.id, callId));
    durationSecs = callRow?.connected_at
      ? Math.floor((Date.now() - new Date(callRow.connected_at).getTime()) / 1000)
      : 0;
  }

  // 1. Update AI session with transcript and costs
  try {
    await callService.updateAiSession(sessionId, {
      transcript: transcript as any,
      total_turns: transcript.length,
      cost_stt: String(costs.stt),
      cost_llm: String(costs.llm),
      cost_tts: String(costs.tts),
      cost_telephony: String(costs.telephony),
      cost_total: String(costTotal),
    } as any);
  } catch (err) {
    log.error({ err, callId }, 'Failed to update AI session');
  }

  // 2. Deduct usage cost from workspace balance
  try {
    const [ws] = await db.select({ provider_config: workspacesTable.provider_config })
      .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
    await deductUsageCost({
      workspaceId,
      providerCosts: {
        stt: costs.stt,
        llm: costs.llm,
        tts: costs.tts,
        telephony: costs.telephony,
        sttProvider: costs.sttProvider || 'deepgram',
        llmProvider: costs.llmProvider,
        ttsProvider: costs.ttsProvider,
      },
      providerConfig: (ws?.provider_config as import('../models/types.js').ProviderConfig) || {},
      referenceType: 'call_session',
      referenceId: sessionId,
    });
  } catch (err) {
    log.error({ err, callId }, 'Failed to deduct usage cost');
  }

  // 3. Update call status to completed
  try {
    await callService.updateCallStatus(callId, 'completed', {
      duration_seconds: durationSecs,
    } as any);
  } catch (err) {
    log.error({ err, callId }, 'Failed to update call status');
  }

  // 4. Queue post-call processing (summary, facts, etc.)
  if (transcript.length > 0) {
    queuePostCallProcessing({ callId, workspaceId, sessionId });
  }

  // 5. Notify frontend
  const io = getIo();
  if (io) {
    io.to(`call:${callId}`).emit('call:status', { call_id: callId, status: 'completed' });
    io.to(`workspace:${workspaceId}`).emit('call:status', { call_id: callId, status: 'completed' });
  }

  log.info({ callId, durationSecs, costTotal, turns: transcript.length }, 'Session finalized');
}
