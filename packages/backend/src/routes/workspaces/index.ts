import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { authenticateUser, authenticateAny, requireRole } from '../../middleware/auth.js';
import * as workspaceService from '../../services/workspace.service.js';
import { normalizePhone } from '../../lib/phone.js';
import * as auditService from '../../services/audit.service.js';
import { isAllowedWebhookUrl } from '../../lib/url-validation.js';
import { db } from '../../config/db.js';
import { users } from '../../db/schema.js';

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  industry: z.string().optional(),
  timezone: z.string().optional(),
  languages: z.array(z.string()).optional(),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone_numbers: z.array(z.string().transform(normalizePhone).pipe(z.string().regex(/^\+[1-9]\d{1,14}$/))).max(3).optional(),
  industry: z.string().optional(),
  timezone: z.string().optional(),
  languages: z.array(z.string()).optional(),
  conversation_owner_default: z.enum(['internal', 'external']).optional(),
  allow_inbound_external_handoff: z.boolean().optional(),
  external_inbound_webhook_url: z.string().url().nullable().optional()
    .refine(val => !val || isAllowedWebhookUrl(val), 'Webhook URL must use HTTPS and point to a public address'),
  external_ready_timeout_ms: z.number().min(1000).max(30000).optional(),
  inbound_fallback_mode: z.string().optional(),
  recording_retention_days: z.number().min(1).max(365).optional(),
  transcript_retention_days: z.number().min(1).max(3650).optional(),
  call_recording_disclosure: z.boolean().optional(),
  ai_disclosure: z.boolean().optional(),
  inbound_auto_answer_delay_seconds: z.number().min(5).max(120).optional(),
});

const workspaceRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/workspaces/current — supports both JWT and API key (MCP)
  app.get('/current', { preHandler: [authenticateAny] }, async (request) => {
    const workspace = await workspaceService.getWorkspace(request.auth.workspaceId);
    return {
      ...workspace,
      openai_proxy_available: !!process.env.OPENAI_OAUTH_PROXY_URL,
    };
  });

  // PATCH /api/workspaces/current
  app.patch('/current', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const body = updateWorkspaceSchema.parse(request.body);
    const workspace = await workspaceService.updateWorkspace(request.auth.workspaceId, body);

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'workspace.updated',
      resourceType: 'workspace',
      resourceId: workspace.id,
      changes: body,
    });

    return workspace;
  });

  // GET /api/workspaces/members — list members with email
  app.get('/members', { preHandler: [authenticateUser] }, async (request) => {
    const members = await workspaceService.getWorkspaceMembers(request.auth.workspaceId);

    // Enrich with user email (single query instead of N+1)
    const userIds = members.map((m) => m.user_id);
    const emailRows = userIds.length > 0
      ? await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, userIds))
      : [];
    const emailMap = new Map(emailRows.map((u) => [u.id, u.email]));

    return members.map((m) => ({ ...m, email: emailMap.get(m.user_id) ?? null }));
  });

  // POST /api/workspaces/members — add by user_id
  app.post('/members', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const body = z.object({
      user_id: z.string().uuid(),
      role: z.enum(['admin', 'operator', 'analyst']),
    }).parse(request.body);

    const member = await workspaceService.addWorkspaceMember(
      request.auth.workspaceId,
      body.user_id,
      body.role,
    );

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'member.added',
      resourceType: 'workspace_member',
      resourceId: member.id,
      changes: { user_id: body.user_id, role: body.role },
    });

    return member;
  });

  // POST /api/workspaces/members/invite — invite by email
  app.post('/members/invite', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const body = z.object({
      email: z.string().email(),
      role: z.enum(['admin', 'operator', 'analyst']),
    }).parse(request.body);

    // Find user by email
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email));
    if (!user) {
      return reply.status(404).send({ message: 'No user found with this email. They must register first.' });
    }

    const member = await workspaceService.addWorkspaceMember(
      request.auth.workspaceId,
      user.id,
      body.role,
    );

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'member.invited',
      resourceType: 'workspace_member',
      resourceId: member.id,
      changes: { email: body.email, role: body.role },
    });

    return member;
  });

  // DELETE /api/workspaces/members/:id — remove member
  app.delete('/members/:id', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    await workspaceService.removeMember(request.auth.workspaceId, id);

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'member.removed',
      resourceType: 'workspace_member',
      resourceId: id,
    });

    return { ok: true };
  });

  // POST /api/workspaces/test-telegram — send test message via Telegram bot
  app.post('/test-telegram', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const { getProviderCredential } = await import('../../services/provider.service.js');
    const { testBot } = await import('../../services/telegram.service.js');

    let creds: Record<string, string>;
    try {
      creds = await getProviderCredential(request.auth.workspaceId, 'telegram');
    } catch {
      return reply.status(404).send({ ok: false, error: 'Telegram credentials not configured' });
    }

    if (!creds.bot_token || !creds.chat_id) {
      return reply.status(400).send({ ok: false, error: 'bot_token and chat_id are required' });
    }

    const success = await testBot(creds.bot_token, creds.chat_id);
    if (!success) {
      return reply.status(502).send({ ok: false, error: 'Failed to send test message. Check bot token and chat ID.' });
    }

    return { ok: true };
  });

  // POST /api/workspaces/test-storage — test MinIO connection
  app.post('/test-storage', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async () => {
    const { testConnection, isMinioConfigured } = await import('../../services/recording-storage.service.js');
    if (!isMinioConfigured()) {
      return { connected: false, error: 'MinIO is not configured. Set MINIO_* environment variables.' };
    }
    const ok = await testConnection();
    return { connected: ok, error: ok ? null : 'Could not connect to MinIO' };
  });
};

export default workspaceRoutes;
