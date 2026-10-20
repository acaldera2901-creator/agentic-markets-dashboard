-- Commission maturity only: does not send money or convert shadow rows.
CREATE OR REPLACE FUNCTION public.affiliate_mature_commissions()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  UPDATE public.affiliate_commissions c SET status = 'payable'
  FROM public.affiliates a, public.affiliate_attributions t
  WHERE c.affiliate_id = a.id AND a.status = 'active'
    AND t.affiliate_id = a.id AND t.referred_identifier = c.referred_identifier AND t.status = 'valid'
    AND c.status = 'pending' AND c.payable_after <= now() AND c.payout_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'matured', n);
END $$;
REVOKE ALL ON FUNCTION public.affiliate_mature_commissions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_mature_commissions() TO service_role;
