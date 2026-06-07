-- 007_community_slips.sql — #MB-2 Creator Picks (schedine pubblicate da utenti/influencer)
-- Eseguire nel SQL Editor: supabase.com/dashboard/project/izscgffubtakzvwxchqt/sql
--
-- Una riga per schedina pubblicata dal Match Builder. selections è uno
-- SNAPSHOT (label/pick/prob al momento della pubblicazione): la pagina
-- /community non deve ricomputare nulla né rompersi quando le predizioni
-- sottostanti escono dalla finestra.

CREATE TABLE IF NOT EXISTS community_slips (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_code       TEXT NOT NULL,
  creator_identifier TEXT,                    -- email profilo (per moderazione), mai esposta
  mb_param           TEXT NOT NULL,           -- valore ?mb= per riaprire la schedina
  selections         JSONB NOT NULL,          -- [{id,label,market,sport,when,prob}]
  combined_prob      NUMERIC,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_slips_created
  ON community_slips (created_at DESC);
