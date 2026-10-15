-- #AFFILIATE-V2-CRYPTO-1007 — PR-9: payout admin manuali (solo funzioni).
--
-- Spec: artifacts/affiliate-v2/PROPOSAL-crypto-payout.md §3.4, SPEC-ui.md §4,
-- §12. Si appoggia a 20261007120000 (#482) e 20261015120000 (PR-5). Nessuna
-- tabella o colonna nuova: solo quattro funzioni.
--
-- NON si applica da sola: workflow_dispatch con `approved_sha`. Idempotente
-- (CREATE OR REPLACE). Rollback: DROP delle quattro funzioni.
--
-- Ordine dei lock, uguale in TUTTE le funzioni affiliate_* (anche PR-5), per non
-- creare deadlock: affiliates → affiliate_payouts → affiliate_commissions.
--
-- period_month = mese di ESECUZIONE del payout (decisione di Andrea, 15/10):
-- si crea solo per il mese corrente (UTC).

-- ── Chi è pagabile, e perché no ──────────────────────────────────────────────
-- Unica fonte delle regole di eleggibilità: la legge la pagina admin (anteprima)
-- e la rilegge la creazione dentro la transazione, dopo i lock. Nessuna riga
-- sparisce: chi non è pagabile ha i motivi in `reasons` (SPEC-ui §4.1).
-- Saldo = SUM delle righe `payable`, clawback negativi compresi (§4.2 PROPOSAL-tecnica).
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
           CASE WHEN w.id IS NOT NULL AND w.screening_result <> 'clear' THEN 'not_screened' END,
           CASE WHEN w.id IS NOT NULL AND (w.network <> ALL (p_networks) OR w.coin <> ALL (p_coins))
                THEN 'rail_disabled' END,
           CASE WHEN p_require_kyc AND (a.payee_legal_name IS NULL OR a.payee_country IS NULL
                     OR a.payee_sanctions_declared_at IS NULL OR a.payee_tax_declared_at IS NULL)
                THEN 'missing_payee' END,
           CASE WHEN COALESCE(b.balance, 0) < p_min THEN 'below_threshold' END,
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

-- ── Crea i payout del mese: tutto o niente ───────────────────────────────────
-- 1. lock degli affiliati e delle loro righe `payable` (in ordine di id);
-- 2. rilettura delle regole DOPO i lock (affiliate_payout_rows);
-- 3. se uno non è pagabile, o se il totale ricalcolato ≠ p_expected_total
--    (quello che l'admin ha visto), non si crea NIENTE e si restituisce il diff;
-- 4. altrimenti un payout `created` per affiliato (indirizzo COPIATO dal wallet
--    attivo) e le righe passano a `in_payout`.
CREATE OR REPLACE FUNCTION public.affiliate_create_payouts(
  p_ids             bigint[],
  p_period          date,
  p_expected_total  numeric,
  p_min             numeric,
  p_require_kyc     boolean,
  p_networks        text[],
  p_coins           text[],
  p_created_by      text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ids    bigint[];
  v_total  numeric := 0;
  v_bad    jsonb := '[]'::jsonb;
  v_items  jsonb := '[]'::jsonb;
  v_found  int := 0;
  v_pid    bigint;
  r        record;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}') INTO v_ids FROM unnest(p_ids) x;
  IF cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_ids');
  END IF;
  IF p_period IS DISTINCT FROM date_trunc('month', now() AT TIME ZONE 'UTC')::date THEN
    RETURN jsonb_build_object('ok', false, 'error', 'period_not_current');
  END IF;

  PERFORM 1 FROM affiliates WHERE id = ANY (v_ids) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM affiliate_commissions
    WHERE affiliate_id = ANY (v_ids) AND status = 'payable' ORDER BY id FOR UPDATE;

  FOR r IN SELECT * FROM affiliate_payout_rows(p_period, p_min, p_require_kyc, p_networks, p_coins) q
            WHERE q.affiliate_id = ANY (v_ids) LOOP
    v_found := v_found + 1;
    v_total := v_total + r.balance;
    v_items := v_items || jsonb_build_object('affiliate_id', r.affiliate_id, 'amount', r.balance);
    IF cardinality(r.reasons) > 0 THEN
      v_bad := v_bad || jsonb_build_object('affiliate_id', r.affiliate_id, 'reasons', to_jsonb(r.reasons));
    END IF;
  END LOOP;

  IF v_found <> cardinality(v_ids) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_affiliate');
  END IF;
  IF jsonb_array_length(v_bad) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_eligible', 'items', v_bad);
  END IF;
  IF v_total IS DISTINCT FROM p_expected_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'total_mismatch',
                              'expected', p_expected_total, 'actual', v_total, 'items', v_items);
  END IF;

  v_items := '[]'::jsonb;
  FOR r IN SELECT * FROM affiliate_payout_rows(p_period, p_min, p_require_kyc, p_networks, p_coins) q
            WHERE q.affiliate_id = ANY (v_ids) LOOP
    INSERT INTO affiliate_payouts
      (affiliate_id, period_month, amount_usd, coin, network, wallet_id, to_address, created_by)
    VALUES
      (r.affiliate_id, p_period, r.balance, r.coin, r.network, r.wallet_id, r.address, p_created_by)
    RETURNING id INTO v_pid;
    UPDATE affiliate_commissions SET status = 'in_payout', payout_id = v_pid
     WHERE affiliate_id = r.affiliate_id AND status = 'payable';
    v_items := v_items || jsonb_build_object('payout_id', v_pid, 'affiliate_id', r.affiliate_id, 'amount', r.balance);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'total', v_total, 'created', v_items);
END;
$$;

-- ── Registra il tx hash verificato ───────────────────────────────────────────
-- La verifica on-chain è del codice (lib/affiliate/payout-verify.ts): qui
-- arriva solo un esito già verificato (`p_paid` = abbastanza conferme).
--  · created   → submitted | paid
--  · submitted → paid (riverifica), solo con lo STESSO hash
--  · paid      → idempotente con lo stesso hash, altrimenti already_paid
--  · cancelled → mai (il CHECK vieta un hash su un annullato)
-- Lo UNIQUE (network, tx_hash, to_address) rende `hash_already_used` un hash
-- già usato per lo stesso destinatario.
CREATE OR REPLACE FUNCTION public.affiliate_payout_record_tx(
  p_id           bigint,
  p_tx_hash      text,
  p_paid         boolean,
  p_amount_coin  numeric
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_aff  bigint;
  p      affiliate_payouts%ROWTYPE;
BEGIN
  SELECT affiliate_id INTO v_aff FROM affiliate_payouts WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  PERFORM 1 FROM affiliates WHERE id = v_aff FOR UPDATE;
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
  IF p.status = 'submitted' AND p.tx_hash <> p_tx_hash THEN
    RETURN jsonb_build_object('ok', false, 'error', 'hash_mismatch');
  END IF;

  BEGIN
    UPDATE affiliate_payouts
       SET tx_hash = p_tx_hash,
           submitted_at = COALESCE(submitted_at, now()),
           status = CASE WHEN p_paid THEN 'paid' ELSE 'submitted' END,
           paid_at = CASE WHEN p_paid THEN now() END,
           amount_coin = p_amount_coin
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

-- ── Annulla un payout (admin): solo da `created` ─────────────────────────────
-- Motivo libero obbligatorio (resta all'admin); all'affiliato esce solo
-- cancel_code = 'admin_cancelled'. Le righe tornano `payable`.
CREATE OR REPLACE FUNCTION public.affiliate_cancel_payout(p_id bigint, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_aff     bigint;
  v_status  text;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_required');
  END IF;
  SELECT affiliate_id INTO v_aff FROM affiliate_payouts WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  PERFORM 1 FROM affiliates WHERE id = v_aff FOR UPDATE;
  SELECT status INTO v_status FROM affiliate_payouts WHERE id = p_id FOR UPDATE;
  IF v_status <> 'created' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_cancellable', 'status', v_status);
  END IF;

  UPDATE affiliate_payouts
     SET status = 'cancelled', cancelled_at = now(), cancel_code = 'admin_cancelled', cancel_reason = trim(p_reason)
   WHERE id = p_id;
  UPDATE affiliate_commissions SET status = 'payable', payout_id = NULL
   WHERE payout_id = p_id AND status = 'in_payout';
  RETURN jsonb_build_object('ok', true, 'affiliate_id', v_aff);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.affiliate_payout_rows(date, numeric, boolean, text[], text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_create_payouts(bigint[], date, numeric, numeric, boolean, text[], text[], text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_payout_record_tx(bigint, text, boolean, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_cancel_payout(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_payout_rows(date, numeric, boolean, text[], text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_create_payouts(bigint[], date, numeric, numeric, boolean, text[], text[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_payout_record_tx(bigint, text, boolean, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_cancel_payout(bigint, text) TO service_role;
