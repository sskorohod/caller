import { Server } from 'socket.io';
import type { IncomingMessage, ServerResponse, Server as HttpServer } from 'node:http';
import { jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from '../config/db.js';
import { workspaceMembers } from '../db/schema.js';
import { setIo } from './io.js';

export function initSocketServer(httpServer: HttpServer<typeof IncomingMessage, typeof ServerResponse>) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.NODE_ENV === 'development'
        ? true
        : [`https://${env.API_DOMAIN}`, 'https://caller.n8nskorx.top'],
      credentials: true,
    },
    path: '/socket.io',
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

    // Live call monitoring: join a call-specific room
    socket.on('call:join', ({ call_id }: { call_id: string }) => {
      socket.join(`call:${call_id}`);
    });

    // Live call audio: join/leave audio room for listening
    socket.on('call:listen:start', ({ call_id, channel }: { call_id: string; channel?: string }) => {
      socket.join(`call:${call_id}:audio`);
      socket.data.listenChannel = channel || 'both';
    });

    socket.on('call:listen:stop', ({ call_id }: { call_id: string }) => {
      socket.leave(`call:${call_id}:audio`);
    });

    socket.on('call:listen:channel', ({ call_id, channel }: { call_id: string; channel: string }) => {
      socket.data.listenChannel = channel;
    });

    // Live translation: join/leave translate room
    socket.on('call:translate:join', ({ call_id }: { call_id: string }) => {
      socket.join(`call:${call_id}:translate`);
    });

    socket.on('call:translate:leave', ({ call_id }: { call_id: string }) => {
      socket.leave(`call:${call_id}:translate`);
    });

    // Change TTS provider/voice mid-call
    socket.on('call:tts:change', async ({ call_id, provider, voice, language }: { call_id: string; provider: string; voice?: string; language?: string }) => {
      try {
        const { getActiveVoiceTranslateSessions } = await import('../routes/webhooks/media-stream.js');
        const session = getActiveVoiceTranslateSessions().get(call_id);
        if (!session) return;
        const { createTTSProvider } = await import('../services/tts.service.js');
        const newTts = await createTTSProvider(
          session.workspaceId,
          provider as 'elevenlabs' | 'openai' | 'xai',
          voice || (provider === 'openai' ? 'alloy' : undefined),
          language,
        );
        session.tts = newTts;
        console.log(`[Socket.IO] TTS changed: call=${call_id} provider=${provider} voice=${voice}`);
      } catch (err) {
        console.error(`[Socket.IO] TTS change failed:`, err);
      }
    });

    // PTT state for sequential interpretation mode
    socket.on('call:ptt:state', async ({ call_id, active }: { call_id: string; active: boolean }) => {
      try {
        const { getActiveVoiceTranslateSessions } = await import('../routes/webhooks/media-stream.js');
        const session = getActiveVoiceTranslateSessions().get(call_id);
        if (session) session.pttActive = active;
      } catch { /* ignore */ }
    });

    // Toggle sequential mode mid-call
    socket.on('call:translate:mode', async ({ call_id, sequential }: { call_id: string; sequential: boolean }) => {
      try {
        const { getActiveVoiceTranslateSessions } = await import('../routes/webhooks/media-stream.js');
        const session = getActiveVoiceTranslateSessions().get(call_id);
        if (session) session.sequentialMode = sequential;
      } catch { /* ignore */ }
    });

    // Mission chat: join/leave mission room
    socket.on('mission:join', ({ mission_id }: { mission_id: string }) => {
      socket.join(`mission:${mission_id}`);
    });

    socket.on('mission:leave', ({ mission_id }: { mission_id: string }) => {
      socket.leave(`mission:${mission_id}`);
    });

    // Live call monitoring: send operator instruction to active call
    socket.on('call:instruction', async ({ call_id, text }: { call_id: string; text: string }) => {
      console.log(`[Socket.IO] call:instruction received: call_id=${call_id}, text=${text?.slice(0, 50)}`);
      try {
        const { getActiveOrchestrator } = await import('../routes/webhooks/media-stream.js');
        const orch = getActiveOrchestrator(call_id);
        console.log(`[Socket.IO] Orchestrator found: ${!!orch}, hasInject: ${'injectInstruction' in (orch || {})}`);
        if (orch && 'injectInstruction' in orch) {
          (orch as any).injectInstruction(text);
          console.log(`[Socket.IO] Instruction injected successfully`);
        }
      } catch (err) {
        console.error(`[Socket.IO] Instruction error:`, err);
      }
    });

    socket.on('disconnect', () => {
      // Cleanup handled automatically by socket.io
    });
  });

  setIo(io);

  return io;
}
