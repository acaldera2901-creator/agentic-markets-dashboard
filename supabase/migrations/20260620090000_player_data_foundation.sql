-- supabase/migrations/20260620090000_player_data_foundation.sql
-- Fondamenta dati giocatore (sotto-progetto A, 2026-06-20).
-- Additivo: estende player_profiles + due tabelle nuove. Niente drop/rename.

-- 1. Estensione player_profiles (colonne mancanti per il tiering)
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS league VARCHAR;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS tier INT DEFAULT 0;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS goals_per90_season FLOAT;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS xg_per90_season FLOAT;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS minutes_share FLOAT;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS penalty_taker BOOLEAN DEFAULT false;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS eligible_for_player_markets BOOLEAN DEFAULT false;

-- 2. Storico per-partita (base per la finestra forma)
CREATE TABLE IF NOT EXISTS public.player_match_stats (
  id BIGSERIAL PRIMARY KEY,
  player_id VARCHAR NOT NULL,
  fixture_id INT NOT NULL,
  league VARCHAR NOT NULL,
  team VARCHAR,
  minutes INT,
  goals INT DEFAULT 0,
  assists INT DEFAULT 0,
  shots INT,
  xg FLOAT,
  started BOOLEAN DEFAULT false,
  match_date DATE,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, fixture_id)
);
CREATE INDEX IF NOT EXISTS idx_pms_player ON public.player_match_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_pms_league_date ON public.player_match_stats(league, match_date);

-- 3. Formazioni confermate (~T-40')
CREATE TABLE IF NOT EXISTS public.player_lineups (
  id BIGSERIAL PRIMARY KEY,
  player_id VARCHAR NOT NULL,
  fixture_id INT NOT NULL,
  team VARCHAR,
  position VARCHAR,
  shirt_number INT,
  is_starter BOOLEAN DEFAULT true,
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, fixture_id)
);
CREATE INDEX IF NOT EXISTS idx_lineups_fixture ON public.player_lineups(fixture_id);

-- Rollback:
-- DROP TABLE IF EXISTS public.player_lineups;
-- DROP TABLE IF EXISTS public.player_match_stats;
-- ALTER TABLE public.player_profiles
--   DROP COLUMN IF EXISTS league, DROP COLUMN IF EXISTS tier,
--   DROP COLUMN IF EXISTS goals_per90_season, DROP COLUMN IF EXISTS xg_per90_season,
--   DROP COLUMN IF EXISTS minutes_share, DROP COLUMN IF EXISTS penalty_taker,
--   DROP COLUMN IF EXISTS eligible_for_player_markets;
