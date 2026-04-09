import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import rawBody from 'fastify-raw-body';
import http from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { eq } from 'drizzle-orm';
import { env } from './config/env.js';
import { db, pool } from './config/db.js';
import { AppError } from './lib/errors.js';
import { initSocketServer } from './realtime/socket-server.js';

// Create shared HTTP server — Socket.IO and Fastify both attach to it
const httpServer = http.createServer();

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
  },
  bodyLimit: 1024 * 100, // 100KB max request body
  serverFactory: (handler) => {
    httpServer.on('request', (req, res) => {
      // Let Socket.IO handle its own path
      if (req.url?.startsWith('/socket.io/')) return;
      handler(req, res);
    });
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
      const extra = process.env.CORS_ORIGINS?.split(',').filter(Boolean) ?? [];
      const allowed = [`https://${env.API_DOMAIN}`, ...extra];
      cb(null, !origin || allowed.includes(origin));
    },
  credentials: true,
});

// Multipart file uploads (avatars, etc.)
await app.register(multipart, {
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

// Raw body for Stripe webhook signature verification
await app.register(rawBody, {
  field: 'rawBody',
  global: false,
  encoding: 'utf8',
  runFirst: true,
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
await app.register(import('./routes/webhooks/telegram.js'), { prefix: '/webhooks' });
await app.register(import('./routes/prompt-packs/index.js'), { prefix: '/api/prompt-packs' });
await app.register(import('./routes/skill-packs/index.js'), { prefix: '/api/skill-packs' });
await app.register(import('./routes/knowledge/index.js'), { prefix: '/api/knowledge' });
await app.register(import('./routes/memory/index.js'), { prefix: '/api/memory' });
await app.register(import('./routes/oauth/index.js'), { prefix: '/api/oauth' });
await app.register(import('./routes/telephony/index.js'), { prefix: '/api/telephony' });
await app.register(import('./routes/webhook-endpoints/index.js'), { prefix: '/api/webhook-endpoints' });
await app.register(import('./routes/connectors/index.js'), { prefix: '/api/connectors' });
await app.register(import('./routes/audit/index.js'), { prefix: '/api/audit-logs' });
await app.register(import('./routes/missions/index.js'), { prefix: '/api/missions' });
await app.register(import('./routes/translator/index.js'), { prefix: '/api/translator' });
await app.register(import('./routes/translator/stripe.js'), { prefix: '/api/translator' });
// Portal disabled — subscribers merged into workspaces
// await app.register(import('./routes/translator/portal.js'), { prefix: '/api/translator/portal' });
// Public billing endpoint (no auth)
app.get('/api/billing/plans', async () => {
  const { platformSettings } = await import('./db/schema.js');
  const { inArray } = await import('drizzle-orm');
  const { PLANS } = await import('./config/plans.js');
  const priceKeys = ['billing_agents_monthly_price', 'billing_agents_mcp_monthly_price'];
  const rows = await db.select().from(platformSettings).where(inArray(platformSettings.key, priceKeys));
  const prices: Record<string, number> = {};
  for (const row of rows) {
    try {
      const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      const num = Number(parsed);
      if (!isNaN(num)) prices[row.key] = num;
    } catch { /* skip */ }
  }
  return Object.values(PLANS).map(p => ({
    id: p.id, name: p.name, has_subscription: p.hasSubscription, features: p.features,
    monthly_price: p.id === 'agents' ? (prices['billing_agents_monthly_price'] ?? 49)
      : p.id === 'agents_mcp' ? (prices['billing_agents_mcp_monthly_price'] ?? 99) : 0,
  }));
});
await app.register(import('./routes/billing/index.js'), { prefix: '/api/billing' });
await app.register(import('./routes/admin/index.js'), { prefix: '/api/admin' });

// Start post-call worker (BullMQ)
import { startPostCallWorker } from './workers/post-call.worker.js';
const postCallWorker = startPostCallWorker();
app.log.info('Post-call worker started');

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  app.log.info(`${signal} received, shutting down...`);
  await postCallWorker.close();
  await app.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start
try {
  await app.listen({ port: env.PORT, host: env.HOST });
  initSocketServer(httpServer);
  app.log.info('Socket.IO server initialized');
  app.log.info(`Server running at http://${env.HOST}:${env.PORT}`);

  // Auto-setup Telegram bot webhook + commands
  (async () => {
    try {
      const { setupTelegramWebhook, setupTelegramBotCommands } = await import('./routes/webhooks/telegram.js');
      const { providerCredentials } = await import('./db/schema.js');
      const { decrypt } = await import('./lib/crypto.js');
      const rows = await db.select({ credential_data: providerCredentials.credential_data })
        .from(providerCredentials)
        .where(eq(providerCredentials.provider, 'telegram'));
      for (const row of rows) {
        const creds = JSON.parse(decrypt(row.credential_data)) as { bot_token: string };
        if (creds.bot_token) {
          await setupTelegramWebhook(creds.bot_token, `https://${env.API_DOMAIN}/webhooks/telegram`);
          await setupTelegramBotCommands(creds.bot_token);
        }
      }
    } catch (err) {
      app.log.warn({ err }, 'Telegram bot setup skipped');
    }
  })();
} catch (err) {
  app.log.fatal(err);
  process.exit(1);
}
