-- 003_wc_squads.sql — WC Track A (design: docs/superpowers/specs/2026-06-05-world-cup-wing-design.md)
-- Persist WC squad reveals: current state (wc_squads + wc_squad_players) and an
-- append-only snapshot history (wc_squad_snapshots) written only on roster change.
-- Applied by Andrea (deploy gate). Idempotent: IF NOT EXISTS everywhere.

CREATE TABLE IF NOT EXISTS wc_squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_canonical TEXT NOT NULL,          -- canonical_team_name() spelling
  team_id_espn TEXT,
  squad_size INT,
  injured_count INT,
  roster_hash TEXT,                      -- change detection in one GET (delta vs spec)
  source TEXT NOT NULL DEFAULT 'espn',   -- 'espn' | 'api-football'
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_canonical, source)
);

CREATE TABLE IF NOT EXISTS wc_squad_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES wc_squads(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  position TEXT,
  is_injured BOOLEAN NOT NULL DEFAULT FALSE,
  shirt_number INT,                      -- API-Football only (NULL from ESPN)
  club_team TEXT,                        -- API-Football only
  age INT,                               -- API-Football only
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (squad_id, player_name)
);

CREATE TABLE IF NOT EXISTS wc_squad_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_canonical TEXT NOT NULL,
  source TEXT NOT NULL,
  roster_hash TEXT NOT NULL,
  roster JSONB NOT NULL,                 -- full player list at capture time
  diff JSONB,                            -- {added:[], removed:[], injury_changes:[]} vs previous; NULL on first capture
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wcss_team_time
  ON wc_squad_snapshots (team_canonical, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_wcsp_squad
  ON wc_squad_players (squad_id);
