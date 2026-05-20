import type { FastifyPluginAsync } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { authenticateUser } from '../../middleware/auth.js';
import { db } from '../../config/db.js';
import { dailyCheckIns } from '../../db/schema.js';

/**
 * GET /api/checkins — recent daily check-ins for the workspace, newest first.
 * Workspace-scoped via request.auth.workspaceId.
 */
const checkinRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  app.get('/', async (request) => {
    const rows = await db.select().from(dailyCheckIns)
      .where(eq(dailyCheckIns.workspace_id, request.auth.workspaceId))
      .orderBy(desc(dailyCheckIns.checkin_date))
      .limit(30);
    return { checkins: rows };
  });
};

export default checkinRoutes;
