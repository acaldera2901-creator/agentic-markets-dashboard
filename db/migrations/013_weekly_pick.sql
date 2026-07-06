-- 013_weekly_pick.sql — #WEEKLY-PICK-1 (item 2). Additiva + idempotente.
-- ⚠️ NON ANCORA APPLICATA a prod: attende allineamento Michele + APPROVE
-- ch_deploy_gate (tocca pagamenti). Applicare con lo stesso processo di 012.
--
-- La "Weekly Pick" è la MULTIPLA DELLA CASA: le migliori pick della settimana
-- combinate (schedina più probabile del modello). Venduta ONE-OFF a chi non è
-- Pro (Free/Base) a €12.99; INCLUSA nel Pro (gating a runtime, non qui).
--
-- Scelta di design: tabella d'ordine ISOLATA (weekly_pick_orders), NON riuso di
-- paygate_orders — quest'ultima ha plan/period NOT NULL CHECK(base|premium) e un
-- ordine one-off senza piano/periodo non ci sta senza allentarne i vincoli (la
-- tabella pagamenti live resta intatta). Stessa meccanica anti-spoof: token_hash
-- monouso + ipn_token per la verifica server-side dell'esito reale presso PayGate.

-- Contenuto: UNA multipla per settimana (week_start = lunedì UTC).
CREATE TABLE IF NOT EXISTS public.weekly_pick (
  week_start    DATE PRIMARY KEY,
  selections    JSONB NOT NULL,                 -- snapshot [{id,label,market,sport,when,prob}]
  combined_prob NUMERIC(6,4) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ordini one-off della weekly pick (mirror di paygate_orders, isolato).
CREATE TABLE IF NOT EXISTS public.weekly_pick_orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier         TEXT NOT NULL,
  week_start         DATE NOT NULL,
  amount_usd         NUMERIC(10,2) NOT NULL,
  token_hash         TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
  value_coin         NUMERIC(20,6),
  txid_out           TEXT,
  polygon_address_in TEXT,
  ipn_token          TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at            TIMESTAMPTZ,
  granted_at         TIMESTAMPTZ            -- riconciliazione: paid con NULL = pagato ma non concesso
);
CREATE INDEX IF NOT EXISTS idx_weekly_pick_orders_identifier ON public.weekly_pick_orders (identifier);

-- Claim ATOMICO (gemello di claim_paygate_order): un solo callback vince
-- pending→paid. Ritorna TRUE solo se ha cambiato la riga → il grant parte solo
-- sul vincitore della race (exec_sql non dà il row-count → RPC dedicata).
CREATE OR REPLACE FUNCTION public.claim_weekly_pick_order(p_id uuid, p_value numeric, p_txid text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.weekly_pick_orders
     SET status = 'paid', value_coin = p_value, txid_out = p_txid, paid_at = NOW()
   WHERE id = p_id AND status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

-- Entitlement: chi ha acquistato la weekly pick di una data settimana.
CREATE TABLE IF NOT EXISTS public.weekly_pick_purchases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier       TEXT NOT NULL,
  week_start       DATE NOT NULL,
  order_token_hash TEXT,                         -- lega all'ordine (idempotenza)
  purchased_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (identifier, week_start)                -- un acquisto per utente/settimana
);
CREATE INDEX IF NOT EXISTS idx_weekly_pick_purchases_identifier ON public.weekly_pick_purchases (identifier);

-- Operator/service-role only: nessuna policy → nega anon/authenticated (come paygate_orders).
ALTER TABLE public.weekly_pick          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_pick_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_pick_purchases ENABLE ROW LEVEL SECURITY;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.claim_weekly_pick_order(uuid, numeric, text);
-- DROP TABLE IF EXISTS public.weekly_pick_purchases;
-- DROP TABLE IF EXISTS public.weekly_pick_orders;
-- DROP TABLE IF EXISTS public.weekly_pick;
