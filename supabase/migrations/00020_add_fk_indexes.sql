-- Add indexes on foreign key columns for query performance
-- These columns are used in JOINs, WHERE filters, and CASCADE deletes

CREATE INDEX IF NOT EXISTS idx_calls_agent_profile_id ON calls(agent_profile_id) WHERE agent_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_telephony_connection_id ON calls(telephony_connection_id) WHERE telephony_connection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_call_sessions_agent_profile_id ON ai_call_sessions(agent_profile_id) WHERE agent_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
