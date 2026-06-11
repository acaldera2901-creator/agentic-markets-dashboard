-- #SPORTSBOOK-SHADOW-1 (PENDING APPROVE Andrea): forward-only shadow-eval table.
--
-- PURPOSE: measure whether folding Stake/Roobet quotes into our predictions
-- improves or degrades calibration vs the market source we already use
-- (The Odds API). A historical backtest is impossible — Stake/Roobet history
-- starts 2026-06-11 — so we snapshot every served prediction with a baseline
-- leg and per-book SHADOW legs, then settle forward and compare.
--
-- ADDITIVE & ISOLATED: new table only. No existing table/column is touched.
-- odds_snapshots stays write-only for the live model (this table READS it, the
-- model never reads this one). Nothing here feeds the served prediction path.
--
-- DEDUP: one row per (prediction_ref, captured_at-bucket) is enforced by the
-- writer (insert-on-change keyed by prediction_ref + a probability signature);
-- a UNIQUE on (prediction_ref) would be wrong (we want the time series), so we
-- index for the join/report instead.
--
-- RLS: same posture as prediction_log (#AUDIT MEDIUM-22) — enabled + REVOKE from
-- anon/authenticated. Written/read by the Python agents via the service role.

CREATE TABLE IF NOT EXISTS sportsbook_shadow_eval (
  id              BIGSERIAL PRIMARY KEY,

  -- identity / join keys
  prediction_ref  TEXT NOT NULL,          -- served row id or match_id (provenance below)
  ref_source      TEXT NOT NULL,          -- 'unified_predictions' | 'tennis_predictions'
  sport           TEXT NOT NULL,          -- 'football' | 'tennis'
  team_pair_key   TEXT,                   -- recipe = scraper/_pair_key; NULL if uncomputable
  league          TEXT,
  home_team       TEXT,                   -- p1 for tennis
  away_team       TEXT,                   -- p2 for tennis
  commence_time   TIMESTAMPTZ,

  -- baseline = what the model SERVES today (already blended with The Odds API)
  base_p_home     DOUBLE PRECISION,       -- p1 for tennis
  base_p_draw     DOUBLE PRECISION,       -- NULL for tennis
  base_p_away     DOUBLE PRECISION,       -- p2 for tennis
  base_pick       SMALLINT,               -- argmax index 0/1/2 of the baseline
  base_pick_odds  DOUBLE PRECISION,       -- price the baseline pick would take (book at capture), nullable

  -- per-book shadow legs: stake / roobet / combined (best-line or avg, see writer)
  book            TEXT NOT NULL,          -- 'stake' | 'roobet' | 'combined'
  matched         BOOLEAN NOT NULL DEFAULT FALSE,  -- a usable book quote existed at capture
  book_p_home     DOUBLE PRECISION,
  book_p_draw     DOUBLE PRECISION,
  book_p_away     DOUBLE PRECISION,
  shadow_p_home   DOUBLE PRECISION,       -- = base when unmatched (identity, by contract)
  shadow_p_draw   DOUBLE PRECISION,
  shadow_p_away   DOUBLE PRECISION,
  shadow_pick     SMALLINT,
  taken_odds      DOUBLE PRECISION,       -- book price on the shadow pick at capture (for CLV/edge)
  blend_alpha     DOUBLE PRECISION,

  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- settled forward (NULL until the match resolves)
  outcome_idx     SMALLINT,               -- realized 0/1/2 (home/draw/away or p1/-/p2)
  closing_odds    DOUBLE PRECISION,       -- book closing price on the shadow pick (is_closing row)
  result          TEXT,                   -- won|lost|void|unresolved (mirrors served settlement)
  settled_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shadow_eval_unsettled
  ON sportsbook_shadow_eval(commence_time)
  WHERE result IS NULL;
CREATE INDEX IF NOT EXISTS idx_shadow_eval_book_sport
  ON sportsbook_shadow_eval(book, sport, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_shadow_eval_ref
  ON sportsbook_shadow_eval(prediction_ref, book, captured_at DESC);

ALTER TABLE sportsbook_shadow_eval ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sportsbook_shadow_eval FROM anon, authenticated;
