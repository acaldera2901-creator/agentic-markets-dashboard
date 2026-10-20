-- scripts/affiliate-v2/rollback_gate_b.sql — #AFFILIATE-V2-APPLY-1015, rollback del gate B.
--
-- Annulla le 4 migration affiliate_v2 (20261007120000, 20261015120000,
-- 20261015130000, 20261020150000) SOLO finché le 7 tabelle sono VUOTE: con anche una sola riga
-- (iscrizioni, wallet, ledger, payout) si ferma con un errore e non tocca niente.
-- Dopo il primo `paid` affiliate_payouts e affiliate_commissions sono registri
-- contabili: lì il rollback è l'env (AFFILIATE_PAYOUTS=off / AFFILIATE_MODE=off),
-- non un DROP.
--
-- NON è una migration (sta fuori da supabase/migrations apposta): si esegue a
-- mano, con APPROVE, sulla connessione diretta / session pooler (porta 5432):
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
--        -c "SET lock_timeout = '5s'" -f scripts/affiliate-v2/rollback_gate_b.sql
-- e poi, SOLO per le nostre 4 versioni:
--   supabase migration repair --status reverted 20261007120000 20261015120000 20261015130000 20261020150000 --linked
--
-- NON tocca l'indice uq_profiles_referral_code: in prod esisteva prima del gate B.

DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['affiliates','affiliate_referral_clicks','affiliate_attributions','affiliate_wallets',
                           'affiliate_payouts','affiliate_commissions','affiliate_payer_fingerprints'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN
        RAISE EXCEPTION 'rollback gate B rifiutato: public.% ha % righe (serve export e decisione legale)', t, n;
      END IF;
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_affiliates_status_cancel_payouts ON public.affiliates;

DROP FUNCTION IF EXISTS public.affiliate_mature_commissions();
DROP FUNCTION IF EXISTS public.affiliate_on_status_change();
DROP FUNCTION IF EXISTS public.affiliate_payout_drop_tx(bigint, text);
DROP FUNCTION IF EXISTS public.affiliate_cancel_payout(bigint, text);
DROP FUNCTION IF EXISTS public.affiliate_payout_record_tx(bigint, text, boolean, numeric, bigint, bigint, text);
DROP FUNCTION IF EXISTS public.affiliate_create_payouts(bigint[], date, numeric, numeric, boolean, text[], text[], text);
DROP FUNCTION IF EXISTS public.affiliate_payout_rows(date, numeric, boolean, text[], text[]);
DROP FUNCTION IF EXISTS public.affiliate_revoke_wallet(bigint);
DROP FUNCTION IF EXISTS public.affiliate_set_wallet(bigint, text, text, text, text, text, text, text, text, boolean, text, boolean);
DROP FUNCTION IF EXISTS public.affiliate_cancel_created_payouts(bigint, text, text);

-- Ordine per le FK: il ledger referenzia payouts, payouts referenzia wallets,
-- tutti referenziano affiliates.
DROP TABLE IF EXISTS public.affiliate_commissions;
DROP TABLE IF EXISTS public.affiliate_payouts;
DROP TABLE IF EXISTS public.affiliate_wallets;
DROP TABLE IF EXISTS public.affiliate_attributions;
DROP TABLE IF EXISTS public.affiliate_referral_clicks;
DROP TABLE IF EXISTS public.affiliate_payer_fingerprints;
DROP TABLE IF EXISTS public.affiliates;
