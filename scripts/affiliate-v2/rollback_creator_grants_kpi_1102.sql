-- scripts/affiliate-v2/rollback_creator_grants_kpi_1102.sql — #CREATOR-OFFERS-1031 (B)
-- Annulla 20261102120000_affiliate_v2_creator_grants_kpi.sql. NON è una migration:
-- a mano, con APPROVE, sulla connessione diretta:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f scripts/affiliate-v2/rollback_creator_grants_kpi_1102.sql
-- poi: supabase migration repair --status reverted 20261102120000 --linked
-- Prima: revert del codice (le rotte creator-grants / creators / cohort leggono questi oggetti).
--
-- Si ferma se creator_grants o affiliate_click_months hanno righe: la prima è il
-- registro di chi ha avuto il mese Pro (i profili restano premium fino a
-- scadenza, il rollback non li tocca), la seconda è storia dei click non più
-- ricostruibile. Con righe: export prima, poi decidere.
DO $$
DECLARE t text; n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['creator_grants','affiliate_click_months'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN
        RAISE EXCEPTION 'rollback 1102 rifiutato: public.% ha % righe (export prima)', t, n;
      END IF;
    END IF;
  END LOOP;
END $$;

-- La retention torna alla versione 20261022140000 (stesse righe cancellate, niente somma).
CREATE OR REPLACE FUNCTION public.affiliate_purge_clicks()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.affiliate_referral_clicks WHERE clicked_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'purged', n, 'retention_days', 90);
END $$;

DROP VIEW IF EXISTS public.affiliate_creator_monthly;
DROP FUNCTION IF EXISTS public.affiliate_grant_creator_pro(text, text, text);
DROP FUNCTION IF EXISTS public.affiliate_set_cohort(bigint, text, text);
DROP TABLE IF EXISTS public.creator_grants;
DROP FUNCTION IF EXISTS public.creator_grants_append_only();
DROP TABLE IF EXISTS public.affiliate_click_months;
ALTER TABLE public.affiliates DROP COLUMN IF EXISTS cohort;
