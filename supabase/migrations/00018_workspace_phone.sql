-- Drop single phone_number if exists, replace with jsonb array
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS phone_numbers jsonb NOT NULL DEFAULT '[]';
-- Migrate existing phone_number to phone_numbers array
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'phone_number') THEN
    UPDATE workspaces SET phone_numbers = jsonb_build_array(phone_number) WHERE phone_number IS NOT NULL AND phone_number != '';
    ALTER TABLE workspaces DROP COLUMN phone_number;
  END IF;
END $$;

ALTER TABLE magic_links ADD COLUMN IF NOT EXISTS phone_number text;
