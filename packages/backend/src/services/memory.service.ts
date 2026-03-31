import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../config/db.js';
import { callerProfiles, callerMemoryFacts } from '../db/schema.js';
import type { CallerProfile, CallerMemoryFact } from '../models/types.js';

// ============================================================
// Caller Profile Management
// ============================================================

export async function findOrCreateCallerProfile(
  workspaceId: string,
  phoneNumber: string,
): Promise<CallerProfile> {
  const normalized = phoneNumber.replace(/[^\d+]/g, '');

  // Try to find existing
  const [existing] = await db
    .select()
    .from(callerProfiles)
    .where(
      and(
        eq(callerProfiles.workspace_id, workspaceId),
        eq(callerProfiles.phone_number, normalized),
      ),
    );

  if (existing) return existing as unknown as CallerProfile;

  // Create new
  const [created] = await db
    .insert(callerProfiles)
    .values({
      workspace_id: workspaceId,
      phone_number: normalized,
    })
    .returning();

  if (!created) throw new Error('Failed to create caller profile');
  return created as unknown as CallerProfile;
}

export async function updateCallerProfile(
  profileId: string,
  updates: Partial<Pick<CallerProfile, 'name' | 'email' | 'company' | 'relationship' | 'metadata'>>,
): Promise<CallerProfile> {
  const [updated] = await db
    .update(callerProfiles)
    .set(updates)
    .where(eq(callerProfiles.id, profileId))
    .returning();

  if (!updated) throw new Error('Failed to update caller profile');
  return updated as unknown as CallerProfile;
}

export async function incrementCallCount(profileId: string): Promise<void> {
  await db
    .update(callerProfiles)
    .set({
      total_calls: sql`total_calls + 1`,
      last_call_at: new Date(),
    })
    .where(eq(callerProfiles.id, profileId));
}

// ============================================================
// Memory Facts
// ============================================================

export async function addMemoryFact(params: {
  callerProfileId: string;
  workspaceId: string;
  factType: string;
  content: string;
  sourceCallId?: string;
}): Promise<CallerMemoryFact> {
  const [created] = await db
    .insert(callerMemoryFacts)
    .values({
      caller_profile_id: params.callerProfileId,
      workspace_id: params.workspaceId,
      fact_type: params.factType,
      content: params.content,
      source_call_id: params.sourceCallId ?? null,
    })
    .returning();

  if (!created) throw new Error('Failed to add memory fact');
  return created as unknown as CallerMemoryFact;
}

export async function getUnresolvedFacts(
  callerProfileId: string,
  limit = 10,
): Promise<CallerMemoryFact[]> {
  const rows = await db
    .select()
    .from(callerMemoryFacts)
    .where(
      and(
        eq(callerMemoryFacts.caller_profile_id, callerProfileId),
        eq(callerMemoryFacts.is_resolved, false),
      ),
    )
    .orderBy(desc(callerMemoryFacts.created_at))
    .limit(limit);

  return rows as unknown as CallerMemoryFact[];
}

export async function resolveFact(factId: string, workspaceId: string): Promise<void> {
  await db
    .update(callerMemoryFacts)
    .set({ is_resolved: true, resolved_at: new Date() })
    .where(
      and(
        eq(callerMemoryFacts.id, factId),
        eq(callerMemoryFacts.workspace_id, workspaceId),
      ),
    );
}

// ============================================================
// Post-call Memory Extraction
// ============================================================

export async function extractAndSaveMemory(params: {
  workspaceId: string;
  callId: string;
  callerProfileId: string;
  transcript: Array<{ speaker: string; text: string }>;
  summary: string;
}): Promise<void> {
  // Save summary as a fact
  await addMemoryFact({
    callerProfileId: params.callerProfileId,
    workspaceId: params.workspaceId,
    factType: 'general',
    content: `Call summary: ${params.summary}`,
    sourceCallId: params.callId,
  });

  // Increment call count
  await incrementCallCount(params.callerProfileId);
}

// ============================================================
// Context Loading for Call Start
// ============================================================

export async function loadCallerContext(
  workspaceId: string,
  phoneNumber: string,
): Promise<{ profile: CallerProfile | null; facts: CallerMemoryFact[]; contextString: string }> {
  const normalized = phoneNumber.replace(/[^\d+]/g, '');

  const [profile] = await db
    .select()
    .from(callerProfiles)
    .where(
      and(
        eq(callerProfiles.workspace_id, workspaceId),
        eq(callerProfiles.phone_number, normalized),
      ),
    );

  if (!profile) {
    return { profile: null, facts: [], contextString: 'New caller, no prior history.' };
  }

  const typedProfile = profile as unknown as CallerProfile;
  const facts = await getUnresolvedFacts(typedProfile.id, 10);

  const parts: string[] = [];
  if (typedProfile.name) parts.push(`Caller: ${typedProfile.name}`);
  if (typedProfile.relationship) parts.push(`Relationship: ${typedProfile.relationship}`);
  parts.push(`Previous calls: ${typedProfile.total_calls}`);

  if (facts.length > 0) {
    parts.push('Unresolved context:');
    for (const f of facts) {
      parts.push(`- [${f.fact_type}] ${f.content}`);
    }
  }

  return { profile: typedProfile, facts, contextString: parts.join('\n') };
}
