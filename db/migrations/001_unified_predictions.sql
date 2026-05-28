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
  odds                    NUMERIC(8,2),
  fair_odds               NUMERIC(8,2),
  edge_percent            NUMERIC(8,4),
  confidence_score        INTEGER,
  risk_level              TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  stake_suggestion        NUMERIC(8,2),
  closing_odds            NUMERIC(8,2),
  closing_line_value      NUMERIC(8,4),

  -- Status / Classification
  status                  TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('open', 'upcoming', 'expired', 'pending_settlement', 'settled', 'won', 'lost', 'void', 'paper')),
  signal_type             TEXT NOT NULL DEFAULT 'signal' CHECK (signal_type IN ('paper', 'signal', 'verified', 'live', 'demo')),
  source                  TEXT NOT NULL DEFAULT 'model' CHECK (source IN ('model', 'rule', 'provider', 'manual', 'admin')),
  model_version           TEXT NOT NULL DEFAULT 'football-v1',
  plan_access             TEXT NOT NULL DEFAULT 'base' CHECK (plan_access IN ('public_locked', 'free', 'base', 'premium')),
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

  CONSTRAINT chk_expires_after_starts CHECK (expires_at >= starts_at),

  -- Result / Performance
  result                  TEXT CHECK (result IN ('won', 'lost', 'void', 'pending') OR result IS NULL),
  pnl                     NUMERIC(12,2),
  stake                   NUMERIC(12,2),
  roi                     NUMERIC(8,4),
  notes                   TEXT,
  explanation             TEXT,

  -- World Cup specific
  world_cup_stage         TEXT CHECK (world_cup_stage IN ('group', 'round16', 'quarter', 'semi', 'final') OR world_cup_stage IS NULL),
  group_name              TEXT,
  venue                   TEXT,
  neutral_venue           BOOLEAN DEFAULT FALSE,
  team_news_summary       TEXT,
  market_movement_summary TEXT,

  -- Source reference (for dedup / sync)
  source_table            TEXT,
  source_id               TEXT
);

CREATE INDEX IF NOT EXISTS idx_up_status        ON unified_predictions(status);
CREATE INDEX IF NOT EXISTS idx_up_sport         ON unified_predictions(sport);
CREATE INDEX IF NOT EXISTS idx_up_competition   ON unified_predictions(competition);
CREATE INDEX IF NOT EXISTS idx_up_starts_at     ON unified_predictions(starts_at);
CREATE INDEX IF NOT EXISTS idx_up_plan_access   ON unified_predictions(plan_access);
CREATE INDEX IF NOT EXISTS idx_up_is_historical ON unified_predictions(is_historical);
CREATE UNIQUE INDEX IF NOT EXISTS idx_up_source_dedup ON unified_predictions(source_table, source_id) WHERE source_table IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_up_status_sport_starts ON unified_predictions(status, sport, starts_at DESC);
