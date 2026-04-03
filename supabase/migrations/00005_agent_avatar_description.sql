-- Add avatar and description fields to agent profiles
ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS description text;
