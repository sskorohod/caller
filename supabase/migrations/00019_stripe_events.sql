-- Stripe webhook idempotency: prevent duplicate event processing
CREATE TABLE IF NOT EXISTS stripe_processed_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-cleanup events older than 30 days (optional, keeps table small)
CREATE INDEX idx_stripe_events_processed_at ON stripe_processed_events (processed_at);
