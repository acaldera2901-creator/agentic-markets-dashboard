-- Tennis Live V4: feature snapshots + live odds enrichment.
-- Nullable/idempotent so existing rows remain valid.

ALTER TABLE tennis_fixtures
  ADD COLUMN IF NOT EXISTS odds_p1 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS odds_p2 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS odds_provider TEXT,
  ADD COLUMN IF NOT EXISTS odds_bookmaker TEXT,
  ADD COLUMN IF NOT EXISTS odds_event_id TEXT;

ALTER TABLE tennis_predictions
  ADD COLUMN IF NOT EXISTS elo_p1 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS elo_p2 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS serve_form_p1 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS serve_form_p2 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS return_form_p1 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS return_form_p2 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS surface_matches_p1 INTEGER,
  ADD COLUMN IF NOT EXISTS surface_matches_p2 INTEGER,
  ADD COLUMN IF NOT EXISTS surface_reliability_p1 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS surface_reliability_p2 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS feature_quality DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS p1_rest_days INTEGER,
  ADD COLUMN IF NOT EXISTS p2_rest_days INTEGER,
  ADD COLUMN IF NOT EXISTS p1_recent_matches_14d INTEGER,
  ADD COLUMN IF NOT EXISTS p2_recent_matches_14d INTEGER,
  ADD COLUMN IF NOT EXISTS h2h_p1_wins INTEGER,
  ADD COLUMN IF NOT EXISTS h2h_p2_wins INTEGER,
  ADD COLUMN IF NOT EXISTS h2h_surface_p1 INTEGER,
  ADD COLUMN IF NOT EXISTS h2h_surface_p2 INTEGER,
  ADD COLUMN IF NOT EXISTS feature_snapshot JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tennis_predictions_feature_quality
  ON tennis_predictions(feature_quality)
  WHERE feature_quality IS NOT NULL;
