-- scripts/affiliate-v2/rollback_creator_offers_1101.sql — #CREATOR-OFFERS-1031
-- Annulla 20261101120000_affiliate_v2_creator_offers.sql. NON è una migration:
-- a mano, con APPROVE, sulla connessione diretta:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
--        -c "SET lock_timeout = '5s'" -f scripts/affiliate-v2/rollback_creator_offers_1101.sql
-- poi: supabase migration repair --status reverted 20261101120000 --linked
--
-- PRIMA il codice (revert della PR / promote del deploy precedente): il ledger
-- del commit che introduce la migration legge affiliate_offers a ogni pagamento;
-- senza tabella la commissione non si scrive (reason "error", la recupera
-- reconcile per paygate/paypal entro 35 giorni). Senza offerte il codice
-- vecchio torna ai tassi env.
--
-- Effetti: le offerte spariscono (esportarle prima: sono la prova del tasso
-- concordato; le commissioni già scritte restano, col loro `rate`).
-- payout_channel sparisce → i creator 'manual' tornano nella coda USDT: prima
-- del rollback verificare che il loro saldo payable sia stato pagato a mano o
-- sospenderli (affiliate_set_status), altrimenti verrebbero pagati due volte.
-- Le righe 'offer_set' / 'deliverables_confirmed' restano (registro
-- append-only): il CHECK vecchio torna NOT VALID.
-- Se il workstream B (20261102*) ha ridefinito il CHECK delle azioni, annullare B PRIMA.

DROP FUNCTION IF EXISTS public.affiliate_admin_set_offer(text, bigint, jsonb, text, text);
DROP FUNCTION IF EXISTS public.affiliate_admin_confirm_deliverables(text, bigint, text, jsonb, text);
DROP TABLE IF EXISTS public.affiliate_offers;
DROP FUNCTION IF EXISTS public.affiliate_offers_append_only();

ALTER TABLE public.affiliate_admin_actions DROP CONSTRAINT IF EXISTS affiliate_admin_actions_action_check;
ALTER TABLE public.affiliate_admin_actions ADD CONSTRAINT affiliate_admin_actions_action_check
  CHECK (action IN ('wallet_screened','affiliate_status','attribution_reviewed',
                    'payout_marked_sent','payout_unmarked_sent','commission_reversed')) NOT VALID;

-- affiliate_payout_rows torna quella di 20261022130000 (senza manual_channel), poi via la colonna.
CREATE OR REPLACE FUNCTION public.affiliate_payout_rows(
  p_period       date,
  p_min          numeric,
  p_require_kyc  boolean,
  p_networks     text[],
  p_coins        text[]
) RETURNS TABLE (
  affiliate_id        bigint,
  code                text,
  status              text,
  payee_legal_name    text,
  payee_country       text,
  sanctions_declared  boolean,
  tax_declared        boolean,
  balance             numeric,
  wallet_id           bigint,
  address             text,
  coin                text,
  network             text,
  wallet_created_at   timestamptz,
  usable_after        timestamptz,
  screening_result    text,
  paid_in_year        numeric,
  payout_id           bigint,
  payout_status       text,
  payout_amount       numeric,
  reasons             text[]
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.id, a.code, a.status, a.payee_legal_name, a.payee_country,
         a.payee_sanctions_declared_at IS NOT NULL,
         a.payee_tax_declared_at IS NOT NULL,
         COALESCE(b.balance, 0),
         w.id, w.address, w.coin, w.network, w.created_at, w.usable_after, w.screening_result,
         COALESCE(y.paid, 0),
         p.id, p.status, p.amount_usd,
         array_remove(ARRAY[
           CASE WHEN a.status <> 'active' THEN a.status END,
           CASE WHEN w.id IS NULL THEN 'no_wallet' END,
           CASE WHEN w.id IS NOT NULL AND w.usable_after > now() THEN 'wallet_cooldown' END,
           CASE WHEN w.id IS NOT NULL AND w.screening_result = 'blocked' THEN 'address_blocked'
                WHEN w.id IS NOT NULL AND w.screening_result <> 'clear' THEN 'not_screened' END,
           CASE WHEN w.id IS NOT NULL AND w.screening_result = 'clear' AND w.screening_provider = 'manual'
                     AND w.screened_at < now() - interval '30 days' THEN 'screening_stale' END,
           CASE WHEN w.id IS NOT NULL AND (w.network <> ALL (p_networks) OR w.coin <> ALL (p_coins))
                THEN 'rail_disabled' END,
           CASE WHEN p_require_kyc AND (a.payee_legal_name IS NULL OR a.payee_country IS NULL
                     OR a.payee_sanctions_declared_at IS NULL OR a.payee_tax_declared_at IS NULL)
                THEN 'missing_payee' END,
           CASE WHEN COALESCE(b.balance, 0) < p_min OR COALESCE(b.balance, 0) <= 0 THEN 'below_threshold' END,
           CASE WHEN p.id IS NOT NULL THEN 'already_created' END
         ], NULL)
    FROM affiliates a
    LEFT JOIN LATERAL (
      SELECT SUM(c.amount_usd) AS balance FROM affiliate_commissions c
       WHERE c.affiliate_id = a.id AND c.status = 'payable'
    ) b ON true
    LEFT JOIN affiliate_wallets w ON w.affiliate_id = a.id AND w.revoked_at IS NULL
    LEFT JOIN LATERAL (
      SELECT SUM(x.amount_usd) AS paid FROM affiliate_payouts x
       WHERE x.affiliate_id = a.id AND x.status = 'paid'
         AND date_trunc('year', x.paid_at) = date_trunc('year', p_period::timestamptz)
    ) y ON true
    LEFT JOIN affiliate_payouts p
      ON p.affiliate_id = a.id AND p.period_month = p_period AND p.status <> 'cancelled'
   ORDER BY a.id
$$;

ALTER TABLE public.affiliates DROP CONSTRAINT IF EXISTS affiliates_payout_channel_check;
ALTER TABLE public.affiliates DROP COLUMN IF EXISTS payout_channel;
