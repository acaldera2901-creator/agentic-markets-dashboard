-- #CREATOR-OFFERS-1031 (workstream A) — offerta economica per singolo creator.
--
-- PROPOSAL approvata da Andrea: ~/Desktop/01-BETREDGE/lab/proposte/2026-10-31-creator-offers.md
--
-- 1. affiliate_offers: l'offerta di un affiliato con validità temporale
--    [valid_from, valid_to). Il ledger (lib/affiliate/ledger.ts) legge quella in
--    vigore ALLA DATA DEL PAGAMENTO: un ricalcolo tardivo (reconcile) dà lo
--    stesso tasso. Append-only: cambio offerta = chiudere la riga aperta
--    (valid_to NULL → valore, mai nel passato) + inserirne una nuova. Nessun
--    UPDATE di altro, nessun DELETE. Due offerte non si sovrappongono.
--    NULL in un tasso = vale la env globale (AFFILIATE_*_RATE / _TIERS).
-- 2. affiliates.payout_channel: 'crypto' (default, tutti gli esistenti) |
--    'manual' (pagato a mano fuori piattaforma: Shopify / crypto esterno).
--    'manual' toglie l'affiliato dalla coda payout USDT: nuovo motivo
--    `manual_channel` in affiliate_payout_rows (la creazione rifiuta ogni riga
--    con un motivo, quindi nessun payout USDT può nascere per lui).
-- 3. affiliate_admin_actions.action: + 'offer_set', 'deliverables_confirmed'.
-- 4. Funzioni admin: affiliate_admin_set_offer, affiliate_admin_confirm_deliverables
--    (lock + riga nel registro azioni nella stessa transazione, come le altre).
--
-- ADDITIVA e idempotente. Dipende da 20261022130000 (registro azioni,
-- affiliate_payout_rows) e 20261022160000 (CHECK delle azioni).
-- NON si applica da sola: con APPROVE, PRIMA del deploy del codice (il ledger
-- legge affiliate_offers su ogni pagamento: senza tabella la commissione non si
-- scrive e la recupera reconcile — vedi PR).
-- Rollback: scripts/affiliate-v2/rollback_creator_offers_1101.sql.
--
-- COORDINAMENTO con il workstream B (migration 20261102*): se B ridefinisce
-- affiliate_admin_actions_action_check, la sua lista DEVE includere
-- 'offer_set' e 'deliverables_confirmed', altrimenti l'ADD CONSTRAINT fallisce
-- sulle righe già scritte.

-- ── 1. Canale di pagamento ───────────────────────────────────────────────────
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS payout_channel text NOT NULL DEFAULT 'crypto';
ALTER TABLE public.affiliates DROP CONSTRAINT IF EXISTS affiliates_payout_channel_check;
ALTER TABLE public.affiliates ADD CONSTRAINT affiliates_payout_channel_check
  CHECK (payout_channel IN ('crypto','manual'));

-- ── 2. Offerte ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_offers (
  id                      bigserial     PRIMARY KEY,
  affiliate_id            bigint        NOT NULL REFERENCES public.affiliates(id),
  valid_from              timestamptz   NOT NULL,
  valid_to                timestamptz,
  -- Primo acquisto, per periodo del piano comprato (1.0000 = 100 %).
  first_rate_monthly      numeric(5,4)  CHECK (first_rate_monthly IS NULL OR first_rate_monthly BETWEEN 0 AND 1),
  first_rate_annual       numeric(5,4)  CHECK (first_rate_annual IS NULL OR first_rate_annual BETWEEN 0 AND 1),
  renewal_rate            numeric(5,4)  CHECK (renewal_rate IS NULL OR renewal_rate BETWEEN 0 AND 1),
  -- [{"min":5,"rate":0.1}, …] come AFFILIATE_RENEWAL_TIERS; NULL = scala env.
  renewal_tiers           jsonb         CHECK (renewal_tiers IS NULL OR jsonb_typeof(renewal_tiers) = 'array'),
  -- Fisso: si calcola (lib/affiliate/manual-due.ts), non entra nel ledger.
  fixed_usd               numeric(12,2) NOT NULL DEFAULT 0 CHECK (fixed_usd >= 0),
  fixed_period            text          CHECK (fixed_period IS NULL OR fixed_period IN ('biweekly','monthly','once')),
  -- {"video":2,"story":5}: minimi da confermare (affiliate_admin_actions) per maturare il fisso.
  fixed_min_deliverables  jsonb         NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(fixed_min_deliverables) = 'object'),
  -- {"type":"threshold",…} | {"type":"tiers",…} — validato dal codice (lib/affiliate/offers.ts).
  bonus_rule              jsonb         CHECK (bonus_rule IS NULL OR jsonb_typeof(bonus_rule) = 'object'),
  note                    text          CHECK (note IS NULL OR length(note) <= 500),
  created_by              text          NOT NULL CHECK (length(created_by) BETWEEN 2 AND 160),
  created_at              timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_offers_range CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT affiliate_offers_fixed_has_period CHECK (fixed_usd = 0 OR fixed_period IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_affiliate_offers_affiliate
  ON public.affiliate_offers (affiliate_id, valid_from);
-- Una sola offerta aperta per affiliato (anche sotto scritture concorrenti).
CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_offers_one_open
  ON public.affiliate_offers (affiliate_id) WHERE valid_to IS NULL;

-- Append-only: INSERT senza sovrapposizioni; UPDATE solo per chiudere la riga
-- aperta (valid_to NULL → valore non nel passato, tutto il resto identico);
-- DELETE mai. Chiudere nel passato riscriverebbe il tasso dei pagamenti già
-- caduti dopo quella data (un reconcile li ricalcolerebbe diversi).
CREATE OR REPLACE FUNCTION public.affiliate_offers_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'affiliate_offers is append-only';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM affiliate_offers o
                WHERE o.affiliate_id = NEW.affiliate_id
                  AND tstzrange(o.valid_from, o.valid_to) && tstzrange(NEW.valid_from, NEW.valid_to)) THEN
      RAISE EXCEPTION 'affiliate_offers: overlapping offer for affiliate %', NEW.affiliate_id;
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.valid_to IS NOT NULL OR NEW.valid_to IS NULL
     OR (to_jsonb(NEW) - 'valid_to') IS DISTINCT FROM (to_jsonb(OLD) - 'valid_to') THEN
    RAISE EXCEPTION 'affiliate_offers is append-only (only closing an open offer is allowed)';
  END IF;
  IF NEW.valid_to < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'affiliate_offers: cannot close an offer in the past';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_affiliate_offers_append_only ON public.affiliate_offers;
CREATE TRIGGER trg_affiliate_offers_append_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.affiliate_offers
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_offers_append_only();

ALTER TABLE public.affiliate_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affiliate_offers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.affiliate_offers_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.affiliate_offers TO service_role;
GRANT USAGE ON SEQUENCE public.affiliate_offers_id_seq TO service_role;

-- ── 3. Registro azioni: due azioni nuove ─────────────────────────────────────
ALTER TABLE public.affiliate_admin_actions DROP CONSTRAINT IF EXISTS affiliate_admin_actions_action_check;
ALTER TABLE public.affiliate_admin_actions ADD CONSTRAINT affiliate_admin_actions_action_check
  CHECK (action IN ('wallet_screened','affiliate_status','attribution_reviewed',
                    'payout_marked_sent','payout_unmarked_sent','commission_reversed',
                    'offer_set','deliverables_confirmed'));

-- ── 4. Funzioni admin ────────────────────────────────────────────────────────

-- Assegna una nuova offerta: chiude quella aperta a valid_from e inserisce la
-- nuova, opzionalmente cambia payout_channel. I valori arrivano già validati
-- dal codice (parseOfferInput); i CHECK della tabella restano l'ultima difesa.
CREATE OR REPLACE FUNCTION public.affiliate_admin_set_offer(
  p_actor           text,
  p_affiliate_id    bigint,
  p_offer           jsonb,
  p_payout_channel  text,
  p_reason          text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_from     timestamptz;
  v_channel  text;
  v_closed   bigint;
  v_id       bigint;
BEGIN
  IF coalesce(length(trim(p_actor)), 0) < 2 OR p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_required');
  END IF;
  IF p_payout_channel IS NOT NULL AND p_payout_channel NOT IN ('crypto','manual') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payout_channel');
  END IF;
  SELECT payout_channel INTO v_channel FROM affiliates WHERE id = p_affiliate_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  v_from := COALESCE(NULLIF(p_offer->>'valid_from', '')::timestamptz, now());
  IF v_from < now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'valid_from_in_past');
  END IF;
  IF EXISTS (SELECT 1 FROM affiliate_offers WHERE affiliate_id = p_affiliate_id AND valid_from >= v_from) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'overlaps_existing_offer');
  END IF;
  -- Passare a 'manual' con un payout USDT già in corso: si pagherebbe due volte.
  IF p_payout_channel = 'manual' AND v_channel <> 'manual' AND EXISTS (
       SELECT 1 FROM affiliate_payouts WHERE affiliate_id = p_affiliate_id AND status IN ('created','submitted')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'open_payout');
  END IF;

  UPDATE affiliate_offers SET valid_to = v_from
   WHERE affiliate_id = p_affiliate_id AND valid_to IS NULL
  RETURNING id INTO v_closed;

  INSERT INTO affiliate_offers
    (affiliate_id, valid_from, first_rate_monthly, first_rate_annual, renewal_rate, renewal_tiers,
     fixed_usd, fixed_period, fixed_min_deliverables, bonus_rule, note, created_by)
  VALUES
    (p_affiliate_id, v_from,
     (p_offer->>'first_rate_monthly')::numeric, (p_offer->>'first_rate_annual')::numeric,
     (p_offer->>'renewal_rate')::numeric, NULLIF(p_offer->'renewal_tiers', 'null'::jsonb),
     COALESCE((p_offer->>'fixed_usd')::numeric, 0), p_offer->>'fixed_period',
     COALESCE(NULLIF(p_offer->'fixed_min_deliverables', 'null'::jsonb), '{}'::jsonb),
     NULLIF(p_offer->'bonus_rule', 'null'::jsonb), p_offer->>'note', trim(p_actor))
  RETURNING id INTO v_id;

  IF p_payout_channel IS NOT NULL AND p_payout_channel <> v_channel THEN
    UPDATE affiliates SET payout_channel = p_payout_channel, updated_at = now() WHERE id = p_affiliate_id;
  END IF;

  INSERT INTO affiliate_admin_actions (actor, action, affiliate_id, target, reason, detail)
  VALUES (trim(p_actor), 'offer_set', p_affiliate_id, 'offer:' || v_id, trim(p_reason),
          jsonb_build_object('offer_id', v_id, 'closed_offer_id', v_closed, 'valid_from', v_from,
                             'offer', p_offer, 'payout_channel_from', v_channel,
                             'payout_channel_to', COALESCE(p_payout_channel, v_channel)));
  RETURN jsonb_build_object('ok', true, 'affiliate_id', p_affiliate_id, 'offer_id', v_id,
                            'closed_offer_id', v_closed, 'valid_from', v_from,
                            'payout_channel', COALESCE(p_payout_channel, v_channel));
END $$;

-- Conferma dei contenuti consegnati in uno slot ('2026-11' mensile/una tantum,
-- '2026-11-1' / '2026-11-2' quindicine). Più conferme sullo stesso slot si
-- sommano (lib/affiliate/manual-due.ts).
CREATE OR REPLACE FUNCTION public.affiliate_admin_confirm_deliverables(
  p_actor         text,
  p_affiliate_id  bigint,
  p_slot          text,
  p_counts        jsonb,
  p_reason        text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id  bigint;
BEGIN
  IF coalesce(length(trim(p_actor)), 0) < 2 OR p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_required');
  END IF;
  IF p_slot IS NULL OR p_slot !~ '^20[2-9][0-9]-(0[1-9]|1[0-2])(-[12])?$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_slot');
  END IF;
  IF p_counts IS NULL OR jsonb_typeof(p_counts) <> 'object' OR p_counts = '{}'::jsonb THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_counts');
  END IF;
  PERFORM 1 FROM affiliates WHERE id = p_affiliate_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  INSERT INTO affiliate_admin_actions (actor, action, affiliate_id, target, reason, detail)
  VALUES (trim(p_actor), 'deliverables_confirmed', p_affiliate_id, 'slot:' || p_slot, trim(p_reason),
          jsonb_build_object('slot', p_slot, 'counts', p_counts))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'affiliate_id', p_affiliate_id, 'slot', p_slot, 'action_id', v_id);
END $$;

REVOKE EXECUTE ON FUNCTION public.affiliate_admin_set_offer(text, bigint, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_set_offer(text, bigint, jsonb, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.affiliate_admin_confirm_deliverables(text, bigint, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_confirm_deliverables(text, bigint, text, jsonb, text) TO service_role;

-- ── 5. Coda payout USDT: fuori chi è pagato a mano ───────────────────────────
-- Come 20261022130000, con un motivo in più: manual_channel.
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
           CASE WHEN a.payout_channel = 'manual' THEN 'manual_channel' END,
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

REVOKE EXECUTE ON FUNCTION public.affiliate_payout_rows(date, numeric, boolean, text[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_payout_rows(date, numeric, boolean, text[], text[]) TO service_role;
