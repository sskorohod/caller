import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
import * as jose from 'jose';
import { db } from '../../config/db.js';
import { oauthClients, oauthCodes, workspaceMembers } from '../../db/schema.js';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { authenticateUser, requireRole } from '../../middleware/auth.js';

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function verifyJwt(token: string): Promise<{ sub: string; workspaceId: string } | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    const userId = payload.sub as string;
    // OAuth tokens already include workspaceId; session JWTs do not — resolve from DB
    let workspaceId = (payload as any).workspaceId as string | undefined;
    if (!workspaceId) {
      const [membership] = await db
        .select({ workspace_id: workspaceMembers.workspace_id })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.user_id, userId))
        .limit(1);
      if (!membership) return null;
      workspaceId = membership.workspace_id;
    }
    return { sub: userId, workspaceId };
  } catch {
    return null;
  }
}

const oauthRoutes: FastifyPluginAsync = async (app) => {
  // Parse application/x-www-form-urlencoded for /token endpoint (ChatGPT sends form body)
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        const parsed = Object.fromEntries(new URLSearchParams(body as string).entries());
        done(null, parsed);
      } catch (e) {
        done(e as Error, undefined);
      }
    },
  );

  // ─── OAuth Client Management (requires auth) ───────────────────────────────

  // GET /api/oauth/clients
  app.get('/clients', { preHandler: [authenticateUser] }, async (request) => {
    return db
      .select({
        id: oauthClients.id,
        name: oauthClients.name,
        client_id: oauthClients.client_id,
        redirect_uris: oauthClients.redirect_uris,
        created_at: oauthClients.created_at,
      })
      .from(oauthClients)
      .where(eq(oauthClients.workspace_id, request.auth.workspaceId));
  });

  // POST /api/oauth/clients
  app.post('/clients', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const body = z.object({
      name: z.string().min(1).max(100),
      redirect_uris: z.array(z.string().url()).min(1).max(10),
    }).parse(request.body);

    const clientId = 'caller_' + crypto.randomBytes(12).toString('hex');
    const clientSecret = crypto.randomBytes(32).toString('hex');

    const [client] = await db.insert(oauthClients).values({
      workspace_id: request.auth.workspaceId,
      name: body.name,
      client_id: clientId,
      client_secret_hash: sha256(clientSecret),
      redirect_uris: body.redirect_uris,
    }).returning();

    reply.status(201);
    return {
      id: client.id,
      name: client.name,
      client_id: client.client_id,
      client_secret: clientSecret, // Shown only once
      redirect_uris: client.redirect_uris,
      created_at: client.created_at,
    };
  });

  // DELETE /api/oauth/clients/:id
  app.delete('/clients/:id', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await db.delete(oauthClients).where(
      and(
        eq(oauthClients.id, id),
        eq(oauthClients.workspace_id, request.auth.workspaceId),
      ),
    );
    return { deleted: true };
  });

  // ─── Authorization Endpoint ────────────────────────────────────────────────

  // GET /api/oauth/authorize — validate client, return info for consent page
  app.get('/authorize', async (request, reply) => {
    const result = z.object({
      client_id: z.string(),
      redirect_uri: z.string().url(),
      response_type: z.literal('code'),
      state: z.string().optional(),
    }).safeParse(request.query);

    if (!result.success) {
      reply.status(400);
      return { error: 'invalid_request', error_description: 'Missing or invalid parameters' };
    }

    const [client] = await db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.client_id, result.data.client_id));

    if (!client) {
      reply.status(400);
      return { error: 'invalid_client', error_description: 'Unknown client_id' };
    }

    if (!client.redirect_uris.includes(result.data.redirect_uri)) {
      reply.status(400);
      return { error: 'invalid_request', error_description: 'redirect_uri not registered for this client' };
    }

    return {
      client_name: client.name,
      client_id: client.client_id,
      redirect_uri: result.data.redirect_uri,
    };
  });

  // POST /api/oauth/authorize — user approves/denies (requires JWT in Authorization header)
  app.post('/authorize', async (request, reply) => {
    const raw = (request.headers.authorization ?? '').replace('Bearer ', '');
    const jwtPayload = await verifyJwt(raw);

    if (!jwtPayload) {
      reply.status(401);
      return { error: 'unauthorized', error_description: 'Valid JWT required' };
    }

    const body = z.object({
      client_id: z.string(),
      redirect_uri: z.string().url(),
      state: z.string().optional(),
      approved: z.boolean(),
    }).parse(request.body);

    const sep = body.redirect_uri.includes('?') ? '&' : '?';
    const statePart = body.state ? `&state=${encodeURIComponent(body.state)}` : '';

    if (!body.approved) {
      return {
        redirect_to: `${body.redirect_uri}${sep}error=access_denied${statePart}`,
      };
    }

    const [client] = await db
      .select()
      .from(oauthClients)
      .where(
        and(
          eq(oauthClients.client_id, body.client_id),
          eq(oauthClients.workspace_id, jwtPayload.workspaceId),
        ),
      );

    if (!client || !client.redirect_uris.includes(body.redirect_uri)) {
      reply.status(400);
      return { error: 'invalid_client' };
    }

    const code = crypto.randomBytes(32).toString('hex');
    await db.insert(oauthCodes).values({
      workspace_id: jwtPayload.workspaceId,
      user_id: jwtPayload.sub,
      client_id: body.client_id,
      code,
      redirect_uri: body.redirect_uri,
      state: body.state ?? null,
    });

    return {
      redirect_to: `${body.redirect_uri}${sep}code=${encodeURIComponent(code)}${statePart}`,
    };
  });

  // ─── Token Endpoint ────────────────────────────────────────────────────────

  // POST /api/oauth/token — exchange code for access token
  // Accepts both JSON and application/x-www-form-urlencoded (ChatGPT uses form encoding)
  app.post('/token', async (request, reply) => {
    const parsed = z.object({
      grant_type: z.literal('authorization_code'),
      code: z.string(),
      redirect_uri: z.string().url(),
      client_id: z.string(),
      client_secret: z.string(),
    }).safeParse(request.body);

    if (!parsed.success) {
      reply.status(400);
      return { error: 'invalid_request', error_description: 'Missing required parameters' };
    }

    const d = parsed.data;

    // Verify client credentials
    const [client] = await db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.client_id, d.client_id));

    if (!client || client.client_secret_hash !== sha256(d.client_secret)) {
      reply.status(401);
      return { error: 'invalid_client', error_description: 'Invalid client credentials' };
    }

    // Find and verify authorization code
    const [oauthCode] = await db
      .select()
      .from(oauthCodes)
      .where(
        and(
          eq(oauthCodes.code, d.code),
          eq(oauthCodes.client_id, d.client_id),
          gt(oauthCodes.expires_at, new Date()),
          isNull(oauthCodes.used_at),
        ),
      );

    if (!oauthCode) {
      reply.status(400);
      return { error: 'invalid_grant', error_description: 'Code is expired, already used, or invalid' };
    }

    if (oauthCode.redirect_uri !== d.redirect_uri) {
      reply.status(400);
      return { error: 'invalid_grant', error_description: 'redirect_uri mismatch' };
    }

    // Mark code as used (single-use)
    await db.update(oauthCodes)
      .set({ used_at: new Date() })
      .where(eq(oauthCodes.id, oauthCode.id));

    // Issue JWT access token (valid 90 days)
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const accessToken = await new jose.SignJWT({
      sub: oauthCode.user_id,
      workspaceId: oauthCode.workspace_id,
      source: 'oauth',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('90d')
      .sign(secret);

    reply.header('Cache-Control', 'no-store');
    reply.header('Pragma', 'no-cache');
    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 90 * 24 * 60 * 60, // seconds
    };
  });
};

export default oauthRoutes;
