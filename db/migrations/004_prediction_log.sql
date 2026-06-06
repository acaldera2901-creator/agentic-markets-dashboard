-- 004_prediction_log.sql — Reliability upgrade PROPOSAL A (gate: APPROVE msg_mq1m1b9v)
-- Spec: docs/internal/reliability-upgrade-2026-06-06.md (FASE 5, PROPOSAL A).
--
-- Append-only snapshot of every football prediction actually SERVED to the client,
-- captured at compute time, so live calibration (Brier / reliability curve) can be
-- measured against real outcomes. Today this is structurally impossible:
-- match_predictions holds only the current upcoming set and is wiped on settle.
--
-- Additive only — no existing table is touched. Reversibility: DROP TABLE prediction_log.
-- Blast radius on the client: nil (the GET path never reads this table).
-- Idempotent: IF NOT EXISTS everywhere.

CREATE TABLE IF NOT EXISTS prediction_log (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id        TEXT NOT NULL,
  league          TEXT,
  home_team       TEXT,
  away_team       TEXT,
  kickoff         TIMESTAMPTZ NOT NULL,

  -- Probabilities actually served (POST-blend if a market blend was applied).
  p_home          DOUBLE PRECISION NOT NULL,
  p_draw          DOUBLE PRECISION NOT NULL,
  p_away          DOUBLE PRECISION NOT NULL,

  -- Raw model probabilities (pre-blend), so the blend's contribution is auditable.
  model_p_home    DOUBLE PRECISION,
  model_p_draw    DOUBLE PRECISION,
  model_p_away    DOUBLE PRECISION,

  lambda_home     DOUBLE PRECISION,
  lambda_away     DOUBLE PRECISION,

  -- 1X2 market odds at compute time (NULL when no real market was available).
  odds_home       DOUBLE PRECISION,
  odds_draw       DOUBLE PRECISION,
  odds_away       DOUBLE PRECISION,

  -- De-vigged market probabilities (NULL when odds absent).
  market_p_home   DOUBLE PRECISION,
  market_p_draw   DOUBLE PRECISION,
  market_p_away   DOUBLE PRECISION,

  model_version   TEXT NOT NULL,
  blend_alpha     DOUBLE PRECISION,

  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Settlement (written once the match finishes; NULL until then).
  result          TEXT CHECK (result IN ('home', 'draw', 'away', 'void') OR result IS NULL),
  home_score      INT,
  away_score      INT,
  settled_at      TIMESTAMPTZ
);

-- One immutable snapshot per (match, model_version, compute run).
CREATE UNIQUE INDEX IF NOT EXISTS idx_predlog_dedup
  ON prediction_log (match_id, model_version, computed_at);

CREATE INDEX IF NOT EXISTS idx_predlog_match    ON prediction_log (match_id);
CREATE INDEX IF NOT EXISTS idx_predlog_kickoff  ON prediction_log (kickoff);
CREATE INDEX IF NOT EXISTS idx_predlog_unsettled ON prediction_log (kickoff)
  WHERE result IS NULL;

-- Posture #010: analytics-only table reached exclusively via the service role
-- (server-side dbQuery). No client (anon/authenticated) role may read or write it.
REVOKE ALL ON prediction_log FROM anon, authenticated;
