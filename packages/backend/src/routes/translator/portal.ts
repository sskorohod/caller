import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, gt, isNull } from 'drizzle-orm';
import { SignJWT } from 'jose';
import crypto from 'crypto';
import { db } from '../../config/db.js';
import { translatorSubscribers, translatorSessions, balanceTransactions, subscriberPortalTokens } from '../../db/schema.js';
import { env } from '../../config/env.js';
import { sendEmail } from '../../services/email.service.js';
import { verifyJWT } from '../../lib/jwt.js';
import { UnauthorizedError } from '../../lib/errors.js';

// ─── Subscriber Auth Middleware ─────────────────────────────────────

interface SubscriberAuth {
  subscriberId: string;
  workspaceId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    subscriber?: SubscriberAuth;
  }
}

async function authenticateSubscriber(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new UnauthorizedError('Missing authorization token');

  let payload: { sub: string; type?: string };
  try {
    payload = await verifyJWT(token) as any;
  } catch {
    throw new UnauthorizedError('Invalid token');
  }

  if ((payload as any).type !== 'subscriber') throw new UnauthorizedError('Invalid token type');

  const [sub] = await db.select({ id: translatorSubscribers.id, workspace_id: translatorSubscribers.workspace_id })
    .from(translatorSubscribers)
    .where(eq(translatorSubscribers.id, payload.sub));

  if (!sub) throw new UnauthorizedError('Subscriber not found');

  request.subscriber = { subscriberId: sub.id, workspaceId: sub.workspace_id };
}

function issueSubscriberJWT(subscriberId: string): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new SignJWT({ sub: subscriberId, type: 'subscriber' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

// ─── Routes ─────────────────────────────────────────────────────────

const portalRoutes: FastifyPluginAsync = async (app) => {

  // POST /api/translator/portal/request-link — send magic link email
  app.post('/request-link', async (request) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);

    // Find subscriber by email (across all workspaces — portal is global)
    const [sub] = await db.select({ id: translatorSubscribers.id, name: translatorSubscribers.name })
      .from(translatorSubscribers)
      .where(eq(translatorSubscribers.email, email));

    if (!sub) {
      // Don't reveal whether email exists
      return { success: true, message: 'If this email is registered, you will receive a link.' };
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db.insert(subscriberPortalTokens).values({
      subscriber_id: sub.id,
      token,
      expires_at: expiresAt,
    });

    const portalUrl = `https://${env.API_DOMAIN}/translator/portal?token=${token}`;
    await sendEmail({
      to: email,
      subject: 'Sign in to Translator Portal',
      html: buildPortalEmail(portalUrl, sub.name),
    });

    return { success: true, message: 'If this email is registered, you will receive a link.' };
  });

  // GET /api/translator/portal/verify — verify token and issue JWT
  app.get('/verify', async (request) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(request.query);

    const [row] = await db.select()
      .from(subscriberPortalTokens)
      .where(and(
        eq(subscriberPortalTokens.token, token),
        gt(subscriberPortalTokens.expires_at, new Date()),
        isNull(subscriberPortalTokens.used_at),
      ));

    if (!row) throw new UnauthorizedError('Invalid or expired token');

    // Mark as used
    await db.update(subscriberPortalTokens)
      .set({ used_at: new Date() })
      .where(eq(subscriberPortalTokens.id, row.id));

    const jwt = await issueSubscriberJWT(row.subscriber_id);
    return { token: jwt };
  });

  // ─── Authenticated subscriber endpoints ──────────────────────

  // GET /api/translator/portal/me
  app.get('/me', { preHandler: [authenticateSubscriber] }, async (request) => {
    const [sub] = await db.select().from(translatorSubscribers)
      .where(eq(translatorSubscribers.id, request.subscriber!.subscriberId));
    if (!sub) throw new UnauthorizedError('Subscriber not found');
    return {
      id: sub.id,
      name: sub.name,
      email: sub.email,
      phone_number: sub.phone_number,
      my_language: sub.my_language,
      target_language: sub.target_language,
      mode: sub.mode,
      who_hears: sub.who_hears,
      translation_mode: (sub as any).translation_mode || 'bidirectional',
      greeting_text: sub.greeting_text,
      tts_provider: sub.tts_provider,
      tts_voice_id: sub.tts_voice_id,
      balance_minutes: parseFloat(sub.balance_minutes as string),
      enabled: sub.enabled,
    };
  });

  // GET /api/translator/portal/sessions
  app.get('/sessions', { preHandler: [authenticateSubscriber] }, async (request) => {
    const query = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query);

    const rows = await db.select().from(translatorSessions)
      .where(eq(translatorSessions.subscriber_id, request.subscriber!.subscriberId))
      .orderBy(desc(translatorSessions.created_at))
      .limit(query.limit)
      .offset(query.offset);

    return { sessions: rows };
  });

  // GET /api/translator/portal/sessions/active
  app.get('/sessions/active', { preHandler: [authenticateSubscriber] }, async (request) => {
    const [row] = await db.select().from(translatorSessions)
      .where(and(
        eq(translatorSessions.subscriber_id, request.subscriber!.subscriberId),
        eq(translatorSessions.status, 'active'),
      ))
      .orderBy(desc(translatorSessions.created_at))
      .limit(1);

    return { session: row || null };
  });

  // GET /api/translator/portal/transactions
  app.get('/transactions', { preHandler: [authenticateSubscriber] }, async (request) => {
    const rows = await db.select().from(balanceTransactions)
      .where(eq(balanceTransactions.subscriber_id, request.subscriber!.subscriberId))
      .orderBy(desc(balanceTransactions.created_at))
      .limit(50);

    return { transactions: rows.map(t => ({ ...t, minutes: parseFloat(t.minutes as string) })) };
  });
};

// ─── Email Template ─────────────────────────────────────────────────

function buildPortalEmail(portalUrl: string, name: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0e131f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e131f;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a202c;border-radius:16px;border:1px solid rgba(140,144,159,0.15);overflow:hidden;">
        <tr><td style="padding:32px 32px 0;">
          <div style="font-size:20px;font-weight:800;color:#dde2f3;letter-spacing:-0.5px;">
            <span style="color:#adc6ff;">&#9679;</span> Caller Translator
          </div>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#dde2f3;">Hello, ${name}!</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#c2c6d6;line-height:1.6;">
            Click the button below to access your Translator Portal. This link expires in 15 minutes.
          </p>
          <a href="${portalUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#adc6ff,#4d8eff);color:#0e131f;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px;">
            Open Portal
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:rgba(194,198,214,0.5);line-height:1.5;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;border-top:1px solid rgba(140,144,159,0.1);">
          <p style="margin:0;font-size:11px;color:rgba(194,198,214,0.3);">
            Caller &mdash; Live Translator Service
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default portalRoutes;
