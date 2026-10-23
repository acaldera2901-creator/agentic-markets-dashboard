-- scripts/affiliate-v2/rollback_reverse_audit_1022.sql — #AFFILIATE-REVERSE-AUDIT-1022
-- Annulla 20261022160000_affiliate_v2_reverse_audit.sql. NON è una migration:
-- a mano, con APPROVE, sulla connessione diretta:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
--        -c "SET lock_timeout = '5s'" -f scripts/affiliate-v2/rollback_reverse_audit_1022.sql
-- poi: supabase migration repair --status reverted 20261022160000 --linked
--
-- PRIMA il codice: la rotta POST /api/admin/affiliate/reverse del commit che
-- introduce questa migration chiama affiliate_admin_reverse_commission; senza la
-- funzione risponde 503 (storno non scritto, alert ops). Rollback del codice
-- (promote del deploy precedente / revert) → poi questo file.
--
-- Le righe `commission_reversed` già scritte restano (registro append-only): il
-- CHECK vecchio torna NOT VALID, cioè vale per le righe nuove e non per quelle.
-- Da eseguire PRIMA di rollback_ops_1022.sql se si annulla anche quello.
DROP FUNCTION IF EXISTS public.affiliate_admin_reverse_commission(text, text, text, text, numeric, integer);
ALTER TABLE public.affiliate_admin_actions DROP CONSTRAINT IF EXISTS affiliate_admin_actions_action_check;
ALTER TABLE public.affiliate_admin_actions ADD CONSTRAINT affiliate_admin_actions_action_check
  CHECK (action IN ('wallet_screened','affiliate_status','attribution_reviewed',
                    'payout_marked_sent','payout_unmarked_sent')) NOT VALID;
