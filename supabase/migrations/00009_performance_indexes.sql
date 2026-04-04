-- Performance indexes identified during project audit

-- Vector similarity search: HNSW index on knowledge_embeddings
-- Without this, every semantic search does a full table scan
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_hnsw
  ON knowledge_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Calls listing: compound index for the most common query pattern
-- (workspace_id + status filter + created_at DESC sort)
CREATE INDEX IF NOT EXISTS idx_calls_workspace_status_created
  ON calls (workspace_id, status, created_at DESC);

-- Missions: index on call_id for cascade deletes and post-call worker lookups
CREATE INDEX IF NOT EXISTS idx_missions_call_id
  ON missions (call_id);

-- Call events: explicit index on call_id for cascade deletes
CREATE INDEX IF NOT EXISTS idx_call_events_call_id
  ON call_events (call_id);
