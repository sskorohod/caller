/**
 * Centralized credential resolution with workspace fallback logic.
 *
 * Replaces duplicated credential fetching in:
 *   - stt.service.ts
 *   - tts.service.ts
 *   - llm.service.ts
 *   - telephony.service.ts
 *   - conference-translator.ts
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../config/db.js';
import { providerCredentials, workspaceMembers } from '../db/schema.js';
import { decrypt } from '../lib/crypto.js';
import type { ProviderName } from '../models/types.js';

/**
 * Resolve credentials for a given provider in a workspace.
 *
 * Resolution order:
 * 1. Workspace's own credentials (providerCredentials where workspace_id matches)
 * 2. If workspace is on translator plan → fallback to platform owner's credentials
 * 3. Throw if nothing found
 *
 * @param workspaceId - The workspace requesting credentials
 * @param provider    - Provider name (twilio, xai, deepgram, etc.)
 * @returns Decrypted credential data as a parsed object
 */
export async function resolveCredentials<T = Record<string, string>>(
  workspaceId: string,
  provider: ProviderName | string,
): Promise<T> {
  // 1. Try own workspace credentials
  const [own] = await db
    .select({ credential_data: providerCredentials.credential_data })
    .from(providerCredentials)
    .where(and(
      eq(providerCredentials.workspace_id, workspaceId),
      eq(providerCredentials.provider, provider),
    ));

  if (own) {
    return JSON.parse(decrypt(own.credential_data)) as T;
  }

  // 2. Fallback: platform owner credentials (translator plan only)
  if (await allowsPlatformFallback(workspaceId)) {
    const [ownerRow] = await db
      .select({ credential_data: providerCredentials.credential_data })
      .from(providerCredentials)
      .innerJoin(workspaceMembers, and(
        eq(workspaceMembers.workspace_id, providerCredentials.workspace_id),
        eq(workspaceMembers.role, 'owner'),
      ))
      .where(eq(providerCredentials.provider, provider))
      .limit(1);

    if (ownerRow) {
      return JSON.parse(decrypt(ownerRow.credential_data)) as T;
    }
  }

  throw new Error(`${provider} credentials not configured`);
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
 * Resolve credentials with unconditional platform fallback.
 * Used for translator-specific features (xAI for conference translator)
 * that should work on ALL plans regardless.
 */
export async function resolveCredentialsWithGlobalFallback<T = Record<string, string>>(
  workspaceId: string,
  provider: ProviderName | string,
): Promise<T> {
  // 1. Try own workspace credentials
  const [own] = await db
    .select({ credential_data: providerCredentials.credential_data })
    .from(providerCredentials)
    .where(and(
      eq(providerCredentials.workspace_id, workspaceId),
      eq(providerCredentials.provider, provider),
    ));

  if (own) {
    return JSON.parse(decrypt(own.credential_data)) as T;
  }

  // 2. Fallback: any available credentials (no plan check)
  const [fallback] = await db
    .select({ credential_data: providerCredentials.credential_data })
    .from(providerCredentials)
    .where(eq(providerCredentials.provider, provider))
    .limit(1);

  if (fallback) {
    return JSON.parse(decrypt(fallback.credential_data)) as T;
  }

  throw new Error(`${provider} credentials not configured`);
}

/**
 * Check if workspace has its own credentials for a given provider.
 * Used by requireDialerAccess middleware and similar checks.
 */
export async function hasOwnCredentials(
  workspaceId: string,
  provider: ProviderName | string,
): Promise<boolean> {
  const [own] = await db
    .select({ id: providerCredentials.id })
    .from(providerCredentials)
    .where(and(
      eq(providerCredentials.workspace_id, workspaceId),
      eq(providerCredentials.provider, provider),
    ));
  return !!own;
}

/**
 * Resolve which workspace holds credentials for a given provider.
 * Returns the workspace's own ID if it has credentials, or the
 * platform owner's workspace ID if fallback is allowed.
 *
 * Used by telephony.service for Twilio workspace resolution.
 */
export async function resolveCredentialWorkspaceId(
  workspaceId: string,
  provider: ProviderName | string,
): Promise<string> {
  // Check own
  const [own] = await db
    .select({ id: providerCredentials.id })
    .from(providerCredentials)
    .where(and(
      eq(providerCredentials.workspace_id, workspaceId),
      eq(providerCredentials.provider, provider),
    ));
  if (own) return workspaceId;

  // Fallback
  if (await allowsPlatformFallback(workspaceId)) {
    const [ownerRow] = await db
      .select({ workspace_id: providerCredentials.workspace_id })
      .from(providerCredentials)
      .innerJoin(workspaceMembers, and(
        eq(workspaceMembers.workspace_id, providerCredentials.workspace_id),
        eq(workspaceMembers.role, 'owner'),
      ))
      .where(eq(providerCredentials.provider, provider))
      .limit(1);
    if (ownerRow) return ownerRow.workspace_id;
  }

  throw new Error(`${provider} credentials not configured`);
}

// --- Internal ---

import { workspaces } from '../db/schema.js';

async function allowsPlatformFallback(workspaceId: string): Promise<boolean> {
  const [ws] = await db.select({ plan: workspaces.plan })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  return ws?.plan === 'translator';
}
