import { eq, and } from 'drizzle-orm';
import { db } from '../config/db.js';
import { providerCredentials } from '../db/schema.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { NotFoundError } from '../lib/errors.js';
import type { ProviderCredential, ProviderName } from '../models/types.js';

interface ProviderCredentialInput {
  workspaceId: string;
  provider: ProviderName;
  credentials: Record<string, string>;
}

export async function saveProviderCredential(params: ProviderCredentialInput): Promise<ProviderCredential> {
  const encrypted = encrypt(JSON.stringify(params.credentials));

  const [row] = await db.insert(providerCredentials).values({
    workspace_id: params.workspaceId,
    provider: params.provider,
    credential_data: encrypted,
    is_verified: false,
    verified_at: null,
  }).onConflictDoUpdate({
    target: [providerCredentials.workspace_id, providerCredentials.provider],
    set: {
      credential_data: encrypted,
      is_verified: false,
      verified_at: null,
    },
  }).returning();

  return row as unknown as ProviderCredential;
}

export async function getProviderCredential(
  workspaceId: string,
  provider: ProviderName,
): Promise<Record<string, string>> {
  const [row] = await db.select().from(providerCredentials)
    .where(and(
      eq(providerCredentials.workspace_id, workspaceId),
      eq(providerCredentials.provider, provider),
    ));

  if (!row) throw new NotFoundError('Provider credential', provider);
  return JSON.parse(decrypt(row.credential_data));
}

export async function listProviderCredentials(workspaceId: string): Promise<
  Array<{ provider: ProviderName; is_verified: boolean; verified_at: string | null }>
> {
  const rows = await db.select({
    provider: providerCredentials.provider,
    is_verified: providerCredentials.is_verified,
    verified_at: providerCredentials.verified_at,
  }).from(providerCredentials)
    .where(eq(providerCredentials.workspace_id, workspaceId));

  return rows as Array<{ provider: ProviderName; is_verified: boolean; verified_at: string | null }>;
}

export async function markProviderVerified(workspaceId: string, provider: ProviderName): Promise<void> {
  await db.update(providerCredentials)
    .set({ is_verified: true, verified_at: new Date() })
    .where(and(
      eq(providerCredentials.workspace_id, workspaceId),
      eq(providerCredentials.provider, provider),
    ));
}

export async function deleteProviderCredential(workspaceId: string, provider: ProviderName): Promise<void> {
  await db.delete(providerCredentials)
    .where(and(
      eq(providerCredentials.workspace_id, workspaceId),
      eq(providerCredentials.provider, provider),
    ));
}
