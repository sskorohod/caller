import { eq, and, ne, sql } from 'drizzle-orm';
import { db } from '../config/db.js';
import { workspaces, workspaceMembers } from '../db/schema.js';
import { NotFoundError, ConflictError } from '../lib/errors.js';
import type { Workspace, WorkspaceMember, MemberRole } from '../models/types.js';

// Admin workspace is exempt from phone number uniqueness checks
const ADMIN_WORKSPACE_ID = 'e077c696-e5c6-4d83-bb46-3729b6e650aa';

/**
 * Check that none of the given phone numbers are already used by another workspace.
 * The admin workspace is exempt — its numbers are never considered conflicting.
 */
export async function validatePhoneNumbersUnique(phoneNumbers: string[], currentWorkspaceId: string): Promise<void> {
  if (currentWorkspaceId === ADMIN_WORKSPACE_ID) return; // admin can use any numbers

  for (const phone of phoneNumbers) {
    const [conflict] = await db.select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(and(
        sql`${workspaces.phone_numbers} @> ${JSON.stringify([phone])}::jsonb`,
        ne(workspaces.id, currentWorkspaceId),
        ne(workspaces.id, ADMIN_WORKSPACE_ID), // ignore admin workspace
      ))
      .limit(1);

    if (conflict) {
      throw new ConflictError(`Phone number ${phone} is already registered to another account`);
    }
  }
}

export async function createWorkspace(params: {
  name: string;
  slug: string;
  industry?: string;
  timezone?: string;
  languages?: string[];
  userId: string;
}): Promise<Workspace> {
  const [existing] = await db.select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, params.slug));

  if (existing) throw new ConflictError(`Workspace slug '${params.slug}' already exists`);

  const [row] = await db.insert(workspaces).values({
    name: params.name,
    slug: params.slug,
    industry: params.industry ?? null,
    timezone: params.timezone ?? 'America/New_York',
    languages: params.languages ?? ['en'],
  }).returning();

  await db.insert(workspaceMembers).values({
    workspace_id: row.id,
    user_id: params.userId,
    role: 'owner',
  });

  return row as unknown as Workspace;
}

export async function getWorkspace(workspaceId: string): Promise<Workspace> {
  const [row] = await db.select().from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  if (!row) throw new NotFoundError('Workspace', workspaceId);
  return row as unknown as Workspace;
}

export async function updateWorkspace(
  workspaceId: string,
  updates: Partial<Pick<Workspace,
    'name' | 'industry' | 'timezone' | 'languages' |
    'conversation_owner_default' | 'allow_inbound_external_handoff' |
    'external_inbound_webhook_url' | 'external_ready_timeout_ms' |
    'inbound_fallback_mode' | 'recording_retention_days' |
    'transcript_retention_days' | 'call_recording_disclosure' | 'ai_disclosure'
  >> & { phone_numbers?: string[] },
): Promise<Workspace> {
  // Validate phone number uniqueness before saving
  if (updates.phone_numbers?.length) {
    await validatePhoneNumbersUnique(updates.phone_numbers, workspaceId);
  }

  const [row] = await db.update(workspaces)
    .set(updates as any)
    .where(eq(workspaces.id, workspaceId))
    .returning();

  if (!row) throw new NotFoundError('Workspace', workspaceId);
  return row as unknown as Workspace;
}

export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const rows = await db.select().from(workspaceMembers)
    .where(eq(workspaceMembers.workspace_id, workspaceId));

  return rows as unknown as WorkspaceMember[];
}

export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: MemberRole,
): Promise<WorkspaceMember> {
  try {
    const [row] = await db.insert(workspaceMembers)
      .values({ workspace_id: workspaceId, user_id: userId, role })
      .returning();
    return row as unknown as WorkspaceMember;
  } catch (err: any) {
    if (err.code === '23505') throw new ConflictError('User is already a member of this workspace');
    throw err;
  }
}

export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  role: MemberRole,
): Promise<WorkspaceMember> {
  const [row] = await db.update(workspaceMembers)
    .set({ role })
    .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspace_id, workspaceId)))
    .returning();

  if (!row) throw new NotFoundError('Member', memberId);
  return row as unknown as WorkspaceMember;
}

export async function removeMember(workspaceId: string, memberId: string): Promise<void> {
  await db.delete(workspaceMembers)
    .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspace_id, workspaceId)));
}
