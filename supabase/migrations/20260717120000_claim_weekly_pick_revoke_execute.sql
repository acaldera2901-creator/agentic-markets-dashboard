-- #GOLIVE-RESTA-0717 · GATED: applicare solo con APPROVE (follow-up di #GOLIVE-QW-C)
--
-- Estende alla weekly-pick l'hardening già applicato in 20260713150003 a
-- claim_paygate_order/claim_paypal_order. La RPC claim_weekly_pick_order è stata
-- creata da db/migrations/014_weekly_pick.sql (applicata a prod, verificata da
-- Andrea 2026-07-16) SENZA revoca: CREATE FUNCTION concede EXECUTE a PUBLIC di
-- default e la funzione è SECURITY DEFINER → chiunque con la anon key può
-- invocarla via PostgREST e forzare un ordine weekly-pick pending→paid senza
-- pagamento. La 20260713150003 non la copriva perché al 13/07 la RPC risultava
-- non ancora creata (header stale della 014, corretto il 16/07).
--
-- REVOKE/GRANT su funzione richiede la firma ESATTA degli argomenti:
--   claim_weekly_pick_order(p_id uuid, p_value numeric, p_txid text) → (uuid, numeric, text)
-- Idempotente: REVOKE/GRANT sono ri-eseguibili senza effetti collaterali.

REVOKE EXECUTE ON FUNCTION public.claim_weekly_pick_order(uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_weekly_pick_order(uuid, numeric, text)
  TO service_role;

-- Rollback (ripristina il default permissivo — sconsigliato):
-- GRANT EXECUTE ON FUNCTION public.claim_weekly_pick_order(uuid, numeric, text) TO PUBLIC;
