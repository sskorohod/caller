import { eq, and, desc, asc, sql, count } from 'drizzle-orm';
import { db } from '../config/db.js';
import { calls, aiCallSessions, callEvents } from '../db/schema.js';
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
  },
): Promise<{ calls: Call[]; total: number }> {
  const limit = filters?.limit ?? 20;
  const offset = filters?.offset ?? 0;

  // Build where conditions
  const conditions = [eq(calls.workspace_id, workspaceId)];
  if (filters?.direction) conditions.push(eq(calls.direction, filters.direction));
  if (filters?.status) conditions.push(eq(calls.status, filters.status));

  const whereClause = and(...conditions);

  // Separate count query
  const [countResult] = await db
    .select({ total: count() })
    .from(calls)
    .where(whereClause);

  const total = countResult?.total ?? 0;

  // Data query
  const rows = await db
    .select()
    .from(calls)
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
