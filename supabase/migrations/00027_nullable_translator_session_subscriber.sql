-- Workspace-backed translator sessions are tied to workspaces.phone_numbers and
-- do not always have a translator_subscribers row.
ALTER TABLE translator_sessions ALTER COLUMN subscriber_id DROP NOT NULL;
