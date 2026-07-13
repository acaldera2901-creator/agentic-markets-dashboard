-- #GOLIVE-QW-C · GATED: applicare solo con APPROVE (audit go-live 2026-07-13)
--
-- Backfill delle tabelle della Weekly Pick (#WEEKLY-PICK-1). La feature è dormiente
-- (WEEKLY_PICK_ENABLED=false) e il codice che le usa esiste già in main ma le
-- tabelle non risultano in nessuna migration versionata → il repo non è la fonte
-- di verità per il recovery. Additiva + idempotente (CREATE TABLE IF NOT EXISTS),
-- speculare a paygate_orders/paypal_orders. Colonne derivate DAL CODICE:
--   • weekly_pick          → app/api/weekly-pick/generate/route.ts + route.ts + history/route.ts
--   • weekly_pick_orders   → app/api/weekly-pick/checkout/route.ts + callback/route.ts
--   • weekly_pick_purchases→ lib/weekly-pick-server.ts (hasWeeklyPick / grantWeeklyPick)
-- RLS: operator/service-role only (nessuna policy → nega anon/authenticated), come
-- paypal_orders. NB: la RPC atomica claim_weekly_pick_order (referenziata dal
-- callback) NON è creata qui — è fuori scope di questo quickwin e va tracciata a
-- parte prima del go-live della feature.

-- ── Multipla della casa della settimana (una riga per week_start) ────────────
CREATE TABLE IF NOT EXISTS public.weekly_pick (
  week_start     DATE PRIMARY KEY,                 -- ON CONFLICT (week_start) in generate
  selections     JSONB NOT NULL,                   -- array leg (JSON.stringify lato app)
  combined_prob  NUMERIC(6,4),                      -- prob combinata (.toFixed(4))
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW() -- SET created_at = NOW() sull'update
);

-- ── Ordini one-off (rail PayGate carta→USDC, speculare a paygate_orders) ─────
CREATE TABLE IF NOT EXISTS public.weekly_pick_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier          TEXT NOT NULL,
  week_start          DATE NOT NULL,
  amount_usd          NUMERIC(10,2) NOT NULL,
  token_hash          TEXT NOT NULL UNIQUE,        -- lookup callback: WHERE token_hash = $1
  polygon_address_in  TEXT,                         -- SET dopo wallet.php
  ipn_token           TEXT,                         -- serve al callback per checkPaymentStatus
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','paid','expired')),
  value_coin          NUMERIC(20,6),                -- valorizzato dal claim atomico (RPC)
  txid_out            TEXT,                         -- idem
  granted_at          TIMESTAMPTZ,                  -- SET granted_at = NOW() dopo il grant
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at             TIMESTAMPTZ                   -- valorizzato dal claim atomico (RPC)
);

CREATE INDEX IF NOT EXISTS idx_weekly_pick_orders_identifier
  ON public.weekly_pick_orders (identifier);

-- ── Entitlement per-settimana (idempotente via UNIQUE + ON CONFLICT) ─────────
CREATE TABLE IF NOT EXISTS public.weekly_pick_purchases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier        TEXT NOT NULL,
  week_start        DATE NOT NULL,
  order_token_hash  TEXT,                           -- lega l'entitlement all'ordine
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (identifier, week_start)                   -- ON CONFLICT (identifier, week_start) DO NOTHING
);

-- ── RLS: operator/service-role only su tutte e tre ───────────────────────────
ALTER TABLE public.weekly_pick           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_pick_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_pick_purchases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.weekly_pick           FROM anon, authenticated;
REVOKE ALL ON public.weekly_pick_orders    FROM anon, authenticated;
REVOKE ALL ON public.weekly_pick_purchases FROM anon, authenticated;

-- Rollback:
-- DROP TABLE IF EXISTS public.weekly_pick_purchases;
-- DROP TABLE IF EXISTS public.weekly_pick_orders;
-- DROP TABLE IF EXISTS public.weekly_pick;
