-- Distinguish click points from mouse-movement (attention) points so the admin
-- heatmap can render click zones, attention zones, and scroll-reach separately.
ALTER TABLE analytics_heatmap_points
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'click'; -- 'click' | 'move'

-- Query path for the heatmap viewer is (path, viewport, kind, time).
CREATE INDEX IF NOT EXISTS idx_analytics_heatmap_path_vp_kind_created
  ON analytics_heatmap_points (path, viewport, kind, created_at);
