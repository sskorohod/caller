-- Translator-only split: remove all business-AI-agent tables and columns.
-- caller_profiles / caller_memory_facts are intentionally KEPT (call context).

-- 1. Drop agent FK columns from kept tables (also drops their FK constraints).
ALTER TABLE calls                 DROP COLUMN IF EXISTS agent_profile_id;
ALTER TABLE ai_call_sessions      DROP COLUMN IF EXISTS agent_profile_id;
ALTER TABLE telephony_connections DROP COLUMN IF EXISTS default_agent_profile_id;

-- 2. Drop agent-only tables (CASCADE clears any remaining dependent objects).
DROP TABLE IF EXISTS mission_messages     CASCADE;
DROP TABLE IF EXISTS missions             CASCADE;
DROP TABLE IF EXISTS agent_skill_packs    CASCADE;
DROP TABLE IF EXISTS agent_prompt_packs   CASCADE;
DROP TABLE IF EXISTS agent_knowledge_bases CASCADE;
DROP TABLE IF EXISTS skill_packs          CASCADE;
DROP TABLE IF EXISTS prompt_packs         CASCADE;
DROP TABLE IF EXISTS knowledge_embeddings CASCADE;
DROP TABLE IF EXISTS knowledge_documents  CASCADE;
DROP TABLE IF EXISTS knowledge_bases      CASCADE;
DROP TABLE IF EXISTS agent_profiles       CASCADE;
