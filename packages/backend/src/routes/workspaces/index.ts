import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import * as workspaceService from '../../services/workspace.service.js';
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
});

const workspaceRoutes: FastifyPluginAsync = async (app) => {
  // All routes require authentication
  app.addHook('onRequest', authenticateUser);

  // GET /api/workspaces/current
  app.get('/current', async (request) => {
    return workspaceService.getWorkspace(request.auth.workspaceId);
  });

  // PATCH /api/workspaces/current
  app.patch('/current', {
    preHandler: [requireRole('owner', 'admin')],
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
  app.get('/members', async (request) => {
    const members = await workspaceService.getWorkspaceMembers(request.auth.workspaceId);

    // Enrich with user email
    const enriched = await Promise.all(
      members.map(async (m) => {
        const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, m.user_id));
        return { ...m, email: user?.email ?? null };
      }),
    );

    return enriched;
  });

  // POST /api/workspaces/members — add by user_id
  app.post('/members', {
    preHandler: [requireRole('owner', 'admin')],
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
    preHandler: [requireRole('owner', 'admin')],
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
    preHandler: [requireRole('owner', 'admin')],
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
};

export default workspaceRoutes;
