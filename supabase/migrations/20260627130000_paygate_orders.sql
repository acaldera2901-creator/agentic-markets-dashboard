-- Ordini PayGate.to (#PAYGATE-PAY). Additiva + idempotente.
-- token_hash = sha256 del token random per-ordine presente nel callback URL
-- (anti-spoof: il callback PayGate non è firmato). Si salva SOLO l'hash.

CREATE TABLE IF NOT EXISTS public.paygate_orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier         TEXT NOT NULL,
  plan               TEXT NOT NULL CHECK (plan IN ('base','premium')),
  period             TEXT NOT NULL CHECK (period IN ('monthly','annual')),
  amount_usd         NUMERIC(10,2) NOT NULL,
  token_hash         TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
  value_coin         NUMERIC(20,6),
  txid_out           TEXT,
  polygon_address_in TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_paygate_orders_identifier ON public.paygate_orders (identifier);

-- Operator/service-role only: nessuna policy → nega anon/authenticated.
ALTER TABLE public.paygate_orders ENABLE ROW LEVEL SECURITY;

-- Rollback:
-- DROP TABLE IF EXISTS public.paygate_orders;
