-- scripts/affiliate-v2/rollback_clicks_retention_1022.sql — #AFFILIATE-CLICKS-RETENTION-1022
-- Annulla 20261022140000_affiliate_v2_clicks_retention.sql. NON è una migration:
-- a mano, con APPROVE, sulla connessione diretta:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f scripts/affiliate-v2/rollback_clicks_retention_1022.sql
-- poi: supabase migration repair --status reverted 20261022140000 --linked
-- Togliere anche il cron /api/cron/affiliate-clicks-retention da vercel.json
-- (altrimenti risponde 503 ogni giorno). Le righe già cancellate non tornano.
-- ⚠ Con AFFILIATE_HASH_SECRET impostato la Privacy promette la cancellazione a
-- 90 giorni: niente rollback finché il segreto c'è.
DROP FUNCTION IF EXISTS public.affiliate_purge_clicks();
