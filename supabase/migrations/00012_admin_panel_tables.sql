-- Add blocked fields to translator_subscribers
ALTER TABLE translator_subscribers ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE translator_subscribers ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- Promo codes
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  minutes NUMERIC(10,2) NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 100,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, code)
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES translator_subscribers(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Balance transactions (audit trail)
CREATE TABLE IF NOT EXISTS balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES translator_subscribers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  minutes NUMERIC(10,2) NOT NULL,
  comment TEXT,
  admin_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_balance_tx_subscriber ON balance_transactions(subscriber_id);

-- Platform settings (key-value)
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO platform_settings (key, value) VALUES
  ('pricing_per_minute', '"0.15"'),
  ('bundles', '[{"name":"Starter","minutes":30,"price":4.50},{"name":"Pro","minutes":60,"price":7.50},{"name":"Executive","minutes":120,"price":12.00}]'),
  ('default_greeting', '"Hello, I am your live translator. I will translate this conversation."'),
  ('default_tts_provider', '"elevenlabs"'),
  ('default_languages', '{"my":"ru","target":"en"}')
ON CONFLICT (key) DO NOTHING;

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at);
