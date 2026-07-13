-- #GOLIVE-QW-C · GATED: applicare solo con APPROVE (audit go-live 2026-07-13)
--
-- Hardening delle RPC di claim pagamento. claim_paygate_order (20260629120000) e
-- claim_paypal_order (20260701120000) sono SECURITY DEFINER (girano da owner) e
-- promuovono un ordine pending→paid: NON devono essere invocabili da anon/
-- authenticated via PostgREST. Di default CREATE FUNCTION concede EXECUTE a PUBLIC
-- → chiunque con la anon key potrebbe chiamarle e forzare un grant senza pagamento.
-- Qui revochiamo EXECUTE da PUBLIC/anon/authenticated e lo concediamo SOLO a
-- service_role (l'unico ruolo che il backend usa per il callback).
--
-- REVOKE/GRANT su funzione richiede la firma ESATTA degli argomenti:
--   claim_paygate_order(p_id uuid, p_value numeric, p_txid   text) → (uuid, numeric, text)
--   claim_paypal_order (p_id uuid, p_value numeric, p_capture text) → (uuid, numeric, text)
-- Idempotente: REVOKE/GRANT sono ri-eseguibili senza effetti collaterali.

REVOKE EXECUTE ON FUNCTION public.claim_paygate_order(uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_paygate_order(uuid, numeric, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_paypal_order(uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_paypal_order(uuid, numeric, text)
  TO service_role;

-- Rollback (ripristina il default permissivo — sconsigliato):
-- GRANT EXECUTE ON FUNCTION public.claim_paygate_order(uuid, numeric, text) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.claim_paypal_order(uuid, numeric, text)  TO PUBLIC;
