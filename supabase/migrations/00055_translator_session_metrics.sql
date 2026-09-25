-- Per-call metrics of the consecutive translator: latency end-of-speech → first sound,
-- release reasons, interruptions, echo, cost by part and the event timeline. Written at
-- finalize (and on a mid-call engine swap); NULL for sessions of other engines.
ALTER TABLE translator_sessions ADD COLUMN IF NOT EXISTS metrics jsonb;
