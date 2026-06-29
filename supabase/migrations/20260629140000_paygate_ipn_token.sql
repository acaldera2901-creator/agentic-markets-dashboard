-- #PAYGATE-PREFLIGHT-0629 finding #1 (autenticità): salva ipn_token sull'ordine
-- per poter verificare l'esito reale lato server (payment-status.php) nel callback.
ALTER TABLE public.paygate_orders ADD COLUMN IF NOT EXISTS ipn_token TEXT;
-- Rollback: ALTER TABLE public.paygate_orders DROP COLUMN IF EXISTS ipn_token;
