-- Junction tables only had a UNIQUE(agent_profile_id, *) index, leaving the
-- foreign-key column on the other side unindexed. That makes "which agents use
-- this pack/KB" lookups and cascade deletes do full scans.
CREATE INDEX IF NOT EXISTS idx_agent_skill_packs_skill_pack ON agent_skill_packs(skill_pack_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_bases_kb ON agent_knowledge_bases(knowledge_base_id);
