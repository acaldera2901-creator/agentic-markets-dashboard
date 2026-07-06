-- 013_referral_code.sql — #REFERRAL-HARDENING (segue #REFERRAL-FLOW-CHECK punti 3/4/7)
-- Eseguire nel SQL Editor Supabase (come 006/012).
--
-- Mapping UFFICIALE codice→creator: il codice referral smette di essere
-- testo libero auto-dichiarato e diventa un campo CLAIMABILE sul profilo
-- (un codice per profilo, univoco, immutabile una volta preso — endpoint
-- /api/referral/claim). Chiude:
--   #4  /api/referral/stats enumerabile → ora risponde SOLO per il codice
--       claimato dal profilo loggato;
--   #3  self-referral → al claim, se referred_by == codice claimato viene
--       azzerato (non puoi essere stato invitato da te stesso);
--   #7  base per l'aggancio automatico dei reward (la vista /creators del
--       BackOffice può joinare referral_code invece del testo libero).
-- Valori sempre UPPERCASE, regex condivisa [A-Z0-9_-]{2,20} (lib/referral-code).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_referral_code
  ON profiles (UPPER(referral_code))
  WHERE referral_code IS NOT NULL;
