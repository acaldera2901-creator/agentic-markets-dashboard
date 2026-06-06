-- #ODDS-1 (APPROVE Andrea 2026-06-06): make odds_snapshots joinable with our
-- predictions and able to hold the totals market we already pay for.
--
-- team_pair_key: "<utc-date>:<norm_home>|<norm_away>" with the pair sorted —
--   same recipe as the tennis adapter's _pair_key, computable from both
--   odds_snapshots and unified_predictions/prediction_log rows (team names +
--   kickoff), which unlocks CLV / market-vs-model calibration joins that the
--   provider-namespaced match_id ('WC:<theoddsapi_id>') never allowed.
-- commence_time: kickoff UTC straight from The Odds API event — needed both
--   for the pair key and for closing-line marking.
-- total_line/total_over/total_under: the "totals" market (over/under) — we pay
--   per market×region, so persisting it is free signal.
ALTER TABLE odds_snapshots ADD COLUMN IF NOT EXISTS team_pair_key TEXT;
ALTER TABLE odds_snapshots ADD COLUMN IF NOT EXISTS commence_time TIMESTAMPTZ;
ALTER TABLE odds_snapshots ADD COLUMN IF NOT EXISTS total_line   FLOAT;
ALTER TABLE odds_snapshots ADD COLUMN IF NOT EXISTS total_over   FLOAT;
ALTER TABLE odds_snapshots ADD COLUMN IF NOT EXISTS total_under  FLOAT;

CREATE INDEX IF NOT EXISTS idx_odds_snapshots_pair
  ON odds_snapshots(team_pair_key, captured_at DESC);
-- closing-line lookups: "which matches started but have no closing row yet"
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_commence
  ON odds_snapshots(commence_time)
  WHERE is_closing = FALSE;
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_closing
  ON odds_snapshots(match_id)
  WHERE is_closing = TRUE;
