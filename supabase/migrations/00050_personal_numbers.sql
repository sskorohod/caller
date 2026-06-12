-- Personal Twilio numbers: a workspace can rent one US number, billed
-- monthly from balance_usd (no Stripe). Released rows are kept for history;
-- inbound routing filters on status = 'active'.

ALTER TABLE telephony_connections
  ADD COLUMN IF NOT EXISTS is_personal       BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_price_usd NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS purchased_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_renewal_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_renew        BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status            TEXT        NOT NULL DEFAULT 'active', -- 'active' | 'released'
  ADD COLUMN IF NOT EXISTS released_at       TIMESTAMPTZ;

-- Max 1 ACTIVE personal number per workspace (DB-level race guard for purchase)
CREATE UNIQUE INDEX IF NOT EXISTS uq_telephony_personal_active
  ON telephony_connections (workspace_id)
  WHERE is_personal = true AND status = 'active';

-- Renewal sweep scan
CREATE INDEX IF NOT EXISTS idx_telephony_personal_renewal
  ON telephony_connections (next_renewal_at)
  WHERE is_personal = true AND status = 'active';
