-- Daily evening Telegram check-in feature.
-- A bot survey fired at a workspace-local hour (default 22:00) with 4
-- sequential questions: energy level, lunch, dinner, most important thing.
-- The daily_check_ins row IS the conversation state — current_question
-- tracks which answer is pending, so a backend restart never loses progress.

CREATE TABLE IF NOT EXISTS daily_check_ins (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  chat_id           text NOT NULL,
  checkin_date      date NOT NULL,
  status            text NOT NULL DEFAULT 'in_progress', -- in_progress | completed
  current_question  integer NOT NULL DEFAULT 1,          -- 1..4
  energy_level      text,                                -- great|good|ok|low|drained
  lunch             text,
  dinner            text,
  highlight         text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, chat_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_check_ins_workspace_date
  ON daily_check_ins(workspace_id, checkin_date DESC);

-- Per-workspace opt-in + configurable hour for the check-in.
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS daily_checkin_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_checkin_hour integer NOT NULL DEFAULT 22;

-- Enable the feature for Slava's workspace (the requester).
UPDATE workspaces SET daily_checkin_enabled = true WHERE name = 'Slava';
