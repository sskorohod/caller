-- ============================================================
-- 00014: Magic Link Authentication
-- ============================================================

CREATE TABLE IF NOT EXISTS magic_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email);

-- Auto-cleanup expired tokens (older than 24h)
CREATE INDEX IF NOT EXISTS idx_magic_links_expires ON magic_links(expires_at);
