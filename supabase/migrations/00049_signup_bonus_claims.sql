-- Anti-fraud: one $2 signup bonus per phone number, forever.
-- bonus_blocked_phones becomes the claims registry: a row is inserted the
-- moment a bonus is granted (reason 'bonus_claimed'), not only on account
-- deletion. bonus_claim_attempts logs repeat attempts for the admin panel.

ALTER TABLE bonus_blocked_phones
  ADD COLUMN IF NOT EXISTS claimed_by_workspace_id UUID
    REFERENCES workspaces(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS bonus_claim_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  source       TEXT NOT NULL, -- 'register' | 'magic_link' | 'phone_update'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bonus_attempts_created   ON bonus_claim_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bonus_attempts_workspace ON bonus_claim_attempts (workspace_id);

-- Backfill: every phone of every workspace that already received a
-- signup_bonus deposit is recorded as having claimed it (earliest wins).
INSERT INTO bonus_blocked_phones (phone_number, reason, claimed_by_workspace_id, created_at)
SELECT DISTINCT ON (phone) phone, 'bonus_claimed', w.id, dt.created_at
FROM workspaces w
JOIN deposit_transactions dt
  ON dt.workspace_id = w.id AND dt.type = 'signup_bonus'
CROSS JOIN LATERAL jsonb_array_elements_text(w.phone_numbers) AS phone
ORDER BY phone, dt.created_at ASC
ON CONFLICT (phone_number) DO NOTHING;
