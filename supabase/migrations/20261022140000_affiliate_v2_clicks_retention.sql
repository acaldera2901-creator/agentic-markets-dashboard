-- #AFFILIATE-CLICKS-RETENTION-1022 — pulizia a 90 giorni di affiliate_referral_clicks.
--
-- I click su /r/CODE (lib/affiliate/clicks.ts) portano, con AFFILIATE_HASH_SECRET
-- impostato, un HMAC dell'IP+giorno e dello user-agent. La Privacy §11 dichiara
-- «These records are deleted after 90 days» (paragrafo pubblicato solo col
-- segreto): questa funzione è ciò che lo rende vero. Cancella la RIGA intera,
-- non solo gli hash: il click serve solo come metrica recente (export
-- `clicks_30d`), un conteggio storico senza hash non ha uso.
--
-- La chiama il cron giornaliero GET /api/cron/affiliate-clicks-retention
-- (CRON_SECRET). Idempotente: un secondo giro nello stesso istante cancella 0.
--
-- NON si applica da sola: PROPOSAL #AFFILIATE-PLATFORM-1022, ordine dopo
-- 20261022130000. Rollback: scripts/affiliate-v2/rollback_clicks_retention_1022.sql
-- (DROP della funzione; le righe già cancellate non tornano — è lo scopo).

CREATE OR REPLACE FUNCTION public.affiliate_purge_clicks()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.affiliate_referral_clicks WHERE clicked_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'purged', n, 'retention_days', 90);
END $$;

REVOKE ALL ON FUNCTION public.affiliate_purge_clicks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_purge_clicks() TO service_role;
