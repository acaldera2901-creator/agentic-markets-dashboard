-- 008_squad_condition_reports.sql — Squad Condition Watch ① (storage)
-- Spec: docs/superpowers/specs/2026-06-07-squad-condition-watch.md (gate: APPROVE Andrea).
--
-- Append-only, insert-on-change history of per-team squad condition (same
-- pattern as prediction_log / wc_squad_snapshots): a row is written ONLY when a
-- team's condition fingerprint changes (injuries flip, callup diff, XI-value
-- bucket move). The history that backs the why-layer + quality gate cannot be
-- reconstructed later, so it is captured as it happens.
--
-- Spec numbering note: the spec asked for "006"; 006/007 are already taken
-- (referral, community_slips) in db/migrations, so this lands as 008.
--
-- Additive only — no existing table touched. Reversibility: DROP TABLE
-- squad_condition_reports. Blast radius on the client GET path: nil.
-- Idempotent: IF NOT EXISTS everywhere.

CREATE TABLE IF NOT EXISTS squad_condition_reports (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_canonical     TEXT NOT NULL,
  source             TEXT NOT NULL DEFAULT 'espn',

  -- Change-detection fingerprint over the meaningful fields (injuries set +
  -- diff + availability bucket). Insert-on-change keys on (team, source, hash).
  report_hash        TEXT NOT NULL,

  -- Observed squad condition. NULL = unknown (no source), never fabricated.
  injured_count      INT,
  squad_size         INT,
  missing_players    JSONB,            -- known injuries (names)
  recent_diff        JSONB,            -- Track A callup diff {added,removed,injury_changes}
  xi_value           DOUBLE PRECISION, -- starting-XI market value (NULL when no value data)
  best11_value       DOUBLE PRECISION,
  availability_ratio DOUBLE PRECISION, -- xi_value / best11, clipped 1.2 (the lab d_avail)
  rotation_flag      BOOLEAN NOT NULL DEFAULT FALSE,

  -- ③ flag: whether this report was consumed by the served MODEL feature.
  -- Stays FALSE until the model-feature layer promotes (PROMOTION-GATE + APPROVE).
  model_consumed     BOOLEAN NOT NULL DEFAULT FALSE,

  captured_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One immutable snapshot per (team, source, fingerprint): identical cycles do
-- not flood the log (insert-on-change), a changed condition appends a new row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_scr_dedup
  ON squad_condition_reports (team_canonical, source, report_hash);

CREATE INDEX IF NOT EXISTS idx_scr_team_time
  ON squad_condition_reports (team_canonical, captured_at DESC);

-- Posture #010: analytics-only table reached exclusively via the service role
-- (server-side). No client (anon/authenticated) role may read or write it.
REVOKE ALL ON squad_condition_reports FROM anon, authenticated;
