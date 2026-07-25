-- #CRYPTO-DIRECT-1: pagamento crypto DIRETTO (l'utente invia le monete che ha già,
-- invece di comprarle con carta sulla pagina PayGate).
-- Riusa paygate_orders invece di una tabella nuova: identifier/plan/period/amount,
-- il claim atomico anti-doppio-grant (claim_paygate_order) e la reconcile esistono
-- già e valgono identici. Le colonne nuove distinguono i due rail e portano ciò
-- che serve alla verifica ON-CHAIN.
--   coin                = quale moneta/rete ha scelto l'utente (NULL = rail carte)
--   expected_value_coin = quanto DEVE arrivare, nella moneta (da PayGate convert.php)
--   crypto_address_in   = indirizzo di deposito dedicato all'ordine: è la chiave
--                         con cui la catena ci dice se QUESTO ordine è stato pagato
ALTER TABLE public.paygate_orders
  ADD COLUMN IF NOT EXISTS coin                TEXT,
  ADD COLUMN IF NOT EXISTS expected_value_coin NUMERIC(38,18),
  ADD COLUMN IF NOT EXISTS crypto_address_in   TEXT;

-- La reconcile e il polling cercano gli ordini crypto pendenti.
CREATE INDEX IF NOT EXISTS idx_paygate_orders_coin_pending
  ON public.paygate_orders (coin, status, created_at DESC)
  WHERE coin IS NOT NULL;
