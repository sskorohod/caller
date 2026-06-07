-- Phones that already consumed their welcome bonus (e.g. via account deletion).
-- Retained even after the workspace is deleted so the same phone can't re-claim
-- the signup bonus on re-registration.
CREATE TABLE IF NOT EXISTS bonus_blocked_phones (
  phone_number TEXT PRIMARY KEY,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
