import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../config/db.js';
import { apiKeys } from '../db/schema.js';
import { generateApiKey } from '../lib/crypto.js';
import { NotFoundError } from '../lib/errors.js';
import type { ApiKey } from '../models/types.js';

export async function createApiKey(params: {
  workspaceId: string;
  name: string;
  createdBy?: string;
}): Promise<{ apiKey: ApiKey; plainKey: string }> {
  const { key, prefix, hash } = generateApiKey();

  const [row] = await db.insert(apiKeys).values({
    workspace_id: params.workspaceId,
    name: params.name,
    key_prefix: prefix,
    key_hash: hash,
    created_by: params.createdBy ?? null,
  }).returning();

  return { apiKey: row as unknown as ApiKey, plainKey: key };
}

export async function listApiKeys(workspaceId: string): Promise<ApiKey[]> {
  const rows = await db.select().from(apiKeys)
    .where(eq(apiKeys.workspace_id, workspaceId))
    .orderBy(desc(apiKeys.created_at));

  return rows as unknown as ApiKey[];
}

export async function revokeApiKey(workspaceId: string, keyId: string): Promise<ApiKey> {
  const [row] = await db.update(apiKeys)
    .set({ revoked_at: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.workspace_id, workspaceId)))
    .returning();

  if (!row) throw new NotFoundError('API Key', keyId);
  return row as unknown as ApiKey;
}
