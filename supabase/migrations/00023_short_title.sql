-- Short title for call recordings list
ALTER TABLE ai_call_sessions ADD COLUMN IF NOT EXISTS short_title text;
