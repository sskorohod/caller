-- Public contact form messages (no auth required)
CREATE TABLE contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new', -- 'new' | 'read' | 'archived'
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_messages_status ON contact_messages (status, created_at DESC);
CREATE INDEX idx_contact_messages_created ON contact_messages (created_at DESC);
