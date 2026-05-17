-- Free-form voice direction / vibe attached to an agent. Goes into the system
-- prompt as a 'Voice direction' block so the LLM (and Grok realtime) shape
-- prosody/personality on top of the chosen voice and tone preset.
ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS voice_vibe text;
