-- Update default timezone to America/Los_Angeles
ALTER TABLE workspaces ALTER COLUMN timezone SET DEFAULT 'America/Los_Angeles';
UPDATE workspaces SET timezone = 'America/Los_Angeles' WHERE timezone = 'America/New_York';
