-- #TRACKREC-PROOF-1 (PENDING APPROVE Andrea — DO NOT APPLY without OK in ch_deploy_gate):
-- append-only ledger that PROVES the served track record cannot be rewritten
-- after the fact. The public win-rate is only credible if (a) every pick is
-- recorded BEFORE kickoff (no look-ahead), and (b) once recorded, neither the
-- pick nor its settlement can be silently edited. These two tables enforce both
-- at the database level, independent of any application code.
--
-- ADDITIVE & ISOLATED: two NEW tables only. No existing table/column is touched.
-- The served path (unified_predictions, prediction_log) is untouched. The
-- writers that will FEED this ledger (lib/unified-adapter.ts,
-- core/odds_api_client.py) are a SEPARATE, later gated step — this migration
-- only creates the destination.
--
-- IMMUTABILITY MODEL:
--   * pick_ledger     — one row per served pick, written once at publish time.
--   * pick_settlement — one row per pick, written once when the event resolves.
--   UPDATE and DELETE are REVOKEd from every non-owner role; the service role
--   inserts, nothing edits. A correction is a NEW settlement row superseded by
--   created_at (the runner takes the latest), never an in-place mutation.
--
-- LOOK-AHEAD GUARD: CHECK (captured_at < commence_time) makes it physically
-- impossible to insert a pick timestamped at/after kickoff. A row that violates
-- this is rejected by Postgres, not by trust in the writer.

-- ─── pick_ledger ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pick_ledger (
  id              BIGSERIAL PRIMARY KEY,

  -- provenance / dedup (mirror unified_predictions dedup semantics)
  source_table    TEXT NOT NULL,          -- 'dixon_coles_predictions' | 'xg_predictions' | 'tennis_predictions' | ...
  source_id       TEXT NOT NULL,          -- match_id / dedup key as written to unified_predictions
  model_version   TEXT NOT NULL,          -- 'football-dixoncoles-v1' | 'football-xg-v1' | 'tennis-elo-surface-v1' | ...

  sport           TEXT NOT NULL,          -- 'football' | 'tennis'
  league          TEXT,
  competition     TEXT,
  home_team       TEXT,                   -- p1 for tennis
  away_team       TEXT,                   -- p2 for tennis

  market          TEXT NOT NULL DEFAULT '1X2',
  pick            TEXT,                   -- 'HOME'|'DRAW'|'AWAY' or player name; NULL = no declared direction
  -- full model distribution captured at pick time (machine-readable, audit)
  p_home          DOUBLE PRECISION,       -- p1 for tennis
  p_draw          DOUBLE PRECISION,       -- NULL for tennis
  p_away          DOUBLE PRECISION,       -- p2 for tennis
  confidence      DOUBLE PRECISION,       -- picked-outcome probability (0..1)

  -- market context at pick time (NULL when no real market — never fabricated)
  odds            DOUBLE PRECISION,       -- price on the pick at capture (open)
  bookmaker       TEXT,
  anchor_source   TEXT,                   -- 'pinnacle'|'sharp_exchange'|'best_margin' (#PINNACLE-ANCHOR-1)

  is_paper        BOOLEAN NOT NULL DEFAULT TRUE,
  signal_type     TEXT NOT NULL DEFAULT 'paper',

  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  commence_time   TIMESTAMPTZ NOT NULL,

  -- look-ahead is physically impossible: the pick must be timestamped strictly
  -- before kickoff or the insert is rejected.
  CONSTRAINT pick_ledger_no_lookahead CHECK (captured_at < commence_time),

  -- one immutable pick per served prediction per model version. Re-publishing
  -- the same (source_table, source_id) under the same model_version is a no-op
  -- conflict, never a second row.
  CONSTRAINT pick_ledger_dedup UNIQUE (source_table, source_id, model_version)
);

CREATE INDEX IF NOT EXISTS pick_ledger_commence_idx ON pick_ledger (commence_time);
CREATE INDEX IF NOT EXISTS pick_ledger_model_idx    ON pick_ledger (model_version);
CREATE INDEX IF NOT EXISTS pick_ledger_sport_idx    ON pick_ledger (sport);

-- ─── pick_settlement ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pick_settlement (
  id              BIGSERIAL PRIMARY KEY,

  source_table    TEXT NOT NULL,
  source_id       TEXT NOT NULL,
  model_version   TEXT NOT NULL,

  result          TEXT NOT NULL,          -- won|lost|void|unresolved
  outcome         TEXT,                   -- realized 1X2 outcome or winner name
  final_score     TEXT,                   -- "2-1" / "6-4 6-3"
  closing_odds    DOUBLE PRECISION,       -- price on the pick at close (for CLV); NULL if not captured

  settled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- a settlement points back at exactly one ledger pick.
  CONSTRAINT pick_settlement_ledger_fk
    FOREIGN KEY (source_table, source_id, model_version)
    REFERENCES pick_ledger (source_table, source_id, model_version)
);

CREATE INDEX IF NOT EXISTS pick_settlement_key_idx
  ON pick_settlement (source_table, source_id, model_version);
CREATE INDEX IF NOT EXISTS pick_settlement_settled_idx
  ON pick_settlement (settled_at);

-- ─── immutability: insert-only for the service role, no UPDATE/DELETE ─────────
-- The writer inserts; nothing in the system may edit or remove a recorded pick
-- or settlement. Corrections are append-only (a new settlement row, latest wins
-- in the runner). REVOKE is from the table owner's default grants; the service
-- role used by the Python writers inherits no UPDATE/DELETE here.
REVOKE UPDATE, DELETE ON pick_ledger     FROM PUBLIC, anon, authenticated, service_role;
REVOKE UPDATE, DELETE ON pick_settlement FROM PUBLIC, anon, authenticated, service_role;
GRANT  INSERT, SELECT ON pick_ledger     TO service_role;
GRANT  INSERT, SELECT ON pick_settlement TO service_role;

-- ─── RLS: read-only to clients, no write surface ─────────────────────────────
-- The public track record reads aggregates from these tables (settled, past
-- events only). Anon/authenticated may SELECT; they can never write. The
-- service role bypasses RLS for the INSERT-only writer path.
ALTER TABLE pick_ledger     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_settlement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pick_ledger_select ON pick_ledger;
CREATE POLICY pick_ledger_select ON pick_ledger
  FOR SELECT TO anon, authenticated
  USING (commence_time < NOW());          -- only past events are publicly visible

DROP POLICY IF EXISTS pick_settlement_select ON pick_settlement;
CREATE POLICY pick_settlement_select ON pick_settlement
  FOR SELECT TO anon, authenticated
  USING (TRUE);                           -- a settlement only exists post-event
