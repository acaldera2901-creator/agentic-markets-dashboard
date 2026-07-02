-- supabase/migrations/20260701120000_paypal_orders.sql
-- Ordini PayPal/Apple Pay (#PAYPAL-PAY). Additiva + idempotente.
-- Speculare a paygate_orders. paypal_order_id = id dell'ordine PayPal (non segreto,
-- ma tracciato per riconciliazione via webhook custom_id).

CREATE TABLE IF NOT EXISTS public.paypal_orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier         TEXT NOT NULL,
  plan               TEXT NOT NULL CHECK (plan IN ('base','premium')),
  period             TEXT NOT NULL CHECK (period IN ('monthly','annual')),
  amount_usd         NUMERIC(10,2) NOT NULL,
  paypal_order_id    TEXT UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
  value_captured     NUMERIC(20,6),
  capture_id         TEXT,
  granted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_paypal_orders_identifier ON public.paypal_orders (identifier);

-- Operator/service-role only: nessuna policy → nega anon/authenticated.
ALTER TABLE public.paypal_orders ENABLE ROW LEVEL SECURITY;

-- Claim ATOMICO: un solo capture/webhook "vince" pending→paid. Ritorna TRUE solo
-- se ha davvero cambiato la riga (exec_sql non dà il row-count → RPC dedicata).
CREATE OR REPLACE FUNCTION public.claim_paypal_order(p_id uuid, p_value numeric, p_capture text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.paypal_orders
     SET status = 'paid', value_captured = p_value, capture_id = p_capture, paid_at = NOW()
   WHERE id = p_id AND status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.claim_paypal_order(uuid, numeric, text);
-- DROP TABLE IF EXISTS public.paypal_orders;
