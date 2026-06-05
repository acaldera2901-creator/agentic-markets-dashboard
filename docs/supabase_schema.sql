-- ============================================================
-- AGENTIC MARKETS — Schema completo Supabase
-- Eseguire nel SQL Editor: supabase.com/dashboard/project/xcgvfrsrcphzfctfyukz/sql
-- ============================================================

-- Dashboard-web tables
CREATE TABLE IF NOT EXISTS match_predictions (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR NOT NULL UNIQUE,
  league VARCHAR NOT NULL,
  league_name VARCHAR NOT NULL,
  home_team VARCHAR NOT NULL,
  away_team VARCHAR NOT NULL,
  kickoff TIMESTAMPTZ NOT NULL,
  p_home FLOAT NOT NULL,
  p_draw FLOAT NOT NULL,
  p_away FLOAT NOT NULL,
  lambda_home FLOAT,
  lambda_away FLOAT,
  odds_home FLOAT,
  odds_draw FLOAT,
  odds_away FLOAT,
  edge FLOAT,
  best_selection VARCHAR,
  model_matches INT,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  enrichment JSONB,
  home_score INT,
  away_score INT,
  match_status TEXT DEFAULT 'SCHEDULED',
  match_type TEXT
);

CREATE TABLE IF NOT EXISTS understat_cache (
  league VARCHAR PRIMARY KEY,
  data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_research (
  match_id VARCHAR PRIMARY KEY,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leaderboard (
  id SERIAL PRIMARY KEY,
  display_name TEXT NOT NULL,
  email_hash TEXT UNIQUE,
  points INT DEFAULT 0,
  bets_won INT DEFAULT 0,
  bets_total INT DEFAULT 0,
  pnl FLOAT DEFAULT 0,
  sport TEXT DEFAULT 'all',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  session_id TEXT,
  country TEXT,
  language TEXT,
  plan TEXT,
  partner_id TEXT,
  value FLOAT DEFAULT 0,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_requests (
  id SERIAL PRIMARY KEY,
  company TEXT NOT NULL,
  site TEXT,
  category TEXT,
  email TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  target TEXT DEFAULT 'all',
  sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  meta JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS agent_heartbeats (
  agent_name VARCHAR PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status_detail TEXT
);

-- Client-portal tables
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  method TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS per deposits (client-portal usa anon key)
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deposits' AND policyname='Users see own deposits') THEN
    CREATE POLICY "Users see own deposits" ON deposits FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deposits' AND policyname='Users insert own deposits') THEN
    CREATE POLICY "Users insert own deposits" ON deposits FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Python backend tables (create via SQLAlchemy init_db — questo è un backup manuale)
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR UNIQUE,
  league VARCHAR,
  home_team VARCHAR,
  away_team VARCHAR,
  kickoff TIMESTAMP,
  status VARCHAR DEFAULT 'scheduled'
);

CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  match_external_id VARCHAR,
  model_home FLOAT,
  model_draw FLOAT,
  model_away FLOAT,
  market_home_implied FLOAT,
  market_draw_implied FLOAT,
  market_away_implied FLOAT,
  best_edge FLOAT,
  best_selection VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bets (
  id SERIAL PRIMARY KEY,
  match_external_id VARCHAR,
  home_team VARCHAR,
  away_team VARCHAR,
  kickoff VARCHAR,
  league VARCHAR,
  matchday_id VARCHAR,
  selection VARCHAR,
  odds FLOAT,
  stake FLOAT,
  paper BOOLEAN DEFAULT true,
  status VARCHAR DEFAULT 'pending',
  profit_loss FLOAT,
  betfair_bet_id VARCHAR,
  thesis VARCHAR,
  placed_at TIMESTAMP DEFAULT NOW(),
  settled_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS league_profiles (
  id SERIAL PRIMARY KEY,
  league_id VARCHAR UNIQUE,
  league_name VARCHAR,
  strength_tier INT,
  market_efficiency FLOAT DEFAULT 0.5,
  predictability_score FLOAT DEFAULT 0.5,
  avg_xg_per_game FLOAT,
  result_volatility FLOAT,
  liquidity_score FLOAT DEFAULT 0.5,
  recommended_edge_min FLOAT DEFAULT 0.03,
  total_matches_analyzed INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_classifications (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR UNIQUE,
  league_id VARCHAR,
  match_type VARCHAR DEFAULT 'STANDARD',
  motivation_home FLOAT,
  motivation_away FLOAT,
  rest_advantage FLOAT,
  home_days_rest INT,
  away_days_rest INT,
  is_derby BOOLEAN DEFAULT false,
  classified_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS league_predictability_log (
  id SERIAL PRIMARY KEY,
  league_id VARCHAR,
  snapshot_date TIMESTAMP DEFAULT NOW(),
  total_predictions INT DEFAULT 0,
  hit_rate FLOAT,
  value_bet_hit_rate FLOAT,
  avg_clv FLOAT,
  roi FLOAT,
  brier_score FLOAT,
  best_bet_type VARCHAR,
  worst_bet_type VARCHAR,
  confidence_level VARCHAR DEFAULT 'INSUFFICIENT_DATA',
  bet_filter_active BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS derby_registry (
  id SERIAL PRIMARY KEY,
  team_a VARCHAR,
  team_b VARCHAR,
  league_id VARCHAR,
  derby_type VARCHAR DEFAULT 'NATIONAL',
  source VARCHAR DEFAULT 'seed',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_decisions (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR,
  league_id VARCHAR,
  approved BOOLEAN DEFAULT false,
  final_stake FLOAT,
  base_stake FLOAT,
  composite_multiplier FLOAT,
  skip_reason VARCHAR,
  circuit_level VARCHAR DEFAULT 'NONE',
  drawdown FLOAT DEFAULT 0.0,
  factors_json VARCHAR,
  decided_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bankroll_history (
  id SERIAL PRIMARY KEY,
  bankroll FLOAT,
  peak_bankroll FLOAT,
  drawdown FLOAT DEFAULT 0.0,
  circuit_level VARCHAR DEFAULT 'NONE',
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS variance_budget_log (
  id SERIAL PRIMARY KEY,
  week_start TIMESTAMP,
  used_variance FLOAT DEFAULT 0.0,
  max_weekly_variance FLOAT,
  budget_factor FLOAT DEFAULT 1.0,
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_trust_log (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR,
  feature_name VARCHAR,
  source VARCHAR,
  trust_score FLOAT,
  staleness_minutes INT,
  validation_flags VARCHAR,
  fallback_used BOOLEAN DEFAULT false,
  fallback_source VARCHAR,
  logged_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS temporal_audit_log (
  id SERIAL PRIMARY KEY,
  leakage_count INT DEFAULT 0,
  leakage_pct FLOAT DEFAULT 0.0,
  auto_corrected BOOLEAN DEFAULT false,
  blocked BOOLEAN DEFAULT false,
  checks_run INT DEFAULT 0,
  audit_timestamp TIMESTAMP,
  report_json VARCHAR
);

CREATE TABLE IF NOT EXISTS prediction_explanations (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR,
  top_features_json VARCHAR,
  narrative VARCHAR,
  shap_sum FLOAT,
  base_probability FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_memory (
  id SERIAL PRIMARY KEY,
  feature_name VARCHAR,
  rolling_shap_accuracy FLOAT,
  error_contribution FLOAT,
  trend VARCHAR,
  last_100_accuracy FLOAT,
  recommended_weight_adjustment FLOAT,
  sample_count INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS error_patterns_log (
  id SERIAL PRIMARY KEY,
  pattern_name VARCHAR,
  occurrences INT DEFAULT 0,
  proposal_id VARCHAR,
  status VARCHAR,
  requires_approval BOOLEAN DEFAULT false,
  logged_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_profiles (
  id SERIAL PRIMARY KEY,
  player_id VARCHAR UNIQUE,
  name VARCHAR,
  team VARCHAR,
  role VARCHAR,
  importance_score FLOAT,
  status VARCHAR DEFAULT 'AVAILABLE',
  goals_last_5 INT DEFAULT 0,
  assists_last_5 INT DEFAULT 0,
  xg_contribution_last_5 FLOAT DEFAULT 0.0,
  minutes_played_last_5 INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prediction_reasoning (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR,
  step_number INT,
  step_json VARCHAR,
  logged_at TIMESTAMP DEFAULT NOW()
);

-- Tennis tables
CREATE TABLE IF NOT EXISTS tennis_predictions (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR,
  tournament VARCHAR,
  surface VARCHAR,
  player1 VARCHAR NOT NULL,
  player2 VARCHAR NOT NULL,
  scheduled_at TIMESTAMP,
  p1 FLOAT,
  p2 FLOAT,
  odds_p1 FLOAT,
  odds_p2 FLOAT,
  edge FLOAT,
  best_selection VARCHAR,
  elo_p1 FLOAT,
  elo_p2 FLOAT,
  serve_form_p1 FLOAT,
  serve_form_p2 FLOAT,
  return_form_p1 FLOAT,
  return_form_p2 FLOAT,
  surface_matches_p1 INT,
  surface_matches_p2 INT,
  surface_reliability_p1 FLOAT,
  surface_reliability_p2 FLOAT,
  feature_quality FLOAT,
  p1_rest_days INT,
  p2_rest_days INT,
  p1_recent_matches_14d INT,
  p2_recent_matches_14d INT,
  h2h_p1_wins INT,
  h2h_p2_wins INT,
  h2h_surface_p1 INT,
  h2h_surface_p2 INT,
  feature_snapshot JSONB DEFAULT '{}'::jsonb,
  model_version VARCHAR DEFAULT 'elo_v1',
  computed_at TIMESTAMP DEFAULT NOW(),
  outcome VARCHAR,
  winner VARCHAR,
  settled_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tennis_bets (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR NOT NULL,
  selection VARCHAR NOT NULL,
  player_name VARCHAR,
  odds FLOAT NOT NULL,
  stake FLOAT NOT NULL,
  paper BOOLEAN DEFAULT true,
  status VARCHAR DEFAULT 'pending',
  profit_loss FLOAT,
  placed_at TIMESTAMP DEFAULT NOW(),
  betfair_bet_id VARCHAR
);

CREATE TABLE IF NOT EXISTS elo_ratings (
  player VARCHAR PRIMARY KEY,
  overall FLOAT DEFAULT 1500.0,
  clay FLOAT DEFAULT 1500.0,
  grass FLOAT DEFAULT 1500.0,
  hard FLOAT DEFAULT 1500.0,
  clay_matches INT DEFAULT 0,
  grass_matches INT DEFAULT 0,
  hard_matches INT DEFAULT 0,
  matches INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- exec_sql helper (usata da dashboard-web via Supabase JS RPC)
-- ESEGUIRE dopo le CREATE TABLE
-- ============================================================
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result jsonb;
BEGIN
  BEGIN
    EXECUTE format(
      'SELECT coalesce(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t',
      query
    ) INTO result;
    RETURN result;
  EXCEPTION WHEN OTHERS THEN
    EXECUTE query;
    RETURN '[]'::jsonb;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
