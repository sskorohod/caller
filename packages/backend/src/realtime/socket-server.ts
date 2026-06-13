import { Server } from 'socket.io';
import type { IncomingMessage, ServerResponse, Server as HttpServer } from 'node:http';
import { jwtVerify } from 'jose';
import { and, eq } from 'drizzle-orm';
import pino from 'pino';
import { env } from '../config/env.js';
import { db } from '../config/db.js';
import { workspaceMembers, calls as callsTable } from '../db/schema.js';
import { setIo } from './io.js';

const log = pino({ name: 'socket-server' });

export function initSocketServer(httpServer: HttpServer<typeof IncomingMessage, typeof ServerResponse>) {
  const io = new Server(httpServer, {
    cors: {
      // Production: only allow the configured API_DOMAIN. A previously
      // hardcoded domain fallback was a security hazard if the domain ever
      // changed — left CORS open to a foreign origin. Operators who need
      // extra origins for testing should set API_DOMAIN explicitly.
      origin: env.NODE_ENV === 'development'
        ? true
        : [`https://${env.API_DOMAIN}`],
      credentials: true,
    },
    path: '/socket.io',
    // Use polling only — Cloudflare Tunnel corrupts WebSocket frames
    // causing "Invalid frame header" errors on upgrade attempts
    transports: ['polling'],
  });

  // JWT authentication middleware (with share token fallback)
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const shareToken = socket.handshake.auth?.shareToken as string | undefined;

    // Share token auth — limited access for public monitoring
    if (!token && shareToken) {
      try {
        const { getCallByShareToken } = await import('../services/call.service.js');
        const result = await getCallByShareToken(shareToken);
        if (result) {
          socket.data.userId = 'monitor';
          socket.data.workspaceId = result.workspaceId;
          socket.data.role = 'monitor';
          socket.data.shareCallId = result.callId;
          return next();
        }
      } catch { /* fall through */ }
      return next(new Error('Invalid share token'));
    }

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const secret = new TextEncoder().encode(env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ['HS256'],
      });

      if (!payload.sub) {
        return next(new Error('Invalid token: missing sub'));
      }

      // Look up workspace membership
      const [membership] = await db
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.user_id, payload.sub as string))
        .limit(1);

      if (!membership) {
        return next(new Error('No workspace membership found'));
      }

      // Attach auth data to socket
      socket.data.userId = payload.sub;
      socket.data.workspaceId = membership.workspace_id;
      socket.data.role = membership.role;

      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const workspaceId = socket.data.workspaceId as string;

    // Join workspace room
    socket.join(`workspace:${workspaceId}`);

    // Live call monitoring: join a call-specific room (workspace-scoped)
    socket.on('call:join', async ({ call_id }: { call_id: string }) => {
      if (!call_id || !await authorizeCallAccess(call_id)) return;
      socket.join(`call:${call_id}`);
    });

    // Live call audio: join/leave audio room for listening (workspace-scoped)
    socket.on('call:listen:start', async ({ call_id, channel }: { call_id: string; channel?: string }) => {
      if (!call_id || !await authorizeCallAccess(call_id)) return;
      socket.join(`call:${call_id}:audio`);
      socket.data.listenChannel = channel || 'both';
    });

    socket.on('call:listen:stop', ({ call_id }: { call_id: string }) => {
      socket.leave(`call:${call_id}:audio`);
    });

    socket.on('call:listen:channel', ({ call_id, channel }: { call_id: string; channel: string }) => {
      socket.data.listenChannel = channel;
    });

    // Live translation: join/leave translate room (workspace-scoped)
    socket.on('call:translate:join', async ({ call_id }: { call_id: string }) => {
      if (!call_id || !await authorizeCallAccess(call_id)) return;
      socket.join(`call:${call_id}:translate`);
    });

    // Join translate room by share token (for public live-translate page)
    socket.on('call:translate:join:token', async ({ token }: { token: string }) => {
      try {
        const { callShareTokens } = await import('../db/schema.js');
        const { db } = await import('../config/db.js');
        const { eq } = await import('drizzle-orm');
        const [row] = await db.select().from(callShareTokens).where(eq(callShareTokens.token, token));
        if (row && new Date(row.expires_at) > new Date()) {
          socket.join(`call:${row.call_id}`);
          socket.join(`call:${row.call_id}:translate`);
        }
      } catch (err) { log.error({ err }, 'call:translate:join:token failed'); }
    });

    // Translator controls — change mode/voice on the fly.
    // call_id may be omitted by share-token clients (the public translate page);
    // we fall back to socket.data.shareCallId set during handshake.
    //
    // AUTHORIZATION: legitimate cases are
    //   (a) share-token client modifying its own session (shareCallId === id), OR
    //   (b) workspace user modifying a call in their own workspace.
    // Anything else gets dropped silently.
    const resolveCallId = (call_id?: string | null): string | null =>
      call_id || (socket.data.shareCallId as string | undefined) || null;

    async function authorizeCallAccess(id: string): Promise<boolean> {
      const role = socket.data.role as string | undefined;
      const wsId = socket.data.workspaceId as string | undefined;
      // Share-token monitors can ONLY touch their own pre-bound share call.
      if (role === 'monitor') {
        return socket.data.shareCallId === id;
      }
      if (!wsId) return false;
      const [row] = await db
        .select({ workspace_id: callsTable.workspace_id })
        .from(callsTable)
        .where(and(eq(callsTable.id, id), eq(callsTable.workspace_id, wsId)))
        .limit(1);
      return !!row;
    }

    socket.on('translator:set-mode', async ({ call_id, mode }: { call_id?: string; mode: string }) => {
      try {
        const id = resolveCallId(call_id);
        if (!id || !await authorizeCallAccess(id)) return;
        const { getActiveConferenceTranslators } = await import('../routes/webhooks/media-stream.js');
        const ct = getActiveConferenceTranslators().get(id);
        if (ct) ct.updateMode(mode);
      } catch (err) { log.error({ err, call_id }, 'translator socket event failed'); }
    });

    socket.on('translator:set-languages', async ({ call_id, my_language, target_language }: { call_id?: string; my_language: string; target_language: string }) => {
      try {
        const id = resolveCallId(call_id);
        if (!id || !await authorizeCallAccess(id)) return;
        const { getActiveConferenceTranslators } = await import('../routes/webhooks/media-stream.js');
        const ct = getActiveConferenceTranslators().get(id);
        if (ct) ct.updateLanguages(my_language, target_language);
      } catch (err) { log.error({ err, call_id }, 'translator socket event failed'); }
    });

    socket.on('translator:set-voice', async ({ call_id, voice }: { call_id?: string; voice: string }) => {
      try {
        const id = resolveCallId(call_id);
        if (!id || !await authorizeCallAccess(id)) return;
        const { getActiveConferenceTranslators } = await import('../routes/webhooks/media-stream.js');
        const ct = getActiveConferenceTranslators().get(id);
        if (ct) ct.updateVoice(voice);
      } catch (err) { log.error({ err, call_id }, 'translator socket event failed'); }
    });

    // Translator pause/resume
    socket.on('translator:pause', async ({ call_id }: { call_id?: string }) => {
      try {
        const id = resolveCallId(call_id);
        if (!id || !await authorizeCallAccess(id)) return;
        const { getActiveConferenceTranslators } = await import('../routes/webhooks/media-stream.js');
        const ct = getActiveConferenceTranslators().get(id);
        if (ct) ct.pause();
      } catch (err) { log.error({ err, call_id }, 'translator socket event failed'); }
    });

    socket.on('translator:resume', async ({ call_id }: { call_id?: string }) => {
      try {
        const id = resolveCallId(call_id);
        if (!id || !await authorizeCallAccess(id)) return;
        const { getActiveConferenceTranslators } = await import('../routes/webhooks/media-stream.js');
        const ct = getActiveConferenceTranslators().get(id);
        if (ct) ct.resume();
      } catch (err) { log.error({ err, call_id }, 'translator socket event failed'); }
    });

    // Translator set tone
    socket.on('translator:set-tone', async ({ call_id, tone }: { call_id?: string; tone: string }) => {
      try {
        const id = resolveCallId(call_id);
        if (!id || !await authorizeCallAccess(id)) return;
        const { getActiveConferenceTranslators } = await import('../routes/webhooks/media-stream.js');
        const ct = getActiveConferenceTranslators().get(id);
        if (ct) ct.updateTone(tone);
      } catch (err) { log.error({ err, call_id }, 'translator socket event failed'); }
    });

    socket.on('call:translate:leave', ({ call_id }: { call_id: string }) => {
      socket.leave(`call:${call_id}:translate`);
    });

    // Change voice mid-call (Grok Voice Agent reconnect)
    socket.on('call:tts:change', async ({ call_id, voice }: { call_id?: string; provider?: string; voice?: string; language?: string }) => {
      try {
        const id = resolveCallId(call_id);
        if (!id || !await authorizeCallAccess(id)) return;
        // Try conference translator first
        const { getActiveConferenceTranslators } = await import('../routes/webhooks/media-stream.js');
        const ct = getActiveConferenceTranslators().get(id);
        if (ct && voice) { ct.updateVoice(voice); return; }

        // Dialer VT: reconnect Grok with new voice (not supported yet — would need session.update)
        log.debug({ call_id: id, voice }, 'Voice change requested (no active translator)');
      } catch (err) {
        log.error({ err, call_id }, 'Voice change failed');
      }
    });

    // PTT state for sequential interpretation mode
    socket.on('call:ptt:state', async ({ call_id, active }: { call_id?: string; active: boolean }) => {
      try {
        const id = resolveCallId(call_id);
        if (!id || !await authorizeCallAccess(id)) return;
        const { getActiveVoiceTranslateSessions, flushPttAudio } = await import('../routes/webhooks/media-stream.js');
        const session = getActiveVoiceTranslateSessions().get(id);
        if (session) {
          session.pttActive = active;
          // PTT released → flush buffered audio
          if (!active && session.sequentialMode) {
            // Grok handles VAD — just flush accumulated audio buffer
            const result = flushPttAudio(id);
            if (result instanceof Promise) await result;
          }
        }
      } catch (err) { log.error({ err, call_id }, 'translator socket event failed'); }
    });

    // Toggle sequential mode mid-call
    socket.on('call:translate:mode', async ({ call_id, sequential }: { call_id?: string; sequential: boolean }) => {
      try {
        const id = resolveCallId(call_id);
        if (!id || !await authorizeCallAccess(id)) return;
        const { getActiveVoiceTranslateSessions } = await import('../routes/webhooks/media-stream.js');
        const session = getActiveVoiceTranslateSessions().get(id);
        if (session) session.sequentialMode = sequential;
      } catch (err) { log.error({ err, call_id }, 'translator socket event failed'); }
    });

    // Toggle translation on/off mid-call
    socket.on('call:translate:toggle', async ({ call_id, enabled }: { call_id?: string; enabled: boolean }) => {
      try {
        const id = resolveCallId(call_id);
        if (!id || !await authorizeCallAccess(id)) return;
        const { getActiveVoiceTranslateSessions } = await import('../routes/webhooks/media-stream.js');
        const session = getActiveVoiceTranslateSessions().get(id);
        if (session) {
          session.translationEnabled = enabled;
          log.info({ call_id: id, enabled }, 'Translation toggled');
        }
      } catch (err) { log.error({ err, call_id }, 'translator socket event failed'); }
    });

    // Live call monitoring: operator sends a free-text instruction to an
    // active call. Three guards before we honor it:
    //   1) Caller must NOT be a share-token monitor (those are read-only).
    //   2) The call_id must belong to the connected user's workspace.
    //   3) Text must be non-empty and capped to 2KB (anti-prompt-flood).
    socket.on('call:instruction', async (raw: unknown) => {
      const { call_id, text } = (raw as { call_id?: string; text?: string }) || {};
      const userId = socket.data.userId as string | undefined;
      const role = socket.data.role as string | undefined;
      const wsId = socket.data.workspaceId as string | undefined;

      if (!call_id || typeof call_id !== 'string') return;
      if (!text || typeof text !== 'string' || !text.trim()) return;
      if (role === 'monitor') {
        log.warn({ userId, call_id }, 'call:instruction rejected — monitor role is read-only');
        return;
      }
      const trimmed = text.trim().slice(0, 2000);

      try {
        // Workspace isolation: verify the call belongs to this user's workspace.
        const [callRow] = await db
          .select({ workspace_id: callsTable.workspace_id })
          .from(callsTable)
          .where(and(eq(callsTable.id, call_id), eq(callsTable.workspace_id, wsId || '')))
          .limit(1);
        if (!callRow) {
          log.warn({ userId, wsId, call_id }, 'call:instruction rejected — call not in this workspace');
          return;
        }

        const { getActiveOrchestrator } = await import('../routes/webhooks/media-stream.js');
        const orch = getActiveOrchestrator(call_id);
        if (orch && 'injectInstruction' in orch) {
          (orch as any).injectInstruction(trimmed);
          log.info({ userId, call_id, len: trimmed.length }, 'Operator instruction injected');
        } else {
          log.info({ userId, call_id, found: !!orch }, 'call:instruction — orchestrator missing or no inject method');
        }
      } catch (err) {
        log.error({ err, userId, call_id }, 'call:instruction error');
      }
    });

    socket.on('disconnect', () => {
      // Cleanup handled automatically by socket.io
    });
  });

  setIo(io);

  return io;
}
