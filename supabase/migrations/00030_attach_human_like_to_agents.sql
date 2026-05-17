-- Auto-attach the Human-Like Conversation skill to every existing agent.
-- Per workspace, match the agent to that workspace's seeded skill.
-- Idempotent: NOT EXISTS guard prevents double-insert if migration is re-run
-- or if some agents were already attached manually.

INSERT INTO agent_skill_packs (agent_profile_id, skill_pack_id, priority)
SELECT ap.id, sp.id, 0
FROM agent_profiles ap
JOIN skill_packs sp
  ON sp.workspace_id = ap.workspace_id
 AND sp.intent = 'human_like_conversation'
WHERE NOT EXISTS (
  SELECT 1 FROM agent_skill_packs asp
  WHERE asp.agent_profile_id = ap.id
    AND asp.skill_pack_id = sp.id
);
