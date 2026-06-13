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
import { ZodError } from 'zod';
import { initSocketServer } from './realtime/socket-server.js';

// Create shared HTTP server — Socket.IO and Fastify both attach to it
const httpServer = http.createServer();

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
  },
  // Behind Cloudflare Tunnel → nginx (which sets X-Forwarded-For). Without
  // this, request.ip is the nginx container IP for EVERY user, making the
  // per-IP rate limits (login/register/magic-link) effectively global — one
  // user's attempts lock out everyone. trustProxy makes request.ip the real
  // client IP. The stack is only reachable via the tunnel, so XFF can't be
  // spoofed by bypassing the proxy.
  trustProxy: true,
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
  // Zod validation failures are client errors, not 500s
  if (error instanceof ZodError) {
    const first = error.issues[0];
    reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid input',
    });
    return;
  }

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

  // Framework/plugin errors carry their own 4xx status (rate-limit 429,
  // payload-too-large 413, malformed JSON 400). Preserve it instead of
  // masking as 500 — masking a 429 as 500 made the login lockout look like
  // a server crash.
  const status = (error as { statusCode?: number }).statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    reply.status(status).send({
      error: (error as { code?: string }).code ?? 'REQUEST_ERROR',
      message: (error as { message?: string }).message || 'Request error',
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
await app.register(import('./routes/calls/index.js'), { prefix: '/api/calls' });
await app.register(import('./routes/webhooks/index.js'), { prefix: '/webhooks' });
await app.register(import('./routes/webhooks/telegram.js'), { prefix: '/webhooks' });
await app.register(import('./routes/memory/index.js'), { prefix: '/api/memory' });
await app.register(import('./routes/oauth/index.js'), { prefix: '/api/oauth' });
await app.register(import('./routes/telephony/index.js'), { prefix: '/api/telephony' });
await app.register(import('./routes/webhook-endpoints/index.js'), { prefix: '/api/webhook-endpoints' });
await app.register(import('./routes/audit/index.js'), { prefix: '/api/audit-logs' });
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
    trial_days: p.trialDays,
    monthly_price: p.id === 'agents' ? (prices['billing_agents_monthly_price'] ?? 49)
      : p.id === 'agents_mcp' ? (prices['billing_agents_mcp_monthly_price'] ?? 99) : 0,
  }));
});
await app.register(import('./routes/billing/index.js'), { prefix: '/api/billing' });
await app.register(import('./routes/support/index.js'), { prefix: '/api/support' });
await app.register(import('./routes/contact/index.js'), { prefix: '/api/contact' });
await app.register(import('./routes/admin/index.js'), { prefix: '/api/admin' });

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  app.log.info(`${signal} received, shutting down...`);
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

  // Load pricing overrides from DB (cached, falls back to hardcoded)
  import('./config/pricing.js').then(m => m.loadPricingOverrides()).catch(() => {});

  // Personal-number renewal sweep — hourly. State lives in Postgres
  // (next_renewal_at), so a plain interval is restart-safe and idempotent.
  import('./services/personal-number.service.js').then(m => {
    const run = () => m.runRenewalSweep()
      .then(r => { if (r.checked > 0) app.log.info(r, 'Personal-number renewal sweep'); })
      .catch(err => app.log.error({ err }, 'Personal-number renewal sweep failed'));
    run();
    setInterval(run, 60 * 60 * 1000);
  }).catch(() => {});

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
