import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT } from 'jose';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { users, workspaces, workspaceMembers } from '../../db/schema.js';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../lib/errors.js';

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
  workspace_name: z.string().min(1).max(100),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const sessionRoutes: FastifyPluginAsync = async (app) => {
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

    // Create workspace
    const slug = body.workspace_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) + '-' + randomBytes(3).toString('hex');

    const [workspace] = await db
      .insert(workspaces)
      .values({ name: body.workspace_name, slug })
      .returning({ id: workspaces.id, name: workspaces.name });

    if (!workspace) throw new Error('Failed to create workspace');

    // Add user as owner
    await db.insert(workspaceMembers).values({
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'owner',
    });

    const token = await issueJWT(user.id);

    return reply.status(201).send({
      token,
      user: { id: user.id, email: user.email },
      workspace: { id: workspace.id, name: workspace.name },
    });
  });

  // POST /api/auth/login
  app.post('/login', async (request, reply) => {
    const body = loginBody.parse(request.body);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, body.email));

    if (!user) throw new UnauthorizedError('Invalid email or password');

    const valid = await verifyPassword(body.password, user.password_hash);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    const token = await issueJWT(user.id);

    return reply.send({
      token,
      user: { id: user.id, email: user.email },
    });
  });
};

export default sessionRoutes;
