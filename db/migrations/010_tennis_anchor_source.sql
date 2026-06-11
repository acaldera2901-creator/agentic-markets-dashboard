-- #PINNACLE-ANCHOR-1 — additive, OPTIONAL.
-- The served tennis row already persists odds_p1/odds_p2 (the odds-at-pick) and,
-- in feature_snapshot (JSONB), {odds_bookmaker, odds_anchor_source}. This column
-- promotes the anchor tier to a first-class field for cheaper CLV/coverage
-- queries (no JSONB digging). Nullable, no default backfill, no data rewrite —
-- additive and reversible. NOT required for the feature to work.
--
-- Apply: only after APPROVE. Rollback: ALTER TABLE tennis_predictions DROP COLUMN odds_anchor_source;

ALTER TABLE tennis_predictions
  ADD COLUMN IF NOT EXISTS odds_anchor_source text;

COMMENT ON COLUMN tennis_predictions.odds_anchor_source IS
  'Sharp market anchor tier for odds_p1/p2: pinnacle | sharp_exchange | best_margin (#PINNACLE-ANCHOR-1).';
