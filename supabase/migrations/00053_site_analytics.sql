-- In-house site/landing analytics (public, first-party, anonymous).
-- analytics_events: one row per tracked event (pageview/engage/click/scroll/signup).
-- analytics_heatmap_points: high-volume click coordinates for heatmap rendering.

CREATE TABLE IF NOT EXISTS analytics_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id       TEXT NOT NULL,
  session_id       TEXT NOT NULL,
  type             TEXT NOT NULL,
  path             TEXT NOT NULL,
  referrer         TEXT,
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,
  device           TEXT,
  viewport         TEXT,
  lang             TEXT,
  active_ms        INTEGER,
  scroll_pct       INTEGER,
  element_label    TEXT,
  element_selector TEXT,
  ip_hash          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created       ON analytics_events (created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created  ON analytics_events (type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_path_created  ON analytics_events (path, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session       ON analytics_events (session_id);

CREATE TABLE IF NOT EXISTS analytics_heatmap_points (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path       TEXT NOT NULL,
  viewport   TEXT NOT NULL,
  x_pct      INTEGER NOT NULL,
  y_px       INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_heatmap_path_vp_created ON analytics_heatmap_points (path, viewport, created_at);
