-- Mission briefing-expander output: a structured agent briefing (~300-500
-- words of Markdown) generated from the operator's original dictation. Used
-- as the PRIMARY instructions block in the call's system prompt. The original
-- dictation stays nearby verbatim as source of truth.
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS briefing text;
