-- Share tokens for public access to live call monitoring
CREATE TABLE IF NOT EXISTS call_share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_share_tokens_token ON call_share_tokens(token);
CREATE INDEX idx_share_tokens_call ON call_share_tokens(call_id);
