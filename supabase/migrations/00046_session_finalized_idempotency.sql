-- Idempotency guard for session finalization.
-- finalizeSession() deducts the workspace balance; without a DB-level claim,
-- a process restart or duplicate event could double-charge. The column lets
-- finalizeSession atomically claim a session exactly once.
ALTER TABLE ai_call_sessions
  ADD COLUMN IF NOT EXISTS is_finalized boolean NOT NULL DEFAULT false;
