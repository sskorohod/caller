-- ============================================================
-- 00013: Billing System — Subscriptions + USD Deposit
-- ============================================================

-- 1. Add billing columns to workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS balance_usd numeric(12, 4) NOT NULL DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'none';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS provider_config jsonb NOT NULL DEFAULT '{}';

-- 2. Drop old plan check constraint, migrate values, add new constraint
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_check;
UPDATE workspaces SET plan = 'translator' WHERE plan = 'free';
UPDATE workspaces SET plan = 'agents' WHERE plan IN ('starter', 'growth');
UPDATE workspaces SET plan = 'agents_mcp' WHERE plan IN ('business', 'enterprise');
ALTER TABLE workspaces ALTER COLUMN plan SET DEFAULT 'translator';
ALTER TABLE workspaces ADD CONSTRAINT workspaces_plan_check CHECK (plan IN ('translator', 'agents', 'agents_mcp'));

-- 3. Create deposit_transactions table (workspace-level, USD-based)
CREATE TABLE IF NOT EXISTS deposit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'topup' | 'usage' | 'refund' | 'promo' | 'signup_bonus' | 'gift'
  amount_usd numeric(12, 4) NOT NULL, -- positive = credit, negative = debit
  balance_after numeric(12, 4) NOT NULL,
  description text,
  reference_type text, -- 'stripe_checkout' | 'call_session' | 'translator_session' | 'admin' | 'system' | 'subscription'
  reference_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deposit_tx_workspace ON deposit_transactions(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_deposit_tx_type ON deposit_transactions(type);

-- 4. Add billing settings to platform_settings
INSERT INTO platform_settings (key, value)
VALUES
  ('billing_markup', '"3.0"'::jsonb),
  ('billing_low_balance_threshold', '"5.00"'::jsonb),
  ('billing_signup_bonus_usd', '"2.00"'::jsonb),
  ('billing_agents_monthly_price', '"49.00"'::jsonb),
  ('billing_agents_mcp_monthly_price', '"99.00"'::jsonb)
ON CONFLICT (key) DO NOTHING;
