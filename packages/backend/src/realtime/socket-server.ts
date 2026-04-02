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

  // JWT authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
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

    // Live call monitoring: send operator instruction to active call
    socket.on('call:instruction', async ({ call_id, text }: { call_id: string; text: string }) => {
      try {
        const { getActiveOrchestrator } = await import('../routes/webhooks/media-stream.js');
        const orch = getActiveOrchestrator(call_id);
        if (orch && 'injectInstruction' in orch) {
          (orch as any).injectInstruction(text);
        }
      } catch {
        // Orchestrator not found or not active — ignore silently
      }
    });

    socket.on('disconnect', () => {
      // Cleanup handled automatically by socket.io
    });
  });

  setIo(io);

  return io;
}
