-- Add owner_name to workspaces for mission planner
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_name text;
