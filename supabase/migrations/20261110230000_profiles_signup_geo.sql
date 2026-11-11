-- #G2-TRACKING-1110 — geo e sessione alla registrazione (Andrea 10/11/2026).
-- Additiva e nullable: nessun codice esistente le legge, i profili storici
-- restano NULL (paese ignoto, non inventato). Scritte best-effort dal register
-- (app/api/auth) con un UPDATE separato DOPO l'INSERT: se la migration non è
-- applicata l'UPDATE fallisce in silenzio e il signup non cambia.
--   signup_country    ISO 3166-1 alpha-2 da x-vercel-ip-country (header della piattaforma)
--   signup_region     codice regione da x-vercel-ip-country-region
--   signup_city       città da x-vercel-ip-city (decodificata, max 80)
--   signup_session_id session_id del beacon analytics, SOLO con consenso cookie
--                     accettato: unisce la registrazione agli eventi della sessione.
-- Rollback:
--   ALTER TABLE profiles DROP COLUMN IF EXISTS signup_country,
--     DROP COLUMN IF EXISTS signup_region, DROP COLUMN IF EXISTS signup_city,
--     DROP COLUMN IF EXISTS signup_session_id;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signup_country TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signup_region TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signup_city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signup_session_id TEXT;
