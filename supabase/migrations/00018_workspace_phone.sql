ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS phone_number text;
CREATE INDEX IF NOT EXISTS idx_workspaces_phone ON workspaces(phone_number);

ALTER TABLE magic_links ADD COLUMN IF NOT EXISTS phone_number text;
