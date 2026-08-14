-- #FUNNEL-MEAS-0813 — sorgente di acquisizione del profilo.
-- First-touch catturata client-side (localStorage, lib/attribution.ts) e scritta
-- all'INSERT del register (app/api/auth). Nullable: nessun codice esistente la
-- legge, i 19 profili storici restano NULL (sorgente ignota, non inventata).
-- Reversibile con: ALTER TABLE profiles DROP COLUMN acquisition;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS acquisition JSONB;
