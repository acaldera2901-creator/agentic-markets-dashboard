-- supabase/migrations/20260621100000_player_odds.sql
-- Quote anytime-goalscorer (sotto-progetto B-odds, 2026-06-21). Additivo.
CREATE TABLE IF NOT EXISTS public.player_odds (
  id BIGSERIAL PRIMARY KEY,
  match_id VARCHAR,
  sport_key VARCHAR,
  event_id VARCHAR NOT NULL,
  player_id VARCHAR,
  player_name VARCHAR NOT NULL,
  market VARCHAR NOT NULL DEFAULT 'anytime_goalscorer',
  bookmaker VARCHAR NOT NULL,
  region VARCHAR NOT NULL DEFAULT 'us',
  price FLOAT,
  implied_prob FLOAT,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  is_closing BOOLEAN DEFAULT false,
  UNIQUE(event_id, bookmaker, player_name, market)
);
CREATE INDEX IF NOT EXISTS idx_player_odds_match ON public.player_odds(match_id);
CREATE INDEX IF NOT EXISTS idx_player_odds_event ON public.player_odds(event_id);

-- Rollback:
-- DROP TABLE IF EXISTS public.player_odds;
