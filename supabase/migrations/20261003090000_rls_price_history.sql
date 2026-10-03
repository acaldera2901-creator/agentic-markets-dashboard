-- #RLS-0310 — row level security sulle tre tabelle storiche dei prezzi.
--
-- Perche': create senza RLS (anchor_price_history con la migration 20260917140000,
-- partner_price_history e ah_odds_history prima). Verificato il 03/10: i ruoli
-- `anon` e `authenticated` NON avevano alcun privilegio su queste tabelle, quindi
-- non erano raggiungibili dall'API pubblica: questa e' difesa in profondita',
-- non la chiusura di un buco aperto.
--
-- Effetto: ENABLE senza policy = nessun accesso per i ruoli soggetti a RLS
-- (anon, authenticated). Non cambia nulla per l'app e gli agenti: usano `postgres`
-- (proprietario delle tabelle, BYPASSRLS) e `exec_sql` e' SECURITY DEFINER dello
-- stesso proprietario. NON si usa FORCE ROW LEVEL SECURITY: forzerebbe la RLS
-- anche sul proprietario e romperebbe i writer.
--
-- Applicata a mano il 03/10 con APPROVE di Andrea; questo file la rende
-- riproducibile (idempotente). Rollback: ALTER TABLE ... DISABLE ROW LEVEL SECURITY.

ALTER TABLE IF EXISTS public.anchor_price_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.partner_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ah_odds_history       ENABLE ROW LEVEL SECURITY;
