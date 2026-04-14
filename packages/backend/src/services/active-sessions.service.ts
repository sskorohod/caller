/**
 * Active session registry backed by Redis.
 *
 * WebSocket objects live in-memory (can't serialize), but session metadata
 * is tracked in Redis for:
 * - Distributed awareness (multi-process)
 * - Automatic cleanup via TTL
 * - Monitoring & admin dashboards
 * - Preventing duplicate sessions
 */
import { redis } from '../config/redis.js';
import pino from 'pino';

const log = pino({ name: 'active-sessions' });

const PREFIX = 'caller:session:';
const DEFAULT_TTL = 4 * 3600; // 4 hours

export type SessionType = 'orchestrator' | 'translator' | 'manual' | 'voice_translate' | 'conference';

export interface SessionMeta {
  callId: string;
  workspaceId: string;
  type: SessionType;
  startedAt: string;
  fromNumber?: string;
  toNumber?: string;
}

/**
 * Register an active session in Redis.
 * Called when a new session starts (alongside in-memory Map.set).
 */
export async function registerSession(callId: string, meta: SessionMeta): Promise<void> {
  try {
    await redis.setex(`${PREFIX}${callId}`, DEFAULT_TTL, JSON.stringify(meta));
  } catch (err) {
    log.warn({ err, callId }, 'Failed to register session in Redis');
  }
}

/**
 * Remove a session from Redis.
 * Called when session ends (alongside in-memory Map.delete).
 */
export async function unregisterSession(callId: string): Promise<void> {
  try {
    await redis.del(`${PREFIX}${callId}`);
  } catch (err) {
    log.warn({ err, callId }, 'Failed to unregister session from Redis');
  }
}

/**
 * Refresh session TTL (heartbeat).
 * Call periodically for long-running sessions to prevent expiry.
 */
export async function refreshSession(callId: string): Promise<void> {
  try {
    await redis.expire(`${PREFIX}${callId}`, DEFAULT_TTL);
  } catch { /* non-critical */ }
}

/**
 * Get session metadata from Redis.
 */
export async function getSession(callId: string): Promise<SessionMeta | null> {
  try {
    const data = await redis.get(`${PREFIX}${callId}`);
    return data ? JSON.parse(data) as SessionMeta : null;
  } catch {
    return null;
  }
}

/**
 * List all active sessions (optionally filtered by type or workspace).
 */
export async function listActiveSessions(filter?: { type?: SessionType; workspaceId?: string }): Promise<SessionMeta[]> {
  try {
    const keys = await redis.keys(`${PREFIX}*`);
    if (keys.length === 0) return [];

    const pipeline = redis.pipeline();
    for (const key of keys) pipeline.get(key);
    const results = await pipeline.exec();
    if (!results) return [];

    const sessions: SessionMeta[] = [];
    for (const [err, val] of results) {
      if (err || !val) continue;
      try {
        const meta = JSON.parse(val as string) as SessionMeta;
        if (filter?.type && meta.type !== filter.type) continue;
        if (filter?.workspaceId && meta.workspaceId !== filter.workspaceId) continue;
        sessions.push(meta);
      } catch { /* skip malformed */ }
    }
    return sessions;
  } catch (err) {
    log.warn({ err }, 'Failed to list active sessions');
    return [];
  }
}

/**
 * Get count of active sessions.
 */
export async function countActiveSessions(filter?: { type?: SessionType; workspaceId?: string }): Promise<number> {
  const sessions = await listActiveSessions(filter);
  return sessions.length;
}
