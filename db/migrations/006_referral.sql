-- 006_referral.sql — #MB-1 Match Builder influencer attribution
-- Eseguire nel SQL Editor: supabase.com/dashboard/project/izscgffubtakzvwxchqt/sql
--
-- First-touch attribution: il codice influencer (?ref=CODICE nel link Match
-- Builder) viaggia in localStorage e viene scritto UNA volta alla
-- registrazione. Nessuna tabella influencer per ora: il codice è testo libero,
-- il conteggio per influencer è SELECT referred_by, COUNT(*) GROUP BY 1.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by
  ON profiles (referred_by)
  WHERE referred_by IS NOT NULL;
