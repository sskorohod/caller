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
import { sendEmail, buildMagicLinkEmail, buildPasswordResetEmail, isEmailConfigured } from '../../services/email.service.js';
import { validatePhoneNumbersUnique } from '../../services/workspace.service.js';
import { normalizePhone } from '../../lib/phone.js';

const scryptAsync = promisify(scrypt);

// Fixed dummy hash (valid salt:hash shape, 64-byte hash) used to spend an
// equivalent scrypt cost on logins for non-existent accounts — closes the
// timing oracle that would otherwise reveal which emails are registered.
const DUMMY_PASSWORD_HASH = `${'0'.repeat(32)}:${'0'.repeat(128)}`;

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
  email: z.string().email().transform(s => s.trim().toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  workspace_name: z.string().min(1).max(100).optional(),
  phone_number: z.string().transform(normalizePhone).pipe(z.string().regex(/^\+[1-9]\d{1,14}$/)).optional(),
});

const loginBody = z.object({
  email: z.string().email().transform(s => s.trim().toLowerCase()),
  password: z.string().min(1),
});

const sessionRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/auth/me — return current user info + role
  app.get('/me', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Not authenticated' });

    let userId: string;
    let tokenIat: number | undefined;
    try {
      const { verifyJWT } = await import('../../lib/jwt.js');
      const payload = await verifyJWT(token);
      userId = payload.sub;
      tokenIat = payload.iat;
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const [user] = await db.select({ id: users.id, email: users.email, is_admin: users.is_admin, tokens_valid_from: users.tokens_valid_from })
      .from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return reply.status(401).send({ error: 'User not found' });

    // Honor token revocation here too (mirror of middleware/auth.ts), so a token
    // invalidated by a password change can't keep reading identity info.
    if (user.tokens_valid_from &&
        (!tokenIat || tokenIat * 1000 < new Date(user.tokens_valid_from).getTime() - 5000)) {
      return reply.status(401).send({ error: 'Session expired' });
    }

    const [membership] = await db.select({
      workspace_id: workspaceMembers.workspace_id,
      role: workspaceMembers.role,
    }).from(workspaceMembers)
      .where(eq(workspaceMembers.user_id, userId)).limit(1);

    return reply.send({
      user: { id: user.id, email: user.email },
      role: membership?.role ?? null,
      is_admin: user.is_admin === true,
      workspaceId: membership?.workspace_id ?? null,
    });
  });

  // POST /api/auth/register — create first user + workspace
  // Rate-limited per IP: registration is a one-time action, so 5/hour is
  // generous for legit users while blocking signup-spam / email-flood / DB
  // enumeration via the 409 "email already registered" response.
  app.post('/register', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 hour',
        keyGenerator: (request: import('fastify').FastifyRequest) => request.ip,
      },
    },
  }, async (request, reply) => {
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
      .values({ email: body.email, password_hash: passwordHash, password_set: true })
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

    // Validate phone number is not already taken by another workspace
    const phoneNumbers = body.phone_number ? [body.phone_number] : [];
    if (phoneNumbers.length) {
      await validatePhoneNumbersUnique(phoneNumbers, '00000000-0000-0000-0000-000000000000'); // dummy ID — new workspace has no ID yet
    }

    const [workspace] = await db
      .insert(workspaces)
      .values({ name: workspaceName, slug, phone_numbers: phoneNumbers })
      .returning({ id: workspaces.id, name: workspaces.name, plan: workspaces.plan });

    if (!workspace) throw new Error('Failed to create workspace');

    // Add user as owner
    await db.insert(workspaceMembers).values({
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'owner',
    });

    // First-ever user becomes the platform admin (covers fresh installs;
    // existing installs designate the admin via migration 00048).
    const [existingAdmin] = await db.select({ id: users.id })
      .from(users).where(eq(users.is_admin, true)).limit(1);
    if (!existingAdmin) {
      await db.update(users).set({ is_admin: true }).where(eq(users.id, user.id));
    }

    // Signup bonus: granted only with a phone that never claimed it before.
    // Without a phone the grant is deferred to the first phone added in
    // Settings (see PATCH /workspaces/current).
    const { grantSignupBonusIfEligible } = await import('../../services/signup-bonus.service.js');
    const bonus = await grantSignupBonusIfEligible({
      workspaceId: workspace.id,
      phones: phoneNumbers,
      source: 'register',
    });
    if (bonus.blocked) {
      app.log.info({ workspaceId: workspace.id }, 'Signup bonus blocked — phone previously claimed it');
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

    // Constant-cost verification: run scrypt even when the email is unknown,
    // using a fixed dummy hash, so response timing can't distinguish
    // "no such account" from "wrong password" (account-enumeration oracle).
    const storedHash = user?.password_hash ?? DUMMY_PASSWORD_HASH;
    let valid = false;
    try {
      valid = await verifyPassword(body.password, storedHash);
    } catch {
      valid = false;
    }
    if (!user || !valid) throw new UnauthorizedError('Invalid email or password');

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

    // Don't create an orphan token (and don't claim success) if email can't be
    // delivered. Surfacing this instead of the old always-{success:true} keeps
    // a misconfigured mailer from silently swallowing every sign-in link.
    if (!isEmailConfigured()) {
      return reply.status(503).send({ error: 'Email sign-in is unavailable right now. Please sign in with your email and password instead.' });
    }

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

    // Build magic link URL from a trusted server-side constant only.
    // NEVER derive it from request.headers.origin — that header is fully
    // attacker-controlled, so trusting it lets an attacker send the victim a
    // genuine login email whose link points at the attacker's domain
    // (magic-link poisoning → account takeover).
    const magicLink = `https://${env.API_DOMAIN}/auth/verify?token=${token}`;

    // Send email
    const emailContent = buildMagicLinkEmail(magicLink);
    const sent = await sendEmail({
      to: body.email,
      subject: emailContent.subject,
      html: emailContent.html,
    });
    if (!sent) {
      return reply.status(502).send({ error: 'Could not send the sign-in email. Please try again or sign in with your email and password.' });
    }

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

      const invitePhoneNumbers = link.phone_number ? [link.phone_number] : [];
      if (invitePhoneNumbers.length) {
        await validatePhoneNumbersUnique(invitePhoneNumbers, '00000000-0000-0000-0000-000000000000');
      }

      const [ws] = await db.insert(workspaces)
        .values({ name: workspaceName, slug, phone_numbers: invitePhoneNumbers })
        .returning({ id: workspaces.id, name: workspaces.name, plan: workspaces.plan });

      if (ws) {
        workspace = ws;
        await db.insert(workspaceMembers).values({
          workspace_id: ws.id,
          user_id: user.id,
          role: 'owner',
        });

        // Signup bonus: same rules as POST /register — phone required,
        // one claim per phone and per workspace, forever.
        const { grantSignupBonusIfEligible } = await import('../../services/signup-bonus.service.js');
        await grantSignupBonusIfEligible({
          workspaceId: ws.id,
          phones: invitePhoneNumbers,
          source: 'magic_link',
        });
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

  // POST /api/auth/set-password — set/change password for the current user.
  // First-time (magic-link new user, password_set=false): no current password
  // required. Otherwise the current password MUST be supplied and verified, so a
  // stolen session token alone can't silently take over the account; a genuine
  // change also revokes all outstanding tokens and re-issues a fresh one.
  app.post('/set-password', async (request, reply) => {
    const body = z.object({
      token: z.string().min(1),
      current_password: z.string().optional(),
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

    const [existing] = await db.select({
      password_hash: users.password_hash,
      password_set: users.password_set,
    }).from(users).where(eq(users.id, userId)).limit(1);
    if (!existing) return reply.status(401).send({ error: 'User not found' });

    const isChange = existing.password_set;
    if (isChange) {
      if (!body.current_password) {
        return reply.status(400).send({ error: 'Current password is required' });
      }
      let ok = false;
      try { ok = await verifyPassword(body.current_password, existing.password_hash); } catch { ok = false; }
      if (!ok) return reply.status(401).send({ error: 'Current password is incorrect' });
    }

    const passwordHash = await hashPassword(body.password);

    await db.update(users)
      .set({
        password_hash: passwordHash,
        password_set: true,
        // Revoke outstanding tokens only on a genuine change (not the first-time
        // set, which has no prior sessions to invalidate).
        ...(isChange ? { tokens_valid_from: new Date() } : {}),
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));

    // On a change we just invalidated the caller's token too — mint a fresh one
    // so they stay logged in.
    const token = isChange ? await issueJWT(userId) : undefined;
    return reply.send({ success: true, ...(token ? { token } : {}) });
  });

  // ─── Password Reset ─────────────────────────────────────────────────

  // POST /api/auth/forgot-password — email a reset link.
  // Anti-enumeration: always returns the same generic success regardless of
  // whether the email is registered. A reset token reuses the magic_links table
  // (an email-ownership proof token); the email points at /auth/reset, which
  // lets the user set a NEW password without the old one (which they forgot).
  app.post('/forgot-password', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '15 minutes',
        keyGenerator: (request: import('fastify').FastifyRequest) => request.ip,
      },
    },
  }, async (request, reply) => {
    const { email } = z.object({ email: z.string().email().transform(s => s.trim().toLowerCase()) }).parse(request.body);

    // Service-level gate (no per-email info leaked): a reset is impossible if the
    // mailer is down, so say so instead of pretending a link was sent.
    if (!isEmailConfigured()) {
      return reply.status(503).send({ error: 'Password reset is unavailable right now. Please try again later.' });
    }

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

    if (user) {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      await db.insert(magicLinks).values({ email, token, expires_at: expiresAt });

      const resetLink = `https://${env.API_DOMAIN}/auth/reset?token=${token}`;
      const emailContent = buildPasswordResetEmail(resetLink);
      // Per-send failures are intentionally NOT surfaced here: doing so would
      // reveal that the email belongs to a real account (enumeration oracle).
      await sendEmail({ to: email, subject: emailContent.subject, html: emailContent.html });
    }

    return reply.send({ success: true, message: 'If an account exists for that email, a reset link is on its way.' });
  });

  // POST /api/auth/reset-password — set a new password using a reset token.
  // The token (sent to the verified email) is the authorization, so no current
  // password is required. A successful reset revokes all outstanding sessions
  // and returns a fresh JWT.
  app.post('/reset-password', async (request, reply) => {
    const body = z.object({
      token: z.string().min(1),
      password: z.string().min(8, 'Password must be at least 8 characters'),
    }).parse(request.body);

    const [link] = await db.select()
      .from(magicLinks)
      .where(and(
        eq(magicLinks.token, body.token),
        gt(magicLinks.expires_at, new Date()),
        isNull(magicLinks.used_at),
      ))
      .limit(1);

    if (!link) {
      return reply.status(400).send({ error: 'This reset link is invalid or has expired.' });
    }

    // Single-use: burn the token before mutating the password.
    await db.update(magicLinks).set({ used_at: new Date() }).where(eq(magicLinks.id, link.id));

    const email = link.email.toLowerCase();
    const [user] = await db.select({ id: users.id, email: users.email })
      .from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return reply.status(400).send({ error: 'Account not found.' });
    }

    const passwordHash = await hashPassword(body.password);
    await db.update(users)
      .set({
        password_hash: passwordHash,
        password_set: true,
        tokens_valid_from: new Date(), // revoke any sessions opened before the reset
        updated_at: new Date(),
      })
      .where(eq(users.id, user.id));

    const jwt = await issueJWT(user.id);

    // Resolve workspace so the client can land on the dashboard.
    const [membership] = await db.select({ workspace_id: workspaceMembers.workspace_id })
      .from(workspaceMembers).where(eq(workspaceMembers.user_id, user.id)).limit(1);
    let workspace: { id: string; name: string; plan: string } | null = null;
    if (membership) {
      const [ws] = await db.select({ id: workspaces.id, name: workspaces.name, plan: workspaces.plan })
        .from(workspaces).where(eq(workspaces.id, membership.workspace_id));
      if (ws) workspace = ws;
    }

    return reply.send({ token: jwt, user: { id: user.id, email: user.email }, workspace });
  });
};

export default sessionRoutes;
