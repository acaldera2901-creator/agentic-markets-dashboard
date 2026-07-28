-- #WEEKLY-CRYPTO-DIRECT-1: la Weekly Pick sul rail crypto DIRETTO (l'utente invia
-- le monete che ha già, verifica on-chain), come i piani da #CRYPTO-DIRECT-1.
--
-- Perché qui e non in paygate_orders, dove vivono gli ordini crypto dei piani:
-- `paygate_orders.plan` e `paygate_orders.period` sono NOT NULL, quindi un ordine
-- della Weekly Pick richiederebbe di scriverci un piano finto — e la prima passata
-- di /api/cron/paygate-reconcile lo pescherebbe come abbonamento da concedere,
-- regalando un piano a chi ha comprato una schedina. weekly_pick_orders ha già il
-- suo claim atomico (claim_weekly_pick_order), che è la parte difficile.
--
-- Colonne identiche a quelle che 20260725190000_crypto_direct.sql aggiunse a
-- paygate_orders:
--   coin                = moneta/rete scelta (NULL = rail carta→USDC esistente)
--   expected_value_coin = quanto DEVE arrivare, nella moneta (da convert.php)
--   crypto_address_in   = indirizzo di deposito dedicato all'ordine: è la chiave
--                         con cui la catena dice se QUESTO ordine è stato pagato
-- Additive e nullable: gli ordini del rail hosted restano validi e il suo callback
-- non cambia comportamento.
ALTER TABLE public.weekly_pick_orders
  ADD COLUMN IF NOT EXISTS coin                TEXT,
  ADD COLUMN IF NOT EXISTS expected_value_coin NUMERIC(38,18),
  ADD COLUMN IF NOT EXISTS crypto_address_in   TEXT;

-- Il polling della pagina e il cron cercano gli ordini crypto pendenti.
CREATE INDEX IF NOT EXISTS idx_weekly_pick_orders_coin_pending
  ON public.weekly_pick_orders (coin, status, created_at DESC)
  WHERE coin IS NOT NULL;
