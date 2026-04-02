import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { db } from '../../config/db.js';
import { auditLogs, users } from '../../db/schema.js';
import { eq, and, desc, count, gte, lte, sql } from 'drizzle-orm';

const listSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const auditRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/audit-logs
  app.get('/', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const query = listSchema.parse(request.query);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const conditions = [eq(auditLogs.workspace_id, request.auth.workspaceId)];
    if (query.action) conditions.push(eq(auditLogs.action, query.action));
    if (query.from) conditions.push(gte(auditLogs.created_at, new Date(query.from)));
    if (query.to) conditions.push(lte(auditLogs.created_at, new Date(query.to)));

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ total: count() })
      .from(auditLogs)
      .where(whereClause);

    const total = countResult?.total ?? 0;

    const rows = await db
      .select({
        id: auditLogs.id,
        user_id: auditLogs.user_id,
        action: auditLogs.action,
        resource_type: auditLogs.resource_type,
        resource_id: auditLogs.resource_id,
        changes: auditLogs.changes,
        ip_address: auditLogs.ip_address,
        created_at: auditLogs.created_at,
        user_email: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.user_id, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.created_at))
      .limit(limit)
      .offset(offset);

    return { logs: rows, total };
  });
};

export default auditRoutes;
