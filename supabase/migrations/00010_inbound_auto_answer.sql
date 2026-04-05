-- Auto-answer delay for inbound calls (seconds before AI agent picks up)
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS inbound_auto_answer_delay_seconds INTEGER NOT NULL DEFAULT 30;
