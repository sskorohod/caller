import { eq, sql } from 'drizzle-orm';
import { db } from '../config/db.js';
import { agentProfiles, telephonyConnections, workspaces } from '../db/schema.js';
import { PLANS } from '../config/plans.js';
import type { WorkspacePlan } from '../models/types.js';

export async function getResourceCounts(workspaceId: string): Promise<{
  agentCount: number;
  connectionCount: number;
}> {
  const [[agents], [connections]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` })
      .from(agentProfiles)
      .where(eq(agentProfiles.workspace_id, workspaceId)),
    db.select({ count: sql<number>`count(*)::int` })
      .from(telephonyConnections)
      .where(eq(telephonyConnections.workspace_id, workspaceId)),
  ]);

  return {
    agentCount: agents?.count ?? 0,
    connectionCount: connections?.count ?? 0,
  };
}

export async function checkResourceLimit(
  workspaceId: string,
  plan: WorkspacePlan,
  resource: 'agent' | 'connection',
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const planConfig = PLANS[plan];
  if (!planConfig) return { allowed: false, current: 0, limit: 0 };

  const counts = await getResourceCounts(workspaceId);
  const current = resource === 'agent' ? counts.agentCount : counts.connectionCount;
  const limit = resource === 'agent'
    ? planConfig.features.maxAgentProfiles
    : planConfig.features.maxTelephonyConnections;

  // -1 means unlimited
  if (limit === -1) return { allowed: true, current, limit };
  // 0 means blocked (feature not available)
  if (limit === 0) return { allowed: false, current, limit: 0 };

  return { allowed: current < limit, current, limit };
}
