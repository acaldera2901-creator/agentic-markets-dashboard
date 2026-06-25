-- #SOFT-MARKETS — stima calibrata corner/cartellini/falli (NON edge-vs-book).
-- Tabella isolata: nessun impatto su match_predictions/unified_predictions/board.
CREATE TABLE IF NOT EXISTS soft_predictions (
  id            BIGSERIAL PRIMARY KEY,
  match_key     TEXT NOT NULL,                 -- normName(home)|normName(away)|YYYY-MM-DD
  league        TEXT NOT NULL,
  home_team     TEXT NOT NULL,
  away_team     TEXT NOT NULL,
  kickoff       TIMESTAMPTZ NOT NULL,
  market        TEXT NOT NULL CHECK (market IN ('corners','cards','fouls')),
  expected      DOUBLE PRECISION NOT NULL,     -- lambda totale match
  main_line     DOUBLE PRECISION NOT NULL,
  p_over        DOUBLE PRECISION NOT NULL CHECK (p_over >= 0 AND p_over <= 1),
  confidence    DOUBLE PRECISION,
  is_generic    BOOLEAN NOT NULL DEFAULT FALSE,-- true per corner (no skill validata)
  model_version TEXT NOT NULL,
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  external_fixture_id BIGINT,                  -- api-football fixture id (per settlement)
  actual        INTEGER,                       -- popolato dal settler (forward)
  settled_at    TIMESTAMPTZ,
  UNIQUE (match_key, market)
);
CREATE INDEX IF NOT EXISTS idx_soft_pred_kickoff ON soft_predictions (kickoff);
