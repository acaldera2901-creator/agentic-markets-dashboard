-- #AFFILIATE-V2-CRYPTO-1007 — PR-9: payout admin manuali.
--
-- Spec: artifacts/affiliate-v2/PROPOSAL-crypto-payout.md §3.4, SPEC-ui.md §4,
-- §12. Si appoggia a 20261007120000 (#482) e 20261015120000 (PR-5).
-- Contenuto: una colonna (affiliate_payouts.dropped_tx_hash), cinque funzioni,
-- un trigger (sospensione → annullo dei payout in preparazione).
--
-- NON si applica da sola: workflow_dispatch con `approved_sha`. Idempotente
-- (IF NOT EXISTS, CREATE OR REPLACE, DROP TRIGGER IF EXISTS). Rollback: DROP del
-- trigger, delle funzioni e della colonna.
--
-- Ordine dei lock, uguale in TUTTE le funzioni affiliate_* (anche PR-5), per non
-- creare deadlock: affiliates → affiliate_payouts → affiliate_commissions.
--
-- REGOLA (QA F1): chiunque sposti righe del ledger DA o VERSO `payable` (cron di
-- maturazione PR-8, reversal/clawback PR-3, un UPDATE a mano) blocca PRIMA la riga
-- di `affiliates` (SELECT … FOR UPDATE), poi le righe. La creazione dei payout
-- comunque non si affida a questa regola: congela per id esattamente le righe che
-- ha bloccato e sommato, quindi un importo e le righe agganciate coincidono sempre.
--
-- period_month = mese di ESECUZIONE del payout (decisione di Andrea, 15/10):
-- si crea solo per il mese corrente (UTC).

-- Hash di una tx sparita (reorg / mai minata) su un payout annullato con
-- cancel_code = 'tx_dropped'. Sta qui e non in tx_hash perché il CHECK di #482
-- vieta un hash su un annullato: così #482 resta intatta e l'hash resta a registro.
ALTER TABLE public.affiliate_payouts ADD COLUMN IF NOT EXISTS dropped_tx_hash text;

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
           -- <= 0 anche con soglia 0 (QA F7): un saldo nullo o negativo non si paga.
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

-- ── Crea i payout del mese: tutto o niente ───────────────────────────────────
-- 1. lock degli affiliati (in ordine di id);
-- 2. una sola lettura delle regole (affiliate_payout_rows) e, per ogni affiliato,
--    UN SOLO passaggio sul ledger: blocca le righe `payable` e somma QUELLE
--    (QA F1: prima si sommava una lettura e si congelava con un secondo
--    `WHERE status = 'payable'`, che in READ COMMITTED prendeva anche righe
--    diventate payable nel frattempo → payout di X con righe per più di X);
-- 3. se uno non è pagabile, o se il totale ≠ p_expected_total (quello che
--    l'admin ha visto), non si crea NIENTE e si restituisce il diff;
-- 4. altrimenti un payout `created` per affiliato (indirizzo COPIATO dal wallet
--    attivo, importo = la somma delle righe bloccate) e quelle righe, per id,
--    passano a `in_payout`.
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
  v_ids      bigint[];
  v_total    numeric := 0;
  v_bad      jsonb := '[]'::jsonb;
  v_items    jsonb := '[]'::jsonb;
  v_plan     jsonb := '[]'::jsonb;
  v_found    int := 0;
  v_pid      bigint;
  v_cids     bigint[];
  v_sum      numeric;
  v_reasons  text[];
  r          record;
  e          jsonb;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}') INTO v_ids FROM unnest(p_ids) x;
  IF cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_ids');
  END IF;
  IF p_period IS DISTINCT FROM date_trunc('month', now() AT TIME ZONE 'UTC')::date THEN
    RETURN jsonb_build_object('ok', false, 'error', 'period_not_current');
  END IF;

  PERFORM 1 FROM affiliates WHERE id = ANY (v_ids) ORDER BY id FOR UPDATE;

  FOR r IN SELECT * FROM affiliate_payout_rows(p_period, p_min, p_require_kyc, p_networks, p_coins) q
            WHERE q.affiliate_id = ANY (v_ids) ORDER BY q.affiliate_id LOOP
    v_found := v_found + 1;
    SELECT COALESCE(array_agg(c.id ORDER BY c.id), '{}'), COALESCE(SUM(c.amount_usd), 0)
      INTO v_cids, v_sum
      FROM (SELECT id, amount_usd FROM affiliate_commissions
             WHERE affiliate_id = r.affiliate_id AND status = 'payable'
             ORDER BY id FOR UPDATE) c;
    -- La soglia si giudica sulla somma delle righe bloccate, non sulla lettura.
    v_reasons := array_remove(r.reasons, 'below_threshold');
    IF v_sum < p_min OR v_sum <= 0 THEN
      v_reasons := v_reasons || 'below_threshold'::text;
    END IF;
    v_total := v_total + v_sum;
    v_items := v_items || jsonb_build_object('affiliate_id', r.affiliate_id, 'amount', v_sum);
    IF cardinality(v_reasons) > 0 THEN
      v_bad := v_bad || jsonb_build_object('affiliate_id', r.affiliate_id, 'reasons', to_jsonb(v_reasons));
    ELSE
      v_plan := v_plan || jsonb_build_object(
        'affiliate_id', r.affiliate_id, 'amount', v_sum, 'cids', to_jsonb(v_cids),
        'wallet_id', r.wallet_id, 'coin', r.coin, 'network', r.network, 'address', r.address);
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
  FOR e IN SELECT * FROM jsonb_array_elements(v_plan) LOOP
    INSERT INTO affiliate_payouts
      (affiliate_id, period_month, amount_usd, coin, network, wallet_id, to_address, created_by)
    VALUES
      ((e->>'affiliate_id')::bigint, p_period, (e->>'amount')::numeric, e->>'coin', e->>'network',
       (e->>'wallet_id')::bigint, e->>'address', p_created_by)
    RETURNING id INTO v_pid;
    -- Per id: solo le righe bloccate e sommate qui sopra (ancora nostre: lock).
    UPDATE affiliate_commissions SET status = 'in_payout', payout_id = v_pid
     WHERE id IN (SELECT (jsonb_array_elements_text(e->'cids'))::bigint);
    v_items := v_items || jsonb_build_object('payout_id', v_pid, 'affiliate_id', (e->>'affiliate_id')::bigint,
                                             'amount', (e->>'amount')::numeric);
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
  -- QA F4: un affiliato sospeso/chiuso non riceve una registrazione di pagamento
  -- (riattivarlo è una decisione umana, poi si riverifica).
  IF v_astatus <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'affiliate_not_active', 'affiliate_status', v_astatus);
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

-- ── Tx sparita: submitted → cancelled (QA F2) ────────────────────────────────
-- Un payout `submitted` la cui tx non esiste più on-chain (reorg) o è fallita
-- terrebbe le commissioni `in_payout` per sempre. La verifica on-chain la fa il
-- codice PRIMA di chiamare qui (solo esiti not_found / tx_failed: rotta
-- [id]/cancel); qui le guardie di stato: solo da `submitted`, solo se la tx è
-- registrata da almeno 30 minuti (una tx appena trasmessa può non essere ancora
-- visibile a un nodo: annullarla e ripagare sarebbe un doppio pagamento).
CREATE OR REPLACE FUNCTION public.affiliate_payout_drop_tx(p_id bigint, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_aff  bigint;
  p      affiliate_payouts%ROWTYPE;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_required');
  END IF;
  SELECT affiliate_id INTO v_aff FROM affiliate_payouts WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  PERFORM 1 FROM affiliates WHERE id = v_aff FOR UPDATE;
  SELECT * INTO p FROM affiliate_payouts WHERE id = p_id FOR UPDATE;
  IF p.status <> 'submitted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_submitted', 'status', p.status);
  END IF;
  IF p.submitted_at > now() - interval '30 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_recent');
  END IF;

  UPDATE affiliate_payouts
     SET status = 'cancelled', cancelled_at = now(), cancel_code = 'tx_dropped',
         cancel_reason = trim(p_reason), dropped_tx_hash = tx_hash, tx_hash = NULL, amount_coin = NULL
   WHERE id = p_id;
  UPDATE affiliate_commissions SET status = 'payable', payout_id = NULL
   WHERE payout_id = p_id AND status = 'in_payout';
  RETURN jsonb_build_object('ok', true, 'affiliate_id', v_aff, 'dropped_tx_hash', p.tx_hash);
END;
$$;

-- ── Sospensione → annullo dei payout in preparazione (QA F4) ────────────────
-- Trigger e non codice: vale per chiunque cambi lo stato (oggi non c'è un
-- endpoint di sospensione, si fa a mano). Gira dentro l'UPDATE di affiliates,
-- che ha già il lock della riga: ordine dei lock rispettato.
CREATE OR REPLACE FUNCTION public.affiliate_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status <> 'active' THEN
    PERFORM affiliate_cancel_created_payouts(NEW.id, 'affiliate_suspended', 'affiliate_' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliates_status_cancel_payouts ON public.affiliates;
CREATE TRIGGER trg_affiliates_status_cancel_payouts
  AFTER UPDATE OF status ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_on_status_change();

REVOKE EXECUTE ON FUNCTION public.affiliate_payout_rows(date, numeric, boolean, text[], text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_create_payouts(bigint[], date, numeric, numeric, boolean, text[], text[], text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_payout_record_tx(bigint, text, boolean, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_cancel_payout(bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_payout_drop_tx(bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_on_status_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_payout_rows(date, numeric, boolean, text[], text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_create_payouts(bigint[], date, numeric, numeric, boolean, text[], text[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_payout_record_tx(bigint, text, boolean, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_cancel_payout(bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_payout_drop_tx(bigint, text) TO service_role;
