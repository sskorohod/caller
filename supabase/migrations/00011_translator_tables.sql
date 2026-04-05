-- Translator Subscribers (B2C live translator service)
CREATE TABLE IF NOT EXISTS translator_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  my_language TEXT NOT NULL DEFAULT 'ru',
  target_language TEXT NOT NULL DEFAULT 'en',
  mode TEXT NOT NULL DEFAULT 'voice',
  who_hears TEXT NOT NULL DEFAULT 'subscriber',
  greeting_text TEXT NOT NULL DEFAULT 'Hello, I am your live translator. I will be translating this conversation.',
  tts_provider TEXT NOT NULL DEFAULT 'elevenlabs',
  tts_voice_id TEXT,
  telegram_chat_id TEXT,
  stripe_customer_id TEXT,
  balance_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_translator_subs_workspace ON translator_subscribers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_translator_subs_phone ON translator_subscribers(phone_number);

-- Translator Sessions (call history for translator)
CREATE TABLE IF NOT EXISTS translator_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES translator_subscribers(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  duration_seconds INTEGER DEFAULT 0,
  minutes_used NUMERIC(10,2) DEFAULT 0,
  cost_usd NUMERIC(10,4) DEFAULT 0,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_translator_sess_subscriber ON translator_sessions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_translator_sess_workspace ON translator_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_translator_sess_call ON translator_sessions(call_id);
