-- Durable receipt of provider refunds, including delivery before the commission.
-- Does not send money. Manual reversals keep their existing immediate semantics.
CREATE TABLE IF NOT EXISTS public.affiliate_reversal_inbox (
  id bigserial PRIMARY KEY,
  rail text NOT NULL CHECK (rail IN ('shopify','stripe','paygate','paypal','crypto','admin')),
  payment_ref text NOT NULL,
  event_ref text NOT NULL,
  refunded_usd numeric,
  clawback_days integer NOT NULL CHECK (clawback_days >= 0),
  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  result jsonb,
  UNIQUE (rail, payment_ref, event_ref)
);
ALTER TABLE public.affiliate_reversal_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affiliate_reversal_inbox FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.affiliate_reversal_inbox TO service_role;
CREATE INDEX IF NOT EXISTS affiliate_reversal_inbox_pending
  ON public.affiliate_reversal_inbox (rail, payment_ref, id) WHERE completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.affiliate_receive_reversal(
  p_rail text, p_ref text, p_event text, p_refunded numeric, p_clawback_days integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE e public.affiliate_reversal_inbox; r jsonb;
BEGIN
  IF coalesce(trim(p_ref),'') = '' OR coalesce(trim(p_event),'') = '' THEN
    RETURN jsonb_build_object('ok',true,'written',false,'reason','missing_ref');
  END IF;
  IF p_refunded IS NOT NULL AND (p_refunded <= 0 OR p_refunded::text IN ('NaN','Infinity','-Infinity')) THEN
    RETURN jsonb_build_object('ok',true,'written',false,'reason','zero_refund');
  END IF;
  INSERT INTO affiliate_reversal_inbox(rail,payment_ref,event_ref,refunded_usd,clawback_days)
    VALUES(p_rail,p_ref,p_event,p_refunded,p_clawback_days)
    ON CONFLICT (rail,payment_ref,event_ref) DO NOTHING;
  SELECT * INTO STRICT e FROM affiliate_reversal_inbox
    WHERE rail=p_rail AND payment_ref=p_ref AND event_ref=p_event FOR UPDATE;
  IF e.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok',true,'written',false,'reason','duplicate');
  END IF;
  -- The first received payload is immutable, including across retries.
  r := affiliate_reverse_commission(e.rail,e.payment_ref,e.event_ref,e.refunded_usd,e.clawback_days);
  IF r->>'reason' = 'no_commission' THEN
    RETURN jsonb_build_object('ok',true,'written',false,'reason','deferred');
  END IF;
  UPDATE affiliate_reversal_inbox SET completed_at=now(),result=r WHERE id=e.id;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.affiliate_replay_reversals(p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE e record; r jsonb; n integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN RAISE EXCEPTION 'invalid replay limit'; END IF;
  -- Ignore unrelated payments without a commission so they cannot starve work.
  FOR e IN SELECT i.* FROM affiliate_reversal_inbox i
    JOIN affiliate_commissions c ON c.rail=i.rail AND c.rail_payment_ref=i.payment_ref AND c.kind IN ('first','renewal')
    WHERE i.completed_at IS NULL
    ORDER BY c.affiliate_id, i.id LIMIT p_limit FOR UPDATE OF i SKIP LOCKED
  LOOP
    r := affiliate_receive_reversal(e.rail,e.payment_ref,e.event_ref,e.refunded_usd,e.clawback_days);
    IF r->>'reason' <> 'deferred' THEN n := n+1; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'processed',n);
END $$;
REVOKE ALL ON FUNCTION public.affiliate_receive_reversal(text,text,text,numeric,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.affiliate_replay_reversals(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_receive_reversal(text,text,text,numeric,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_replay_reversals(integer) TO service_role;

-- Never mature a commission while a previously received refund is pending replay.
CREATE OR REPLACE FUNCTION public.affiliate_mature_commissions()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  -- Preserve the established affiliate lock order and refresh the UPDATE snapshot.
  PERFORM 1 FROM public.affiliates WHERE status = 'active' ORDER BY id FOR UPDATE;
  UPDATE public.affiliate_commissions c SET status = 'payable'
  FROM public.affiliates a, public.affiliate_attributions t
  WHERE c.affiliate_id = a.id AND a.status = 'active'
    AND t.affiliate_id = a.id AND t.referred_identifier = c.referred_identifier AND t.status = 'valid'
    AND c.status = 'pending' AND c.payable_after <= now() AND c.payout_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM affiliate_reversal_inbox i
      WHERE i.rail=c.rail AND i.payment_ref=c.rail_payment_ref AND i.completed_at IS NULL);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok',true,'matured',n);
END $$;
