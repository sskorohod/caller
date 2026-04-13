-- Change default TTS provider from elevenlabs to xai
ALTER TABLE agent_profiles ALTER COLUMN voice_provider SET DEFAULT 'xai';
ALTER TABLE translator_subscribers ALTER COLUMN tts_provider SET DEFAULT 'xai';
