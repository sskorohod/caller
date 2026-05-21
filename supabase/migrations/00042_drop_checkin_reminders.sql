-- Revert the personal-productivity features (daily check-in + standalone
-- reminders) — they were out of scope for an AI phone-agent platform.
-- Migrations 00040 and 00041 already ran in production, so the schema
-- objects must be dropped explicitly here. The mission-postpone reminder
-- returns to its previous in-memory implementation (see telegram.ts).

DROP TABLE IF EXISTS daily_check_ins;
DROP TABLE IF EXISTS reminders;

ALTER TABLE workspaces
  DROP COLUMN IF EXISTS daily_checkin_enabled,
  DROP COLUMN IF EXISTS daily_checkin_hour;
