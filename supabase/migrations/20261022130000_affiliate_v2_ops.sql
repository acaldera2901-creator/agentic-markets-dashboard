-- #AFFILIATE-OPS-1022 — strumenti operatore del programma affiliati.
--
-- Il backoffice (betredge-backoffice) li chiama tramite le rotte
-- /api/admin/affiliate/* del sito; qui stanno le decisioni, ciascuna in UNA
-- transazione con il lock comune (affiliates → affiliate_payouts →
-- affiliate_commissions, vedi 20261015130000) e una riga di registro.
--
-- Contenuto:
--  1. affiliate_admin_actions — registro append-only di chi ha fatto cosa
--     (UPDATE/DELETE vietati da trigger).
--  2. Screening MANUALE del wallet: nessun provider è integrato
--     (lib/affiliate/screening.ts), quindi la decisione clear/blocked la prende
--     un operatore, con motivo, nome e data. Il vincolo ammette ora 'blocked';
--     provider = 'manual'. Una decisione manuale vale 30 giorni per la
--     creazione di un payout (motivo `screening_stale` dopo), poi va ripresa.
--  3. Payout «fondi in uscita» (R-C, finestra di doppio pagamento): l'operatore
--     marca il payout PRIMA di inviare. Un payout marcato non si annulla più —
--     né dall'admin né da cambio wallet / sospensione — e accetta il tx hash
--     anche se nel frattempo l'affiliato è stato sospeso (i fondi sono partiti).
--     Si toglie la marca solo dichiarando, con motivo, che nulla è partito.
--     La marca È l'approvazione: quattro occhi, un operatore nominato diverso
--     da chi ha preparato il payout (created_by).
--  4. Sospensione / chiusura / riattivazione di un affiliato.
--  5. Revisione di un'attribuzione in fraud_review → valid | void.
--
-- Ridefinisce (stessa firma, CREATE OR REPLACE) quattro funzioni di
-- 20261015120000/20261015130000: affiliate_cancel_created_payouts (salta i
-- payout marcati), affiliate_cancel_payout (rifiuta i marcati),
-- affiliate_payout_record_tx (marcato + affiliato non attivo: ammesso),
-- affiliate_payout_rows (motivi address_blocked / screening_stale). Questo file
-- è l'unica fonte di quelle quattro da qui in avanti.
--
-- NON si applica da sola: workflow_dispatch con `approved_sha`. Idempotente.
-- Rollback: scripts/affiliate-v2/rollback_ops_1022.sql.

-- ── 1. Registro delle azioni admin ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_admin_actions (
  id            bigserial    PRIMARY KEY,
  at            timestamptz  NOT NULL DEFAULT now(),
  -- Chi: «bo:<operatore>» dal backoffice, «admin-cookie» da /admin del sito.
  actor         text         NOT NULL CHECK (length(actor) BETWEEN 2 AND 160),
  action        text         NOT NULL CHECK (action IN
                  ('wallet_screened','affiliate_status','attribution_reviewed',
                   'payout_marked_sent','payout_unmarked_sent')),
  -- Niente FK: il registro deve sopravvivere a qualunque pulizia.
  affiliate_id  bigint,
  target        text,
  reason        text,
  detail        jsonb        NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_affiliate_admin_actions_affiliate
  ON public.affiliate_admin_actions (affiliate_id, at);

CREATE OR REPLACE FUNCTION public.affiliate_admin_actions_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'affiliate_admin_actions is append-only';
END $$;
DROP TRIGGER IF EXISTS trg_affiliate_admin_actions_append_only ON public.affiliate_admin_actions;
CREATE TRIGGER trg_affiliate_admin_actions_append_only
  BEFORE UPDATE OR DELETE ON public.affiliate_admin_actions
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_admin_actions_append_only();

ALTER TABLE public.affiliate_admin_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affiliate_admin_actions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.affiliate_admin_actions_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.affiliate_admin_actions TO service_role;
GRANT USAGE ON SEQUENCE public.affiliate_admin_actions_id_seq TO service_role;

-- ── 2. Screening manuale: colonne e vincoli ──────────────────────────────────
ALTER TABLE public.affiliate_wallets
  ADD COLUMN IF NOT EXISTS screened_by       text,
  ADD COLUMN IF NOT EXISTS screening_reason  text;

-- Lista dei valori: DROP + ADD (come affiliate_payouts_cancel_code). Rollback:
-- le righe 'blocked' vanno riportate a 'not_screened' prima del vincolo vecchio.
ALTER TABLE public.affiliate_wallets DROP CONSTRAINT IF EXISTS affiliate_wallets_screening_result;
ALTER TABLE public.affiliate_wallets ADD CONSTRAINT affiliate_wallets_screening_result
  CHECK (screening_result IN ('clear','not_screened','blocked'));
ALTER TABLE public.affiliate_wallets DROP CONSTRAINT IF EXISTS affiliate_wallets_blocked_needs_time;
ALTER TABLE public.affiliate_wallets ADD CONSTRAINT affiliate_wallets_blocked_needs_time
  CHECK (screening_result <> 'blocked' OR (screened_at IS NOT NULL AND screening_provider IS NOT NULL));
-- Una decisione manuale ha sempre un nome e un motivo.
ALTER TABLE public.affiliate_wallets DROP CONSTRAINT IF EXISTS affiliate_wallets_manual_has_who_why;
ALTER TABLE public.affiliate_wallets ADD CONSTRAINT affiliate_wallets_manual_has_who_why
  CHECK (screening_provider IS DISTINCT FROM 'manual'
         OR (screened_by IS NOT NULL AND screening_reason IS NOT NULL AND screened_at IS NOT NULL));

-- ── 3. Payout marcato «fondi in uscita» ──────────────────────────────────────
ALTER TABLE public.affiliate_payouts
  ADD COLUMN IF NOT EXISTS sent_marked_at  timestamptz,
  ADD COLUMN IF NOT EXISTS sent_marked_by  text;
ALTER TABLE public.affiliate_payouts DROP CONSTRAINT IF EXISTS affiliate_payouts_mark_has_who;
ALTER TABLE public.affiliate_payouts ADD CONSTRAINT affiliate_payouts_mark_has_who
  CHECK ((sent_marked_at IS NULL) = (sent_marked_by IS NULL));

-- ── Funzioni ridefinite (stessa firma) ───────────────────────────────────────

-- Come 20261015120000, ma un payout marcato non si annulla: i fondi possono
-- essere già partiti verso il suo to_address (R-C).
CREATE OR REPLACE FUNCTION public.affiliate_cancel_created_payouts(
  p_affiliate_id bigint, p_code text, p_reason text
) RETURNS bigint[]
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_ids bigint[];
BEGIN
  WITH c AS (
    UPDATE affiliate_payouts
       SET status = 'cancelled', cancelled_at = now(), cancel_code = p_code, cancel_reason = p_reason
     WHERE affiliate_id = p_affiliate_id AND status = 'created' AND sent_marked_at IS NULL
    RETURNING id
  )
  SELECT COALESCE(array_agg(id ORDER BY id), '{}') INTO v_ids FROM c;

  IF cardinality(v_ids) > 0 THEN
    UPDATE affiliate_commissions
       SET status = 'payable', payout_id = NULL
     WHERE payout_id = ANY (v_ids) AND status = 'in_payout';
  END IF;
  RETURN v_ids;
END;
$$;

-- Come 20261015130000, ma rifiuta un payout marcato.
CREATE OR REPLACE FUNCTION public.affiliate_cancel_payout(p_id bigint, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_aff     bigint;
  v_status  text;
  v_marked  timestamptz;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_required');
  END IF;
  SELECT affiliate_id INTO v_aff FROM affiliate_payouts WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  PERFORM 1 FROM affiliates WHERE id = v_aff FOR UPDATE;
  SELECT status, sent_marked_at INTO v_status, v_marked FROM affiliate_payouts WHERE id = p_id FOR UPDATE;
  IF v_status <> 'created' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_cancellable', 'status', v_status);
  END IF;
  IF v_marked IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'marked_sent', 'sent_marked_at', v_marked);
  END IF;

  UPDATE affiliate_payouts
     SET status = 'cancelled', cancelled_at = now(), cancel_code = 'admin_cancelled', cancel_reason = trim(p_reason)
   WHERE id = p_id;
  UPDATE affiliate_commissions SET status = 'payable', payout_id = NULL
   WHERE payout_id = p_id AND status = 'in_payout';
  RETURN jsonb_build_object('ok', true, 'affiliate_id', v_aff);
END;
$$;

-- Come 20261015130000; unica differenza: created + affiliato non attivo è
-- ammesso se il payout è marcato (fondi partiti prima della sospensione).
CREATE OR REPLACE FUNCTION public.affiliate_payout_record_tx(
  p_id           bigint,
  p_tx_hash      text,
  p_paid         boolean,
  p_amount_coin  numeric,
  p_nonce        bigint,
  p_block        bigint,
  p_from         text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_aff      bigint;
  v_astatus  text;
  p          affiliate_payouts%ROWTYPE;
BEGIN
  SELECT affiliate_id INTO v_aff FROM affiliate_payouts WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT status INTO v_astatus FROM affiliates WHERE id = v_aff FOR UPDATE;
  SELECT * INTO p FROM affiliate_payouts WHERE id = p_id FOR UPDATE;

  IF p.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cancelled', 'cancel_code', p.cancel_code);
  END IF;
  IF p.status = 'paid' THEN
    IF p.tx_hash = p_tx_hash THEN
      RETURN jsonb_build_object('ok', true, 'status', 'paid', 'became_paid', false);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'already_paid');
  END IF;
  IF p.status = 'created' AND v_astatus <> 'active' AND p.sent_marked_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'affiliate_not_active', 'affiliate_status', v_astatus);
  END IF;
  IF EXISTS (SELECT 1 FROM affiliate_payouts x WHERE x.network = p.network AND x.dropped_tx_hash = p_tx_hash) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'hash_already_used', 'dropped', true);
  END IF;
  IF p.status = 'submitted' AND p.tx_hash <> p_tx_hash THEN
    RETURN jsonb_build_object('ok', false, 'error', 'hash_mismatch');
  END IF;

  BEGIN
    UPDATE affiliate_payouts
       SET tx_hash = p_tx_hash,
           submitted_at = COALESCE(submitted_at, now()),
           status = CASE WHEN p_paid THEN 'paid' ELSE 'submitted' END,
           paid_at = CASE WHEN p_paid THEN now() END,
           amount_coin = p_amount_coin,
           tx_nonce = p_nonce,
           tx_block = COALESCE(p_block, tx_block),
           tx_from = COALESCE(LOWER(p_from), tx_from)
     WHERE id = p_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'hash_already_used');
  END;

  IF p_paid THEN
    UPDATE affiliate_commissions SET status = 'paid'
     WHERE payout_id = p_id AND status = 'in_payout';
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', CASE WHEN p_paid THEN 'paid' ELSE 'submitted' END,
                            'became_paid', p_paid);
END;
$$;

-- Come 20261015130000, con due motivi in più: address_blocked (decisione di
-- screening negativa) e screening_stale (decisione manuale > 30 giorni).
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

-- ── Nuove funzioni ───────────────────────────────────────────────────────────

-- Decisione di screening sul wallet ATTIVO. 'blocked' annulla i payout in
-- preparazione non marcati (le commissioni tornano payable, restano ferme).
CREATE OR REPLACE FUNCTION public.affiliate_screen_wallet(
  p_wallet_id bigint, p_result text, p_reason text, p_by text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_aff        bigint;
  w            affiliate_wallets%ROWTYPE;
  v_cancelled  bigint[] := '{}';
BEGIN
  IF p_result NOT IN ('clear','blocked') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_result');
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 OR p_by IS NULL OR length(trim(p_by)) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_required');
  END IF;
  SELECT affiliate_id INTO v_aff FROM affiliate_wallets WHERE id = p_wallet_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  PERFORM 1 FROM affiliates WHERE id = v_aff FOR UPDATE;
  SELECT * INTO w FROM affiliate_wallets WHERE id = p_wallet_id FOR UPDATE;
  IF w.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wallet_revoked');
  END IF;

  UPDATE affiliate_wallets
     SET screening_result = p_result, screened_at = now(), screening_provider = 'manual',
         screened_by = trim(p_by), screening_reason = trim(p_reason)
   WHERE id = p_wallet_id;
  IF p_result = 'blocked' THEN
    v_cancelled := affiliate_cancel_created_payouts(v_aff, 'admin_cancelled', 'address_blocked');
  END IF;

  INSERT INTO affiliate_admin_actions (actor, action, affiliate_id, target, reason, detail)
  VALUES (trim(p_by), 'wallet_screened', v_aff, 'wallet:' || p_wallet_id, trim(p_reason),
          jsonb_build_object('from', w.screening_result, 'to', p_result, 'network', w.network,
                             'cancelled_payout_ids', to_jsonb(v_cancelled)));
  RETURN jsonb_build_object('ok', true, 'affiliate_id', v_aff, 'wallet_id', p_wallet_id,
                            'screening_result', p_result, 'cancelled_payout_ids', to_jsonb(v_cancelled));
END;
$$;

-- Sospendi / chiudi / riattiva. 'terminated' è definitivo. Il trigger
-- trg_affiliates_status_cancel_payouts annulla i payout in preparazione non
-- marcati quando si esce da 'active'.
CREATE OR REPLACE FUNCTION public.affiliate_set_status(
  p_affiliate_id bigint, p_status text, p_reason text, p_by text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old        text;
  v_cancelled  bigint[];
BEGIN
  IF p_status NOT IN ('active','suspended','terminated') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 OR p_by IS NULL OR length(trim(p_by)) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_required');
  END IF;
  SELECT status INTO v_old FROM affiliates WHERE id = p_affiliate_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_old = p_status THEN
    RETURN jsonb_build_object('ok', true, 'affiliate_id', p_affiliate_id, 'status', v_old, 'changed', false);
  END IF;
  IF v_old = 'terminated' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'terminated_is_final');
  END IF;

  SELECT COALESCE(array_agg(id ORDER BY id), '{}') INTO v_cancelled
    FROM affiliate_payouts
   WHERE affiliate_id = p_affiliate_id AND status = 'created' AND sent_marked_at IS NULL
     AND p_status <> 'active';
  UPDATE affiliates SET status = p_status, updated_at = now() WHERE id = p_affiliate_id;

  INSERT INTO affiliate_admin_actions (actor, action, affiliate_id, target, reason, detail)
  VALUES (trim(p_by), 'affiliate_status', p_affiliate_id, 'affiliate:' || p_affiliate_id, trim(p_reason),
          jsonb_build_object('from', v_old, 'to', p_status, 'cancelled_payout_ids', to_jsonb(v_cancelled)));
  RETURN jsonb_build_object('ok', true, 'affiliate_id', p_affiliate_id, 'status', p_status, 'changed', true,
                            'cancelled_payout_ids', to_jsonb(v_cancelled));
END;
$$;

-- Revisione di un'attribuzione ferma in fraud_review.
--  valid → le commissioni maturano al prossimo giro del cron (stesse regole);
--  void  → le righe pending/shadow di quel referito diventano void.
CREATE OR REPLACE FUNCTION public.affiliate_review_attribution(
  p_referred text, p_decision text, p_reason text, p_by text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_who     text := LOWER(TRIM(p_referred));
  v_aff     bigint;
  v_status  text;
  v_voided  int := 0;
BEGIN
  IF p_decision NOT IN ('valid','void') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_decision');
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 OR p_by IS NULL OR length(trim(p_by)) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_required');
  END IF;
  SELECT affiliate_id INTO v_aff FROM affiliate_attributions WHERE referred_identifier = v_who;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  PERFORM 1 FROM affiliates WHERE id = v_aff FOR UPDATE;
  SELECT status INTO v_status FROM affiliate_attributions WHERE referred_identifier = v_who FOR UPDATE;
  IF v_status <> 'fraud_review' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_in_review', 'status', v_status);
  END IF;

  UPDATE affiliate_attributions
     SET status = p_decision, status_reason = 'reviewed: ' || trim(p_reason)
   WHERE referred_identifier = v_who;
  IF p_decision = 'void' THEN
    UPDATE affiliate_commissions SET status = 'void'
     WHERE affiliate_id = v_aff AND referred_identifier = v_who AND status IN ('pending','shadow');
    GET DIAGNOSTICS v_voided = ROW_COUNT;
  END IF;

  INSERT INTO affiliate_admin_actions (actor, action, affiliate_id, target, reason, detail)
  VALUES (trim(p_by), 'attribution_reviewed', v_aff, 'attribution:' || v_who, trim(p_reason),
          jsonb_build_object('from', v_status, 'to', p_decision, 'voided_commissions', v_voided));
  RETURN jsonb_build_object('ok', true, 'affiliate_id', v_aff, 'status', p_decision, 'voided_commissions', v_voided);
END;
$$;

-- «Approvo e sto inviando i fondi»: da chiamare PRIMA dell'invio. Solo un
-- payout `created`, con il wallet ancora attivo e 'clear', e da un operatore
-- DIVERSO da chi l'ha preparato (created_by). Idempotente.
CREATE OR REPLACE FUNCTION public.affiliate_payout_mark_sent(p_id bigint, p_by text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_aff      bigint;
  v_astatus  text;
  p          affiliate_payouts%ROWTYPE;
  w          affiliate_wallets%ROWTYPE;
BEGIN
  IF p_by IS NULL OR length(trim(p_by)) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'actor_required');
  END IF;
  SELECT affiliate_id INTO v_aff FROM affiliate_payouts WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT status INTO v_astatus FROM affiliates WHERE id = v_aff FOR UPDATE;
  SELECT * INTO p FROM affiliate_payouts WHERE id = p_id FOR UPDATE;
  IF p.status <> 'created' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_created', 'status', p.status);
  END IF;
  IF p.sent_marked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'payout_id', p_id, 'already', true,
                              'sent_marked_at', p.sent_marked_at, 'sent_marked_by', p.sent_marked_by);
  END IF;
  -- Review Codex: un nuovo invio solo verso un affiliato attivo (un payout
  -- created di un sospeso esiste solo se era marcato e poi smarcato).
  IF v_astatus <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'affiliate_not_active', 'affiliate_status', v_astatus);
  END IF;
  -- Quattro occhi (parere legale 22/10): chi ha preparato il payout non lo
  -- approva. «admin-cookie» (segreto condiviso di /admin) non è una persona:
  -- non può né preparare né approvare un invio.
  IF trim(p_by) = 'admin-cookie' OR p.created_by = 'admin-cookie' OR p.created_by = 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'named_operators_required');
  END IF;
  IF trim(p_by) = p.created_by THEN
    RETURN jsonb_build_object('ok', false, 'error', 'same_person', 'created_by', p.created_by);
  END IF;
  SELECT * INTO w FROM affiliate_wallets WHERE id = p.wallet_id;
  IF w.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wallet_changed');
  END IF;
  IF w.screening_result <> 'clear' THEN
    RETURN jsonb_build_object('ok', false, 'error',
                              CASE WHEN w.screening_result = 'blocked' THEN 'address_blocked' ELSE 'not_screened' END);
  END IF;

  UPDATE affiliate_payouts SET sent_marked_at = now(), sent_marked_by = trim(p_by) WHERE id = p_id;
  INSERT INTO affiliate_admin_actions (actor, action, affiliate_id, target, detail)
  VALUES (trim(p_by), 'payout_marked_sent', v_aff, 'payout:' || p_id,
          jsonb_build_object('amount_usd', p.amount_usd, 'coin', p.coin, 'network', p.network,
                             'to_address', p.to_address));
  RETURN jsonb_build_object('ok', true, 'payout_id', p_id, 'already', false, 'to_address', p.to_address,
                            'amount_usd', p.amount_usd, 'coin', p.coin, 'network', p.network);
END;
$$;

-- Togli la marca: SOLO se nessun fondo è partito (dichiarazione con motivo, a
-- registro). Dopo, il payout torna annullabile.
CREATE OR REPLACE FUNCTION public.affiliate_payout_unmark_sent(p_id bigint, p_reason text, p_by text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_aff        bigint;
  v_astatus    text;
  v_cancelled  bigint[] := '{}';
  p            affiliate_payouts%ROWTYPE;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 OR p_by IS NULL OR length(trim(p_by)) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_required');
  END IF;
  SELECT affiliate_id INTO v_aff FROM affiliate_payouts WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT status INTO v_astatus FROM affiliates WHERE id = v_aff FOR UPDATE;
  SELECT * INTO p FROM affiliate_payouts WHERE id = p_id FOR UPDATE;
  IF p.status <> 'created' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_created', 'status', p.status);
  END IF;
  IF p.sent_marked_at IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'payout_id', p_id, 'already', true);
  END IF;
  UPDATE affiliate_payouts SET sent_marked_at = NULL, sent_marked_by = NULL WHERE id = p_id;
  -- Review Codex: se l'affiliato non è più attivo, il payout smarcato fa la
  -- fine che avrebbe fatto alla sospensione (annullato, commissioni payable).
  IF v_astatus <> 'active' THEN
    v_cancelled := affiliate_cancel_created_payouts(v_aff, 'affiliate_suspended', 'affiliate_' || v_astatus);
  END IF;
  INSERT INTO affiliate_admin_actions (actor, action, affiliate_id, target, reason, detail)
  VALUES (trim(p_by), 'payout_unmarked_sent', v_aff, 'payout:' || p_id, trim(p_reason),
          jsonb_build_object('was_marked_at', p.sent_marked_at, 'was_marked_by', p.sent_marked_by,
                             'cancelled_payout_ids', to_jsonb(v_cancelled)));
  RETURN jsonb_build_object('ok', true, 'payout_id', p_id, 'already', false,
                            'cancelled_payout_ids', to_jsonb(v_cancelled));
END;
$$;

-- ── Accesso: solo service_role ───────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.affiliate_admin_actions_append_only() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_screen_wallet(bigint, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_set_status(bigint, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_review_attribution(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_payout_mark_sent(bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_payout_unmark_sent(bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_screen_wallet(bigint, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_set_status(bigint, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_review_attribution(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_payout_mark_sent(bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_payout_unmark_sent(bigint, text, text) TO service_role;
