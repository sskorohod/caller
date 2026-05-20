-- Standalone reminders (Apple-style). Durable, BullMQ-driven, supports
-- one-off and recurring (daily / weekdays / weekly). Also backs the
-- mission-postpone reminder (kind='mission_plan') so the old in-memory
-- setTimeout — lost on restart — can be retired.

CREATE TABLE IF NOT EXISTS reminders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  chat_id        text NOT NULL,                       -- telegram chat to notify
  kind           text NOT NULL DEFAULT 'generic',     -- generic | mission_plan
  text           text NOT NULL,                       -- reminder text (mission_plan: the plan text)
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { missionId } for mission_plan
  remind_at      timestamptz NOT NULL,                -- next fire time (UTC)
  timezone       text NOT NULL DEFAULT 'America/Los_Angeles',
  recurrence     text,                                -- null | daily | weekdays | weekly
  status         text NOT NULL DEFAULT 'pending',     -- pending | done | cancelled
  fired_count    integer NOT NULL DEFAULT 0,
  last_fired_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Worker scans (status='pending' AND remind_at <= now()).
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(status, remind_at);
-- Dashboard / list queries.
CREATE INDEX IF NOT EXISTS idx_reminders_workspace ON reminders(workspace_id, status, remind_at);
