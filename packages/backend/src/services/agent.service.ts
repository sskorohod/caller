import { eq, and, desc, asc } from 'drizzle-orm';
import { db } from '../config/db.js';
import {
  agentProfiles,
  promptPacks,
  skillPacks,
  agentPromptPacks,
  agentSkillPacks,
} from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
import type { AgentProfile, PromptPack, SkillPack } from '../models/types.js';

// ============================================================
// Agent Profiles
// ============================================================

export async function createAgentProfile(
  workspaceId: string,
  params: Omit<AgentProfile, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>,
): Promise<AgentProfile> {
  const { llm_temperature, ...rest } = params;
  const [created] = await db
    .insert(agentProfiles)
    .values({
      ...rest,
      workspace_id: workspaceId,
      llm_temperature: String(llm_temperature ?? 0.7),
    })
    .returning();

  if (!created) throw new Error('Failed to create agent profile');
  return created as unknown as AgentProfile;
}

export async function getAgentProfile(workspaceId: string, profileId: string): Promise<AgentProfile> {
  const [row] = await db
    .select()
    .from(agentProfiles)
    .where(
      and(
        eq(agentProfiles.id, profileId),
        eq(agentProfiles.workspace_id, workspaceId),
      ),
    );

  if (!row) throw new NotFoundError('Agent Profile', profileId);
  return row as unknown as AgentProfile;
}

export async function listAgentProfiles(workspaceId: string): Promise<AgentProfile[]> {
  const rows = await db
    .select()
    .from(agentProfiles)
    .where(eq(agentProfiles.workspace_id, workspaceId))
    .orderBy(desc(agentProfiles.created_at));

  return rows as unknown as AgentProfile[];
}

export async function updateAgentProfile(
  workspaceId: string,
  profileId: string,
  updates: Partial<AgentProfile>,
): Promise<AgentProfile> {
  const { id, workspace_id, created_at, updated_at, ...safeUpdates } = updates as any;

  const [updated] = await db
    .update(agentProfiles)
    .set(safeUpdates)
    .where(
      and(
        eq(agentProfiles.id, profileId),
        eq(agentProfiles.workspace_id, workspaceId),
      ),
    )
    .returning();

  if (!updated) throw new NotFoundError('Agent Profile', profileId);
  return updated as unknown as AgentProfile;
}

export async function deleteAgentProfile(workspaceId: string, profileId: string): Promise<void> {
  const result = await db
    .delete(agentProfiles)
    .where(
      and(
        eq(agentProfiles.id, profileId),
        eq(agentProfiles.workspace_id, workspaceId),
      ),
    );
}

// Get default agent profile for workspace
export async function getDefaultAgentProfile(workspaceId: string): Promise<AgentProfile | null> {
  const [row] = await db
    .select()
    .from(agentProfiles)
    .where(
      and(
        eq(agentProfiles.workspace_id, workspaceId),
        eq(agentProfiles.is_default, true),
        eq(agentProfiles.is_active, true),
      ),
    );

  return row ? (row as unknown as AgentProfile) : null;
}

// ============================================================
// Prompt Packs
// ============================================================

export async function createPromptPack(
  workspaceId: string,
  params: { name: string; description?: string; content: string; category?: string },
): Promise<PromptPack> {
  const [created] = await db
    .insert(promptPacks)
    .values({ ...params, workspace_id: workspaceId })
    .returning();

  if (!created) throw new Error('Failed to create prompt pack');
  return created as unknown as PromptPack;
}

export async function listPromptPacks(workspaceId: string): Promise<PromptPack[]> {
  const rows = await db
    .select()
    .from(promptPacks)
    .where(eq(promptPacks.workspace_id, workspaceId))
    .orderBy(desc(promptPacks.created_at));

  return rows as unknown as PromptPack[];
}

export async function getPromptPack(workspaceId: string, packId: string): Promise<PromptPack> {
  const [row] = await db
    .select()
    .from(promptPacks)
    .where(
      and(
        eq(promptPacks.id, packId),
        eq(promptPacks.workspace_id, workspaceId),
      ),
    );

  if (!row) throw new NotFoundError('Prompt Pack', packId);
  return row as unknown as PromptPack;
}

export async function updatePromptPack(
  workspaceId: string,
  packId: string,
  updates: { name?: string; description?: string; content?: string; category?: string },
): Promise<PromptPack> {
  const [updated] = await db
    .update(promptPacks)
    .set(updates)
    .where(
      and(
        eq(promptPacks.id, packId),
        eq(promptPacks.workspace_id, workspaceId),
      ),
    )
    .returning();

  if (!updated) throw new NotFoundError('Prompt Pack', packId);
  return updated as unknown as PromptPack;
}

export async function deletePromptPack(workspaceId: string, packId: string): Promise<void> {
  await db
    .delete(promptPacks)
    .where(
      and(
        eq(promptPacks.id, packId),
        eq(promptPacks.workspace_id, workspaceId),
      ),
    );
}

// ============================================================
// Skill Packs
// ============================================================

export async function createSkillPack(
  workspaceId: string,
  params: {
    name: string;
    description?: string;
    intent: string;
    activation_rules?: Record<string, unknown>;
    required_data?: unknown[];
    tool_sequence?: unknown[];
    allowed_tools?: string[];
    escalation_conditions?: unknown[];
    completion_criteria?: Record<string, unknown>;
    conversation_rules?: string;
  },
): Promise<SkillPack> {
  const [created] = await db
    .insert(skillPacks)
    .values({ ...params, workspace_id: workspaceId })
    .returning();

  if (!created) throw new Error('Failed to create skill pack');
  return created as unknown as SkillPack;
}

export async function listSkillPacks(workspaceId: string): Promise<SkillPack[]> {
  const rows = await db
    .select()
    .from(skillPacks)
    .where(eq(skillPacks.workspace_id, workspaceId))
    .orderBy(desc(skillPacks.created_at));

  return rows as unknown as SkillPack[];
}

export async function getSkillPack(workspaceId: string, packId: string): Promise<SkillPack> {
  const [row] = await db
    .select()
    .from(skillPacks)
    .where(
      and(
        eq(skillPacks.id, packId),
        eq(skillPacks.workspace_id, workspaceId),
      ),
    );

  if (!row) throw new NotFoundError('Skill Pack', packId);
  return row as unknown as SkillPack;
}

export async function updateSkillPack(
  workspaceId: string,
  packId: string,
  updates: Partial<{
    name: string;
    description: string;
    intent: string;
    activation_rules: Record<string, unknown>;
    required_data: unknown[];
    tool_sequence: unknown[];
    allowed_tools: string[];
    escalation_conditions: unknown[];
    completion_criteria: Record<string, unknown>;
    conversation_rules: string;
  }>,
): Promise<SkillPack> {
  const [updated] = await db
    .update(skillPacks)
    .set(updates)
    .where(
      and(
        eq(skillPacks.id, packId),
        eq(skillPacks.workspace_id, workspaceId),
      ),
    )
    .returning();

  if (!updated) throw new NotFoundError('Skill Pack', packId);
  return updated as unknown as SkillPack;
}

export async function deleteSkillPack(workspaceId: string, packId: string): Promise<void> {
  await db
    .delete(skillPacks)
    .where(
      and(
        eq(skillPacks.id, packId),
        eq(skillPacks.workspace_id, workspaceId),
      ),
    );
}

// ============================================================
// Agent-Pack Associations
// ============================================================

export async function attachPromptPack(agentProfileId: string, promptPackId: string, priority = 0): Promise<void> {
  await db
    .insert(agentPromptPacks)
    .values({
      agent_profile_id: agentProfileId,
      prompt_pack_id: promptPackId,
      priority,
    })
    .onConflictDoUpdate({
      target: [agentPromptPacks.agent_profile_id, agentPromptPacks.prompt_pack_id],
      set: { priority },
    });
}

export async function attachSkillPack(agentProfileId: string, skillPackId: string, priority = 0): Promise<void> {
  await db
    .insert(agentSkillPacks)
    .values({
      agent_profile_id: agentProfileId,
      skill_pack_id: skillPackId,
      priority,
    })
    .onConflictDoUpdate({
      target: [agentSkillPacks.agent_profile_id, agentSkillPacks.skill_pack_id],
      set: { priority },
    });
}

export async function getAgentPromptPacks(agentProfileId: string): Promise<PromptPack[]> {
  const rows = await db
    .select({
      id: promptPacks.id,
      workspace_id: promptPacks.workspace_id,
      name: promptPacks.name,
      description: promptPacks.description,
      content: promptPacks.content,
      category: promptPacks.category,
      version: promptPacks.version,
      is_active: promptPacks.is_active,
      created_at: promptPacks.created_at,
      updated_at: promptPacks.updated_at,
    })
    .from(agentPromptPacks)
    .innerJoin(promptPacks, eq(agentPromptPacks.prompt_pack_id, promptPacks.id))
    .where(eq(agentPromptPacks.agent_profile_id, agentProfileId))
    .orderBy(asc(agentPromptPacks.priority));

  return rows as unknown as PromptPack[];
}

export async function getAgentSkillPacks(agentProfileId: string): Promise<SkillPack[]> {
  const rows = await db
    .select({
      id: skillPacks.id,
      workspace_id: skillPacks.workspace_id,
      name: skillPacks.name,
      description: skillPacks.description,
      intent: skillPacks.intent,
      activation_rules: skillPacks.activation_rules,
      required_data: skillPacks.required_data,
      tool_sequence: skillPacks.tool_sequence,
      allowed_tools: skillPacks.allowed_tools,
      escalation_conditions: skillPacks.escalation_conditions,
      completion_criteria: skillPacks.completion_criteria,
      interruption_rules: skillPacks.interruption_rules,
      conversation_rules: skillPacks.conversation_rules,
      version: skillPacks.version,
      is_active: skillPacks.is_active,
      created_at: skillPacks.created_at,
      updated_at: skillPacks.updated_at,
    })
    .from(agentSkillPacks)
    .innerJoin(skillPacks, eq(agentSkillPacks.skill_pack_id, skillPacks.id))
    .where(eq(agentSkillPacks.agent_profile_id, agentProfileId))
    .orderBy(asc(agentSkillPacks.priority));

  return rows as unknown as SkillPack[];
}
