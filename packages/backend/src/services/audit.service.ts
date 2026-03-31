import { db } from '../config/db.js';
import { auditLogs } from '../db/schema.js';

export async function writeAuditLog(params: {
  workspaceId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  await db.insert(auditLogs).values({
    workspace_id: params.workspaceId,
    user_id: params.userId ?? null,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId ?? null,
    changes: params.changes ?? {},
    ip_address: params.ipAddress ?? null,
  });
}
