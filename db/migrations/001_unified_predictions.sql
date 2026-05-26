-- db/migrations/001_unified_predictions.sql
CREATE TABLE IF NOT EXISTS unified_predictions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_event_id       TEXT,
  sport                   TEXT NOT NULL DEFAULT 'football',
  competition             TEXT NOT NULL,
  league                  TEXT,
  event_name              TEXT NOT NULL,
  home_team               TEXT,
  away_team               TEXT,
  player_one              TEXT,
  player_two              TEXT,

  -- Market
  market                  TEXT NOT NULL DEFAULT '1X2',
  pick                    TEXT,
  bookmaker               TEXT NOT NULL DEFAULT 'model composite',
  odds                    NUMERIC(6,2),
  fair_odds               NUMERIC(6,2),
  edge_percent            NUMERIC(8,4),
  confidence_score        INTEGER,
  risk_level              TEXT NOT NULL DEFAULT 'medium',
  stake_suggestion        NUMERIC(6,2),
  closing_odds            NUMERIC(6,2),
  closing_line_value      NUMERIC(8,4),

  -- Status / Classification
  status                  TEXT NOT NULL DEFAULT 'upcoming',
  signal_type             TEXT NOT NULL DEFAULT 'signal',
  source                  TEXT NOT NULL DEFAULT 'model',
  model_version           TEXT NOT NULL DEFAULT 'football-v1',
  plan_access             TEXT NOT NULL DEFAULT 'base',
  is_historical           BOOLEAN NOT NULL DEFAULT FALSE,
  is_live                 BOOLEAN NOT NULL DEFAULT FALSE,
  is_paper                BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified             BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo                 BOOLEAN NOT NULL DEFAULT FALSE,

  -- Time
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at            TIMESTAMPTZ,
  starts_at               TIMESTAMPTZ NOT NULL,
  expires_at              TIMESTAMPTZ NOT NULL,
  settled_at              TIMESTAMPTZ,

  -- Result / Performance
  result                  TEXT,
  pnl                     NUMERIC(10,2),
  stake                   NUMERIC(10,2),
  roi                     NUMERIC(8,4),
  notes                   TEXT,
  explanation             TEXT NOT NULL DEFAULT '',

  -- World Cup specific
  world_cup_stage         TEXT,
  group_name              TEXT,
  venue                   TEXT,
  neutral_venue           BOOLEAN DEFAULT FALSE,
  team_news_summary       TEXT,
  market_movement_summary TEXT,

  -- Source reference (for dedup / sync)
  source_table            TEXT,
  source_id               TEXT,

  CONSTRAINT unified_predictions_source_unique UNIQUE (source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_up_status        ON unified_predictions(status);
CREATE INDEX IF NOT EXISTS idx_up_sport         ON unified_predictions(sport);
CREATE INDEX IF NOT EXISTS idx_up_competition   ON unified_predictions(competition);
CREATE INDEX IF NOT EXISTS idx_up_starts_at     ON unified_predictions(starts_at);
CREATE INDEX IF NOT EXISTS idx_up_plan_access   ON unified_predictions(plan_access);
CREATE INDEX IF NOT EXISTS idx_up_is_historical ON unified_predictions(is_historical);
