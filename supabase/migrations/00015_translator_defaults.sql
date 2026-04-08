-- Workspace-level translator defaults
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS translator_defaults jsonb NOT NULL DEFAULT '{}';

-- Translation mode field for subscribers (bidirectional / unidirectional)
ALTER TABLE translator_subscribers ADD COLUMN IF NOT EXISTS translation_mode text NOT NULL DEFAULT 'bidirectional';

-- Subscriber portal tokens for magic link auth
CREATE TABLE IF NOT EXISTS subscriber_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES translator_subscribers(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON subscriber_portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_subscriber ON subscriber_portal_tokens(subscriber_id);
