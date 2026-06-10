/**
 * Centralized credential resolution.
 *
 * Provider credentials are managed exclusively by the platform admin (the single
 * users.is_admin account). All consumers resolve against the admin's workspace,
 * regardless of which workspace is making the request — there is no per-workspace
 * BYOK anymore.
 *
 * Telegram is NOT resolved here: its credential carries a per-user chat_id
 * (notification recipient), so it stays workspace-scoped and is fetched via
 * direct queries in telegram.service.
 *
 * The `workspaceId` argument on each function is retained for call-site
 * compatibility but no longer affects which credentials are used.
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../config/db.js';
import { providerCredentials, workspaceMembers, users } from '../db/schema.js';
import { decrypt } from '../lib/crypto.js';
import type { ProviderName } from '../models/types.js';

/**
 * Resolve the platform admin's workspace id — the single workspace that holds
 * all provider credentials. Throws if no admin is configured.
 */
export async function getAdminWorkspaceId(): Promise<string> {
  const [row] = await db
    .select({ workspace_id: workspaceMembers.workspace_id })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.user_id))
    .where(and(eq(users.is_admin, true), eq(workspaceMembers.role, 'owner')))
    .limit(1);
  if (!row) throw new Error('No platform admin configured');
  return row.workspace_id;
}

/**
 * Resolve decrypted credentials for a provider from the admin workspace.
 */
export async function resolveCredentials<T = Record<string, string>>(
  _workspaceId: string,
  provider: ProviderName | string,
): Promise<T> {
  const adminWs = await getAdminWorkspaceId();
  const [row] = await db
    .select({ credential_data: providerCredentials.credential_data })
    .from(providerCredentials)
    .where(and(
      eq(providerCredentials.workspace_id, adminWs),
      eq(providerCredentials.provider, provider),
    ));
  if (!row) throw new Error(`${provider} credentials not configured`);
  return JSON.parse(decrypt(row.credential_data)) as T;
}

/**
 * Same as resolveCredentials but returns null instead of throwing.
 */
export async function resolveCredentialsOrNull<T = Record<string, string>>(
  workspaceId: string,
  provider: ProviderName | string,
): Promise<T | null> {
  try {
    return await resolveCredentials<T>(workspaceId, provider);
  } catch {
    return null;
  }
}

/**
 * Retained for compatibility — identical to resolveCredentials now that all
 * credentials are admin-owned. (Previously did an unconditional global fallback.)
 */
export async function resolveCredentialsWithGlobalFallback<T = Record<string, string>>(
  workspaceId: string,
  provider: ProviderName | string,
): Promise<T> {
  return resolveCredentials<T>(workspaceId, provider);
}

/**
 * Whether the platform admin has credentials configured for a provider.
 * (Formerly "does this workspace have its own creds"; now platform-scoped.)
 */
export async function hasOwnCredentials(
  _workspaceId: string,
  provider: ProviderName | string,
): Promise<boolean> {
  const adminWs = await getAdminWorkspaceId().catch(() => null);
  if (!adminWs) return false;
  const [row] = await db
    .select({ id: providerCredentials.id })
    .from(providerCredentials)
    .where(and(
      eq(providerCredentials.workspace_id, adminWs),
      eq(providerCredentials.provider, provider),
    ));
  return !!row;
}

/**
 * Resolve which workspace holds credentials for a provider — always the admin
 * workspace now. Used by telephony.service for Twilio client routing.
 */
export async function resolveCredentialWorkspaceId(
  _workspaceId: string,
  provider: ProviderName | string,
): Promise<string> {
  const adminWs = await getAdminWorkspaceId();
  const [row] = await db
    .select({ id: providerCredentials.id })
    .from(providerCredentials)
    .where(and(
      eq(providerCredentials.workspace_id, adminWs),
      eq(providerCredentials.provider, provider),
    ));
  if (!row) throw new Error(`${provider} credentials not configured`);
  return adminWs;
}
