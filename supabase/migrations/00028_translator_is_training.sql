-- Sandbox (AI-trainer) mode: free training sessions that must NOT deduct balance.
-- Flag distinguishes them from paid translator sessions.
ALTER TABLE translator_sessions
  ADD COLUMN IF NOT EXISTS is_training boolean NOT NULL DEFAULT false;
