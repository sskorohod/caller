ALTER TABLE translator_subscribers ADD COLUMN IF NOT EXISTS personal_context text NOT NULL DEFAULT '';
