-- #PAYGATE-PREFLIGHT-0629 finding #2/#3 — claim atomico + riconciliazione.
-- granted_at: marcatore di riconciliazione. paid con granted_at NULL = pagato ma
-- piano NON concesso (identifier-not-found / grant fallito) → da riconciliare.
ALTER TABLE public.paygate_orders ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ;

-- Claim ATOMICO e verificabile (finding #3 race): un solo callback "vince" il
-- passaggio pending→paid. Ritorna TRUE solo se ha davvero cambiato la riga, così
-- il grant parte solo sul vincitore della race (exec_sql non dà il row-count → RPC dedicata).
CREATE OR REPLACE FUNCTION public.claim_paygate_order(p_id uuid, p_value numeric, p_txid text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.paygate_orders
     SET status = 'paid', value_coin = p_value, txid_out = p_txid, paid_at = NOW()
   WHERE id = p_id AND status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.claim_paygate_order(uuid, numeric, text);
-- ALTER TABLE public.paygate_orders DROP COLUMN IF EXISTS granted_at;
