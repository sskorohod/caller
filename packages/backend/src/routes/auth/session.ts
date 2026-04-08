import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT } from 'jose';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { users, workspaces, workspaceMembers, magicLinks } from '../../db/schema.js';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { sendEmail, buildMagicLinkEmail } from '../../services/email.service.js';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  const hashBuf = Buffer.from(hash, 'hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(hashBuf, derived);
}

function issueJWT(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  workspace_name: z.string().min(1).max(100).optional(),
  phone_number: z.string().transform(s => s.replace(/[\s\-\(\)]/g, '')).pipe(z.string().regex(/^\+[1-9]\d{1,14}$/)).optional(),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const sessionRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/auth/me — return current user info + role
  app.get('/me', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Not authenticated' });

    let userId: string;
    try {
      const { verifyJWT } = await import('../../lib/jwt.js');
      const payload = await verifyJWT(token);
      userId = payload.sub;
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const [user] = await db.select({ id: users.id, email: users.email })
      .from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return reply.status(401).send({ error: 'User not found' });

    const [membership] = await db.select({
      workspace_id: workspaceMembers.workspace_id,
      role: workspaceMembers.role,
    }).from(workspaceMembers)
      .where(eq(workspaceMembers.user_id, userId)).limit(1);

    return reply.send({
      user: { id: user.id, email: user.email },
      role: membership?.role ?? null,
      workspaceId: membership?.workspace_id ?? null,
    });
  });

  // POST /api/auth/register — create first user + workspace
  app.post('/register', async (request, reply) => {
    const body = registerBody.parse(request.body);

    // Check if email already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, body.email));

    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(body.password);

    // Create user
    const [user] = await db
      .insert(users)
      .values({ email: body.email, password_hash: passwordHash })
      .returning({ id: users.id, email: users.email });

    if (!user) throw new Error('Failed to create user');

    // Auto-generate workspace name from email if not provided
    const workspaceName = body.workspace_name || body.email
      .split('@')[0]
      .replace(/[._+]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim() || 'My Workspace';

    const slug = workspaceName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) + '-' + randomBytes(3).toString('hex');

    const [workspace] = await db
      .insert(workspaces)
      .values({ name: workspaceName, slug, phone_numbers: body.phone_number ? [body.phone_number] : [] })
      .returning({ id: workspaces.id, name: workspaces.name, plan: workspaces.plan });

    if (!workspace) throw new Error('Failed to create workspace');

    // Add user as owner
    await db.insert(workspaceMembers).values({
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'owner',
    });

    // Credit $2 signup bonus
    try {
      const { creditDeposit } = await import('../../services/billing.service.js');
      await creditDeposit({
        workspaceId: workspace.id,
        amountUsd: 2.00,
        type: 'signup_bonus',
        description: 'Welcome bonus — $2 free credit',
        referenceType: 'system',
      });
    } catch (err) {
      // Non-critical — don't fail registration
      app.log.error({ err }, 'Failed to credit signup bonus');
    }

    const token = await issueJWT(user.id);

    return reply.status(201).send({
      token,
      user: { id: user.id, email: user.email },
      workspace: { id: workspace.id, name: workspace.name, plan: workspace.plan },
    });
  });

  // POST /api/auth/login
  app.post('/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
        keyGenerator: (request: import('fastify').FastifyRequest) => request.ip,
      },
    },
  }, async (request, reply) => {
    const body = loginBody.parse(request.body);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, body.email));

    if (!user) throw new UnauthorizedError('Invalid email or password');

    let valid: boolean;
    try {
      valid = await verifyPassword(body.password, user.password_hash);
    } catch {
      throw new UnauthorizedError('Invalid email or password');
    }
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    const token = await issueJWT(user.id);

    // Resolve workspace for the user
    const [membership] = await db
      .select({ workspace_id: workspaceMembers.workspace_id, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.user_id, user.id))
      .limit(1);

    let workspace = null;
    if (membership) {
      const [ws] = await db.select({ id: workspaces.id, name: workspaces.name, plan: workspaces.plan })
        .from(workspaces)
        .where(eq(workspaces.id, membership.workspace_id));
      if (ws) workspace = { ...ws, role: membership.role };
    }

    return reply.send({
      token,
      user: { id: user.id, email: user.email },
      workspace,
    });
  });

  // ─── Magic Link ─────────────────────────────────────────────────────

  // POST /api/auth/magic-link — send magic link email
  app.post('/magic-link', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '5 minutes',
        keyGenerator: (request: import('fastify').FastifyRequest) => request.ip,
      },
    },
  }, async (request, reply) => {
    const body = z.object({ email: z.string().email(), phone_number: z.string().transform(s => s.replace(/[\s\-\(\)]/g, '')).pipe(z.string().regex(/^\+[1-9]\d{1,14}$/)).optional() }).parse(request.body);

    // Generate secure token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save magic link
    await db.insert(magicLinks).values({
      email: body.email.toLowerCase(),
      phone_number: body.phone_number ?? null,
      token,
      expires_at: expiresAt,
    });

    // Build magic link URL
    const baseUrl = request.headers.origin || `https://${env.API_DOMAIN}`;
    const magicLink = `${baseUrl}/auth/verify?token=${token}`;

    // Send email
    const emailContent = buildMagicLinkEmail(magicLink);
    await sendEmail({
      to: body.email,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    return reply.send({ success: true, message: 'Magic link sent' });
  });

  // GET /api/auth/verify — verify magic link token and return JWT
  app.get('/verify', async (request, reply) => {
    const query = z.object({ token: z.string().min(1) }).parse(request.query);

    // Find valid, unused token
    const [link] = await db.select()
      .from(magicLinks)
      .where(and(
        eq(magicLinks.token, query.token),
        gt(magicLinks.expires_at, new Date()),
        isNull(magicLinks.used_at),
      ))
      .limit(1);

    if (!link) {
      return reply.status(400).send({ error: 'Invalid or expired link' });
    }

    // Mark token as used
    await db.update(magicLinks)
      .set({ used_at: new Date() })
      .where(eq(magicLinks.id, link.id));

    const email = link.email.toLowerCase();

    // Find or create user
    let [user] = await db.select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let workspace: { id: string; name: string; plan: string } | null = null;
    let isNewUser = false;

    if (!user) {
      // New user — create user + workspace + $2 bonus
      isNewUser = true;
      const randomPassword = randomBytes(32).toString('hex');
      const passwordHash = await hashPassword(randomPassword);

      [user] = await db.insert(users)
        .values({ email, password_hash: passwordHash })
        .returning({ id: users.id, email: users.email });

      // Auto workspace name from email
      const workspaceName = email
        .split('@')[0]
        .replace(/[._+]/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase())
        .trim() || 'My Workspace';

      const slug = workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50) + '-' + randomBytes(3).toString('hex');

      const [ws] = await db.insert(workspaces)
        .values({ name: workspaceName, slug, phone_numbers: link.phone_number ? [link.phone_number] : [] })
        .returning({ id: workspaces.id, name: workspaces.name, plan: workspaces.plan });

      if (ws) {
        workspace = ws;
        await db.insert(workspaceMembers).values({
          workspace_id: ws.id,
          user_id: user.id,
          role: 'owner',
        });

        // Credit $2 signup bonus
        try {
          const { creditDeposit } = await import('../../services/billing.service.js');
          await creditDeposit({
            workspaceId: ws.id,
            amountUsd: 2.00,
            type: 'signup_bonus',
            description: 'Welcome bonus — $2 free credit',
            referenceType: 'system',
          });
        } catch { /* non-critical */ }
      }
    } else {
      // Existing user — find workspace
      const [membership] = await db.select({ workspace_id: workspaceMembers.workspace_id })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.user_id, user.id))
        .limit(1);

      if (membership) {
        const [ws] = await db.select({ id: workspaces.id, name: workspaces.name, plan: workspaces.plan })
          .from(workspaces)
          .where(eq(workspaces.id, membership.workspace_id));
        if (ws) workspace = ws;
      }
    }

    const jwt = await issueJWT(user.id);

    // Return JSON with token (frontend will handle redirect)
    return reply.send({
      token: jwt,
      user: { id: user.id, email: user.email },
      workspace,
      isNewUser,
      needsPassword: isNewUser, // new users must set a password
    });
  });

  // ─── Set Password ───────────────────────────────────────────────────

  // POST /api/auth/set-password — set password for current user (after magic link)
  app.post('/set-password', async (request, reply) => {
    const body = z.object({
      token: z.string().min(1),
      password: z.string().min(8, 'Password must be at least 8 characters'),
    }).parse(request.body);

    // Verify JWT token to get user ID
    const { verifyJWT } = await import('../../lib/jwt.js');
    let userId: string;
    try {
      const payload = await verifyJWT(body.token);
      userId = payload.sub;
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const passwordHash = await hashPassword(body.password);

    await db.update(users)
      .set({ password_hash: passwordHash, updated_at: new Date() })
      .where(eq(users.id, userId));

    return reply.send({ success: true });
  });
};

export default sessionRoutes;
