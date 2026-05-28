-- Enriched fixtures: one row per match, updated pre-kickoff
CREATE TABLE IF NOT EXISTS fixtures_enriched (
  match_id           TEXT PRIMARY KEY,
  home_team          TEXT NOT NULL,
  away_team          TEXT NOT NULL,
  kickoff            TIMESTAMPTZ NOT NULL,
  league             TEXT NOT NULL,
  venue              TEXT,
  home_form          TEXT,
  away_form          TEXT,
  home_ppg           FLOAT,
  away_ppg           FLOAT,
  home_xg_avg        FLOAT,
  away_xg_avg        FLOAT,
  home_xg_luck       FLOAT,
  away_xg_luck       FLOAT,
  home_position      INT,
  away_position      INT,
  total_teams        INT,
  matches_remaining  INT,
  home_motivation    FLOAT,
  away_motivation    FLOAT,
  h2h_home_wins      INT DEFAULT 0,
  h2h_draws          INT DEFAULT 0,
  h2h_away_wins      INT DEFAULT 0,
  h2h_matches        INT DEFAULT 0,
  home_injuries_json JSONB DEFAULT '[]',
  away_injuries_json JSONB DEFAULT '[]',
  temperature_c      FLOAT,
  wind_kmh           FLOAT,
  precipitation_pct  FLOAT,
  referee_name       TEXT,
  referee_foul_rate  FLOAT,
  providers_used     TEXT[] DEFAULT '{}',
  last_updated       TIMESTAMPTZ DEFAULT NOW()
);

-- Multi-bookmaker odds snapshots
CREATE TABLE IF NOT EXISTS odds_snapshots (
  id           BIGSERIAL PRIMARY KEY,
  match_id     TEXT NOT NULL,
  bookmaker    TEXT NOT NULL,
  source       TEXT NOT NULL,
  market       TEXT NOT NULL DEFAULT 'h2h',
  odds_home    FLOAT,
  odds_draw    FLOAT,
  odds_away    FLOAT,
  ah_line      FLOAT,
  ah_home      FLOAT,
  ah_away      FLOAT,
  overround    FLOAT,
  captured_at  TIMESTAMPTZ DEFAULT NOW(),
  is_closing   BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_match ON odds_snapshots(match_id, captured_at DESC);

-- Tennis upcoming fixtures
CREATE TABLE IF NOT EXISTS tennis_fixtures (
  match_id          TEXT PRIMARY KEY,
  player1           TEXT NOT NULL,
  player2           TEXT NOT NULL,
  tournament        TEXT,
  surface           TEXT,
  round             TEXT,
  scheduled_at      TIMESTAMPTZ,
  p1_rank           INT,
  p2_rank           INT,
  p1_rank_points    INT,
  p2_rank_points    INT,
  h2h_p1_wins       INT DEFAULT 0,
  h2h_p2_wins       INT DEFAULT 0,
  h2h_surface_p1    INT DEFAULT 0,
  h2h_surface_p2    INT DEFAULT 0,
  p1_form_json      JSONB DEFAULT '[]',
  p2_form_json      JSONB DEFAULT '[]',
  p1_rest_days      INT,
  p2_rest_days      INT,
  p1_sets_last      INT,
  p2_sets_last      INT,
  provider          TEXT,
  last_updated      TIMESTAMPTZ DEFAULT NOW()
);

-- API quota tracking
CREATE TABLE IF NOT EXISTS source_quota_log (
  provider        TEXT NOT NULL,
  date            DATE NOT NULL,
  requests_made   INT DEFAULT 0,
  requests_limit  INT,
  last_request_at TIMESTAMPTZ,
  PRIMARY KEY (provider, date)
);
