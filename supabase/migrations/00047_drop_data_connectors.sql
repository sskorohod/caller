-- Translator-only split cleanup: data_connectors was part of the removed
-- AI-agent platform and is never queried by any remaining code. Migration
-- 00044 dropped the other agent tables; this finishes the job.
DROP TABLE IF EXISTS data_connectors CASCADE;
