ALTER TABLE translator_subscribers ADD COLUMN IF NOT EXISTS tone text NOT NULL DEFAULT 'neutral';
