import { eq, and, desc, asc, sql, count, gte, lte, inArray, getTableColumns } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../config/db.js';
import { calls, aiCallSessions, callEvents, callShareTokens, missions, missionMessages } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
import type { Call, AiCallSession, CallEvent, ConversationOwner, CallStatus } from '../models/types.js';

// ============================================================
// Call Management
// ============================================================

export async function createCall(params: {
  workspaceId: string;
  direction: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  telephonyConnectionId?: string;
  conversationOwnerRequested: ConversationOwner;
  agentProfileId?: string;
  callerProfileId?: string;
  goal?: string;
  goalSource?: string;
  goalPayload?: unknown;
  context?: Record<string, unknown>;
  outcomeSchema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<Call> {
  const [created] = await db
    .insert(calls)
    .values({
      workspace_id: params.workspaceId,
      direction: params.direction,
      from_number: params.fromNumber,
      to_number: params.toNumber,
      telephony_connection_id: params.telephonyConnectionId ?? null,
      conversation_owner_requested: params.conversationOwnerRequested,
      conversation_owner_actual: params.conversationOwnerRequested,
      agent_profile_id: params.agentProfileId ?? null,
      caller_profile_id: params.callerProfileId ?? null,
      goal: params.goal ?? null,
      goal_source: params.goalSource ?? null,
      goal_payload: params.goalPayload ?? null,
      context: params.context ?? null,
      outcome_schema: params.outcomeSchema ?? null,
      metadata: params.metadata ?? {},
    })
    .returning();

  if (!created) throw new Error('Failed to create call');
  return created as unknown as Call;
}

export async function getCall(workspaceId: string, callId: string): Promise<Call> {
  const [row] = await db
    .select()
    .from(calls)
    .where(
      and(
        eq(calls.id, callId),
        eq(calls.workspace_id, workspaceId),
      ),
    );

  if (!row) throw new NotFoundError('Call', callId);
  return row as unknown as Call;
}

export async function deleteCall(workspaceId: string, callId: string): Promise<void> {
  // Delete related records first (order matters for FK constraints)
  // Mission messages → missions → call events → ai sessions → share tokens → call
  const missionRows = await db.select({ id: missions.id }).from(missions).where(eq(missions.call_id, callId));
  for (const m of missionRows) {
    await db.delete(missionMessages).where(eq(missionMessages.mission_id, m.id));
  }
  await db.delete(missions).where(eq(missions.call_id, callId));
  await db.delete(callEvents).where(eq(callEvents.call_id, callId));
  await db.delete(aiCallSessions).where(eq(aiCallSessions.call_id, callId));
  await db.delete(callShareTokens).where(eq(callShareTokens.call_id, callId));
  await db.delete(calls).where(
    and(eq(calls.id, callId), eq(calls.workspace_id, workspaceId)),
  );
}

export async function updateCallStatus(
  callId: string,
  status: CallStatus,
  extra?: Partial<Call>,
): Promise<Call> {
  const updates: Record<string, unknown> = { status, ...extra };

  if (status === 'ringing') updates.ringing_at = new Date();
  if (status === 'in_progress') updates.connected_at = new Date();
  if (['completed', 'failed', 'canceled'].includes(status)) {
    updates.ended_at = new Date();
  }

  const [updated] = await db
    .update(calls)
    .set(updates)
    .where(eq(calls.id, callId))
    .returning();

  if (!updated) throw new NotFoundError('Call', callId);
  return updated as unknown as Call;
}

export async function listCalls(
  workspaceId: string,
  filters?: {
    limit?: number;
    direction?: string;
    status?: string;
    offset?: number;
    from?: string;
    to?: string;
    agent_profile_id?: string;
    sentiment?: string;
    min_duration?: number;
    max_duration?: number;
  },
): Promise<{ calls: Call[]; total: number }> {
  const limit = filters?.limit ?? 20;
  const offset = filters?.offset ?? 0;

  // Build where conditions
  const conditions = [eq(calls.workspace_id, workspaceId)];
  if (filters?.direction) conditions.push(eq(calls.direction, filters.direction));
  if (filters?.status) conditions.push(eq(calls.status, filters.status));
  if (filters?.from) conditions.push(gte(calls.created_at, new Date(filters.from)));
  if (filters?.to) conditions.push(lte(calls.created_at, new Date(filters.to)));
  if (filters?.agent_profile_id) conditions.push(eq(calls.agent_profile_id, filters.agent_profile_id));
  if (filters?.min_duration != null) conditions.push(gte(calls.duration_seconds, filters.min_duration));
  if (filters?.max_duration != null) conditions.push(lte(calls.duration_seconds, filters.max_duration));

  // Sentiment filter requires a join with ai_call_sessions
  const sentimentValues = filters?.sentiment?.split(',').filter(Boolean) ?? [];
  const needsSentimentFilter = sentimentValues.length > 0;

  if (needsSentimentFilter) {
    // Use subquery to get call IDs matching sentiment
    const sentimentCallIds = db
      .select({ call_id: aiCallSessions.call_id })
      .from(aiCallSessions)
      .where(
        and(
          eq(aiCallSessions.workspace_id, workspaceId),
          inArray(aiCallSessions.sentiment, sentimentValues),
        ),
      );
    conditions.push(inArray(calls.id, sentimentCallIds));
  }

  const whereClause = and(...conditions);

  // Separate count query
  const [countResult] = await db
    .select({ total: count() })
    .from(calls)
    .where(whereClause);

  const total = countResult?.total ?? 0;

  // Data query with LEFT JOIN to get summary/sentiment from ai_call_sessions
  const rows = await db
    .select({
      ...getTableColumns(calls),
      summary: aiCallSessions.summary,
      sentiment: aiCallSessions.sentiment,
      qa_score: aiCallSessions.qa_score,
      cost_total: aiCallSessions.cost_total,
    })
    .from(calls)
    .leftJoin(aiCallSessions, eq(aiCallSessions.call_id, calls.id))
    .where(whereClause)
    .orderBy(desc(calls.created_at))
    .limit(limit)
    .offset(offset);

  return { calls: rows as unknown as Call[], total };
}

// ============================================================
// AI Call Sessions
// ============================================================

export async function createAiSession(params: {
  callId: string;
  workspaceId: string;
  agentProfileId?: string;
  promptSnapshot?: string;
  skillsSnapshot?: unknown;
  conversationOwner: ConversationOwner;
}): Promise<AiCallSession> {
  const [created] = await db
    .insert(aiCallSessions)
    .values({
      call_id: params.callId,
      workspace_id: params.workspaceId,
      agent_profile_id: params.agentProfileId ?? null,
      prompt_snapshot: params.promptSnapshot ?? null,
      skills_snapshot: params.skillsSnapshot ?? null,
      conversation_owner: params.conversationOwner,
    })
    .returning();

  if (!created) throw new Error('Failed to create AI session');
  return created as unknown as AiCallSession;
}

export async function getAiSession(callId: string): Promise<AiCallSession | null> {
  const [row] = await db
    .select()
    .from(aiCallSessions)
    .where(eq(aiCallSessions.call_id, callId));

  return row ? (row as unknown as AiCallSession) : null;
}

export async function updateAiSession(
  sessionId: string,
  updates: Partial<AiCallSession>,
): Promise<AiCallSession> {
  const { id, call_id, workspace_id, created_at, ...safeUpdates } = updates as any;

  const [updated] = await db
    .update(aiCallSessions)
    .set(safeUpdates)
    .where(eq(aiCallSessions.id, sessionId))
    .returning();

  if (!updated) throw new NotFoundError('AI Session', sessionId);
  return updated as unknown as AiCallSession;
}

// ============================================================
// Call Events
// ============================================================

export async function addCallEvent(params: {
  callId: string;
  workspaceId: string;
  eventType: string;
  eventData?: Record<string, unknown>;
}): Promise<CallEvent> {
  const [created] = await db
    .insert(callEvents)
    .values({
      call_id: params.callId,
      workspace_id: params.workspaceId,
      event_type: params.eventType,
      event_data: params.eventData ?? {},
    })
    .returning();

  if (!created) throw new Error('Failed to add call event');
  return created as unknown as CallEvent;
}

export async function getCallEvents(callId: string): Promise<CallEvent[]> {
  const rows = await db
    .select()
    .from(callEvents)
    .where(eq(callEvents.call_id, callId))
    .orderBy(asc(callEvents.created_at));

  return rows as unknown as CallEvent[];
}

// ============================================================
// Share Tokens
// ============================================================

export async function createShareToken(callId: string, ttlHours = 24): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000);

  await db.insert(callShareTokens).values({
    call_id: callId,
    token,
    expires_at: expiresAt,
  });

  return token;
}

export async function validateShareToken(callId: string, token: string): Promise<boolean> {
  const [row] = await db
    .select({ id: callShareTokens.id })
    .from(callShareTokens)
    .where(
      and(
        eq(callShareTokens.call_id, callId),
        eq(callShareTokens.token, token),
        gte(callShareTokens.expires_at, new Date()),
      ),
    );
  return !!row;
}

export async function getCallByShareToken(token: string): Promise<{ callId: string; workspaceId: string } | null> {
  const [row] = await db
    .select({
      callId: callShareTokens.call_id,
      workspaceId: calls.workspace_id,
    })
    .from(callShareTokens)
    .innerJoin(calls, eq(calls.id, callShareTokens.call_id))
    .where(
      and(
        eq(callShareTokens.token, token),
        gte(callShareTokens.expires_at, new Date()),
      ),
    );
  return row ?? null;
}
