import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import http from 'node:http';
import { env } from './config/env.js';
import { AppError } from './lib/errors.js';
import { initSocketServer } from './realtime/socket-server.js';

// Create HTTP server first so Socket.IO can attach before Fastify
const httpServer = http.createServer();
const io = initSocketServer(httpServer);

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
  },
  bodyLimit: 1024 * 100, // 100KB max request body
  serverFactory: (handler) => {
    httpServer.on('request', handler);
    return httpServer;
  },
});

// Security headers
await app.register(helmet, {
  contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
});

// CORS
await app.register(cors, {
  origin: env.NODE_ENV === 'development'
    ? true
    : (origin, cb) => {
      const allowed = [`https://${env.API_DOMAIN}`, `https://caller.n8nskorx.top`];
      cb(null, !origin || allowed.includes(origin));
    },
  credentials: true,
});

// Rate limiting
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// Global error handler — sanitize errors in production
app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    const message = env.NODE_ENV === 'production'
      ? getPublicMessage(error.code ?? 'UNKNOWN')
      : error.message;

    reply.status(error.statusCode).send({
      error: error.code,
      message,
    });
    return;
  }

  request.log.error(error);
  reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: 'Internal server error',
  });
});

function getPublicMessage(code: string): string {
  const messages: Record<string, string> = {
    NOT_FOUND: 'Resource not found',
    UNAUTHORIZED: 'Invalid credentials',
    FORBIDDEN: 'Access denied',
    CONFLICT: 'Resource already exists',
    VALIDATION_ERROR: 'Invalid input',
  };
  return messages[code] ?? 'An error occurred';
}

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Route registration
// Public auth (no JWT required)
await app.register(import('./routes/auth/session.js'), { prefix: '/api/auth' });
// Authenticated routes
await app.register(import('./routes/auth/index.js'), { prefix: '/api/auth' });
await app.register(import('./routes/workspaces/index.js'), { prefix: '/api/workspaces' });
await app.register(import('./routes/agents/index.js'), { prefix: '/api/agents' });
await app.register(import('./routes/calls/index.js'), { prefix: '/api/calls' });
await app.register(import('./routes/webhooks/index.js'), { prefix: '/webhooks' });
await app.register(import('./routes/prompt-packs/index.js'), { prefix: '/api/prompt-packs' });
await app.register(import('./routes/skill-packs/index.js'), { prefix: '/api/skill-packs' });
await app.register(import('./routes/knowledge/index.js'), { prefix: '/api/knowledge' });
await app.register(import('./routes/memory/index.js'), { prefix: '/api/memory' });
await app.register(import('./routes/oauth/index.js'), { prefix: '/api/oauth' });
await app.register(import('./routes/telephony/index.js'), { prefix: '/api/telephony' });
await app.register(import('./routes/webhook-endpoints/index.js'), { prefix: '/api/webhook-endpoints' });
await app.register(import('./routes/connectors/index.js'), { prefix: '/api/connectors' });
await app.register(import('./routes/audit/index.js'), { prefix: '/api/audit-logs' });

// Start post-call worker (BullMQ)
import { startPostCallWorker } from './workers/post-call.worker.js';
startPostCallWorker();
app.log.info('Post-call worker started');

// Start
try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info('Socket.IO server initialized');
  app.log.info(`Server running at http://${env.HOST}:${env.PORT}`);
} catch (err) {
  app.log.fatal(err);
  process.exit(1);
}
