-- scripts/affiliate-v2/rollback_ops_1022.sql — #AFFILIATE-OPS-1022
-- Annulla 20261022130000_affiliate_v2_ops.sql. NON è una migration: a mano, con
-- APPROVE, sulla connessione diretta:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
--        -c "SET lock_timeout = '5s'" -f scripts/affiliate-v2/rollback_ops_1022.sql
-- poi: supabase migration repair --status reverted 20261022130000 --linked
--
-- Cosa resta: il registro affiliate_admin_actions (NON si cancella: è la prova
-- di chi ha deciso cosa; si toglie solo l'accesso) e le colonne nuove (vuote o
-- no, non fanno danno al codice precedente). Le decisioni 'blocked' tornano
-- 'not_screened' (il vincolo vecchio non le ammette): restano non pagabili.
-- Le funzioni ridefinite tornano alla versione di 20261015120000/130000
-- rieseguendo quelle due migration (idempotenti) DOPO questo file.

UPDATE public.affiliate_wallets SET screening_result = 'not_screened' WHERE screening_result = 'blocked';
ALTER TABLE public.affiliate_wallets DROP CONSTRAINT IF EXISTS affiliate_wallets_blocked_needs_time;
ALTER TABLE public.affiliate_wallets DROP CONSTRAINT IF EXISTS affiliate_wallets_manual_has_who_why;
ALTER TABLE public.affiliate_wallets DROP CONSTRAINT IF EXISTS affiliate_wallets_screening_result;
ALTER TABLE public.affiliate_wallets ADD CONSTRAINT affiliate_wallets_screening_result
  CHECK (screening_result IN ('clear','not_screened'));
ALTER TABLE public.affiliate_payouts DROP CONSTRAINT IF EXISTS affiliate_payouts_mark_has_who;

DROP FUNCTION IF EXISTS public.affiliate_screen_wallet(bigint, text, text, text);
DROP FUNCTION IF EXISTS public.affiliate_set_status(bigint, text, text, text);
DROP FUNCTION IF EXISTS public.affiliate_review_attribution(text, text, text, text);
DROP FUNCTION IF EXISTS public.affiliate_payout_mark_sent(bigint, text);
DROP FUNCTION IF EXISTS public.affiliate_payout_unmark_sent(bigint, text, text);

REVOKE ALL ON public.affiliate_admin_actions FROM service_role;
