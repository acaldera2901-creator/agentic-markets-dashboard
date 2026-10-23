-- #AFFILIATE-REVERSE-AUDIT-1022 — lo storno manuale entra nel registro azioni.
--
-- Review indipendente 22/10 #9: POST /api/admin/affiliate/reverse era un'azione
-- monetaria anonima (cookie o Bearer, nessuna riga in affiliate_admin_actions).
-- Ora la rotta passa per affiliate_admin_reverse_commission: stesso storno di
-- affiliate_reverse_commission (nessuna logica duplicata) e, nella STESSA
-- transazione, una riga `commission_reversed` con l'operatore e l'esito — quando
-- lo storno è stato scritto O quando l'evento è stato registrato a quota zero
-- (`zero_amount`: entra nel cumulato di 20261022150000, review 2 P2-4). Un replay
-- `duplicate` o un rifiuto senza effetto non aggiungono righe. Gli storni dei
-- webhook (nessun operatore) restano come sono.
--
-- ADDITIVA: allarga il CHECK di affiliate_admin_actions.action e aggiunge una
-- funzione. Dipende da 20261022130000 (tabella) e 20261022150000 (storno sul
-- cumulato); si applica DOPO 20261022150000. Idempotente.
-- Rollback: scripts/affiliate-v2/rollback_reverse_audit_1022.sql.

ALTER TABLE public.affiliate_admin_actions DROP CONSTRAINT IF EXISTS affiliate_admin_actions_action_check;
ALTER TABLE public.affiliate_admin_actions ADD CONSTRAINT affiliate_admin_actions_action_check
  CHECK (action IN ('wallet_screened','affiliate_status','attribution_reviewed',
                    'payout_marked_sent','payout_unmarked_sent','commission_reversed'));

CREATE OR REPLACE FUNCTION public.affiliate_admin_reverse_commission(
  p_actor          text,
  p_rail           text,
  p_ref            text,
  p_event          text,
  p_refunded       numeric,
  p_clawback_days  integer
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r      jsonb;
  v_aff  bigint;
BEGIN
  IF coalesce(length(trim(p_actor)), 0) < 2 THEN
    RAISE EXCEPTION 'affiliate_admin_reverse_commission: actor required';
  END IF;
  r := affiliate_reverse_commission(p_rail, p_ref, p_event, p_refunded, p_clawback_days);
  IF (r->>'written')::boolean IS TRUE OR r->>'reason' = 'zero_amount' THEN
    SELECT affiliate_id INTO v_aff FROM affiliate_commissions
     WHERE rail = p_rail AND rail_payment_ref = p_ref AND kind IN ('first','renewal');
    INSERT INTO affiliate_admin_actions (actor, action, affiliate_id, target, detail)
    VALUES (p_actor, 'commission_reversed', v_aff, p_rail || ':' || p_ref,
            jsonb_build_object('event_ref', p_event, 'refunded_usd', p_refunded,
                               'written', r->'written', 'amount', r->'amount',
                               'reason', r->'reason', 'status', r->'status'));
  END IF;
  RETURN r;
END $$;

REVOKE EXECUTE ON FUNCTION public.affiliate_admin_reverse_commission(text, text, text, text, numeric, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_reverse_commission(text, text, text, text, numeric, integer) TO service_role;
