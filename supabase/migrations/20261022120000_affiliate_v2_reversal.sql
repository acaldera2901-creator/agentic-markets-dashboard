-- #AFFILIATE-REVERSAL-1022 — storno / clawback di una commissione in UNA transazione.
--
-- SOLO ADDITIVA: una funzione, nessuna tabella o colonna. Usa le colonne di
-- reversal/clawback già create da 20261007120000 (kind, rail_event_ref,
-- reverses_id, CHECK sul segno). Spec: artifacts/affiliate-v2/PROPOSAL-tecnica.md
-- §4.2 (reversal.ts), termini affiliati §4 (storno proporzionale entro 120 gg).
--
-- Perché una funzione e non exec_sql: exec_sql non dà una transazione, e la
-- review indipendente ha mostrato quattro corse reali (stesso rimborso
-- consegnato due volte a cavallo della maturazione, due rimborsi diversi oltre
-- il residuo, un parziale orfano dopo un totale, un parziale `pending` scritto
-- dopo la maturazione dell'originale). Qui tutto avviene dopo il lock della riga
-- originale, nell'ordine di lock comune a tutte le funzioni affiliate_*:
-- affiliates → affiliate_commissions (vedi 20261015130000). La maturazione
-- (UPDATE sulle stesse righe) si serializza sul lock della riga.
--
-- Regole:
--  · originale shadow|pending → riga `reversal`. Totale: originale e storni
--    parziali non maturati → `reversed`, la riga nasce `reversed`. Parziale: nasce
--    nello stato dell'originale con lo stesso payable_after (matura con lui).
--  · originale payable|in_payout|paid entro p_clawback_days da paid_at → riga
--    `clawback` `payable`, che si compensa sul saldo successivo.
--  · mai oltre la commissione residua; un rimborso che porta il rimborsato
--    cumulato al lordo (± 1 cent) chiude il residuo (niente centesimi orfani).
--  · idempotente per (rail, pagamento, evento), qualunque kind ne sia uscito.
--
-- Ridefinisce anche affiliate_mature_commissions (20261020150000) perché
-- rispetti la regola QA F1 di 20261015130000: chi sposta righe verso `payable`
-- blocca PRIMA le righe di `affiliates`. Senza quel lock la maturazione prendeva
-- lo snapshot prima del commit di uno storno parziale concorrente: promuoveva
-- l'originale e lasciava lo storno `pending` fino al giro successivo, e un
-- payout creato nel mezzo pagava la commissione intera (review Codex #2).
--
-- LIMITE NOTO (debito accettato, review Codex #3): un rimborso la cui quota di
-- commissione arrotonda a 0 (meno di mezzo centesimo: rimborsi sotto ~2,5 cent
-- al 20%) non si registra — il CHECK vieta una riga negativa da 0 — e il suo
-- lordo non entra nel cumulato. N micro-rimborsi seguiti dal saldo possono
-- lasciare fino a N centesimi di commissione, e quel referito resta «pagante»
-- per lo scaglione. Nessun rail oggi emette rimborsi di pochi centesimi su
-- abbonamenti da 14,99 $ in su. Upgrade path: colonna refunded_gross sulla riga
-- originale, aggiornata anche quando la quota è zero.
--
-- NON si applica da sola: workflow_dispatch con `approved_sha`. Idempotente
-- (CREATE OR REPLACE). Rollback: DROP della funzione di storno e ri-esecuzione
-- di 20261020150000 per la maturazione (le righe scritte restano: sono registro
-- contabile).

CREATE OR REPLACE FUNCTION public.affiliate_reverse_commission(
  p_rail           text,
  p_ref            text,
  p_event          text,
  p_refunded       numeric,
  p_clawback_days  integer
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  o             affiliate_commissions%ROWTYPE;
  v_aff         bigint;
  v_done        numeric;
  v_done_gross  numeric;
  v_remaining   numeric;
  v_amount      numeric;
  v_gross       numeric;
  v_full        boolean;
  v_kind        text;
  v_status      text;
  v_after       timestamptz;
BEGIN
  -- Review indipendente (nit): NULL disattiverebbe la finestra di clawback
  -- (now() - paid_at > NULL è NULL, cioè «dentro»). Fail-loud.
  IF p_clawback_days IS NULL OR p_clawback_days < 0 THEN
    RAISE EXCEPTION 'affiliate_reverse_commission: p_clawback_days required (got %)', p_clawback_days;
  END IF;
  IF coalesce(trim(p_ref), '') = '' OR coalesce(trim(p_event), '') = '' THEN
    RETURN jsonb_build_object('ok', true, 'written', false, 'reason', 'missing_ref');
  END IF;
  IF p_refunded IS NOT NULL AND p_refunded <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'written', false, 'reason', 'zero_refund');
  END IF;

  SELECT affiliate_id INTO v_aff FROM affiliate_commissions
   WHERE rail = p_rail AND rail_payment_ref = p_ref AND kind IN ('first','renewal');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'written', false, 'reason', 'no_commission');
  END IF;

  PERFORM 1 FROM affiliates WHERE id = v_aff FOR UPDATE;
  SELECT * INTO o FROM affiliate_commissions
   WHERE rail = p_rail AND rail_payment_ref = p_ref AND kind IN ('first','renewal')
   FOR UPDATE;

  -- Dopo il lock: ogni lettura vede ciò che gli altri hanno già committato.
  IF EXISTS (SELECT 1 FROM affiliate_commissions
              WHERE rail = p_rail AND rail_payment_ref = p_ref
                AND rail_event_ref = p_event AND kind IN ('reversal','clawback')) THEN
    RETURN jsonb_build_object('ok', true, 'written', false, 'reason', 'duplicate');
  END IF;
  IF o.status NOT IN ('shadow','pending','payable','in_payout','paid') THEN
    RETURN jsonb_build_object('ok', true, 'written', false, 'reason', 'original_' || o.status);
  END IF;

  SELECT COALESCE(SUM(-amount_usd), 0), COALESCE(SUM(-gross_usd), 0)
    INTO v_done, v_done_gross
    FROM affiliate_commissions
   WHERE rail = p_rail AND rail_payment_ref = p_ref
     AND kind IN ('reversal','clawback') AND status <> 'void';
  v_remaining := o.amount_usd - v_done;
  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'written', false, 'reason', 'already_reversed');
  END IF;

  IF p_refunded IS NULL OR o.gross_usd <= 0 OR v_done_gross + p_refunded + 0.01 >= o.gross_usd THEN
    v_amount := v_remaining;
    v_gross  := GREATEST(o.gross_usd - v_done_gross, 0);
  ELSE
    v_amount := LEAST(v_remaining, round(o.amount_usd * p_refunded / o.gross_usd, 2));
    v_gross  := round(p_refunded, 2);
  END IF;
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'written', false, 'reason', 'zero_amount');
  END IF;
  v_full := v_amount >= v_remaining;

  IF o.status IN ('shadow','pending') THEN
    v_kind  := 'reversal';
    v_after := o.payable_after;
    IF v_full THEN
      UPDATE affiliate_commissions SET status = 'reversed'
       WHERE rail = p_rail AND rail_payment_ref = p_ref
         AND status IN ('shadow','pending') AND payout_id IS NULL;
      v_status := 'reversed';
    ELSE
      v_status := o.status;
    END IF;
  ELSE
    IF now() - o.paid_at > make_interval(days => p_clawback_days) THEN
      RETURN jsonb_build_object('ok', true, 'written', false, 'reason', 'outside_clawback_window');
    END IF;
    v_kind   := 'clawback';
    v_status := 'payable';
    v_after  := now();
  END IF;

  INSERT INTO affiliate_commissions
    (affiliate_id, referred_identifier, rail, rail_payment_ref, rail_event_ref, kind,
     gross_usd, net_usd, rate, amount_usd, renewal_index, status,
     paid_at, payable_after, reverses_id)
  VALUES
    (o.affiliate_id, o.referred_identifier, p_rail, p_ref, p_event, v_kind,
     -v_gross, -round(o.net_usd * v_amount / o.amount_usd, 2), o.rate, -v_amount, o.renewal_index, v_status,
     o.paid_at, v_after, o.id);

  RETURN jsonb_build_object('ok', true, 'written', true, 'reason', v_kind, 'status', v_status,
                            'amount', -v_amount, 'full', v_full);
END $$;

REVOKE EXECUTE ON FUNCTION public.affiliate_reverse_commission(text, text, text, numeric, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_reverse_commission(text, text, text, numeric, integer) TO service_role;

-- ── Maturazione con il lock comune (sostituisce 20261020150000) ─────────────
CREATE OR REPLACE FUNCTION public.affiliate_mature_commissions()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  -- Prima affiliates (ordine di lock comune), poi l'UPDATE: in READ COMMITTED
  -- l'UPDATE prende lo snapshot DOPO aver ottenuto i lock, quindi vede anche gli
  -- storni committati da chi teneva il lock.
  PERFORM 1 FROM public.affiliates WHERE status = 'active' ORDER BY id FOR UPDATE;
  UPDATE public.affiliate_commissions c SET status = 'payable'
  FROM public.affiliates a, public.affiliate_attributions t
  WHERE c.affiliate_id = a.id AND a.status = 'active'
    AND t.affiliate_id = a.id AND t.referred_identifier = c.referred_identifier AND t.status = 'valid'
    AND c.status = 'pending' AND c.payable_after <= now() AND c.payout_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'matured', n);
END $$;
REVOKE ALL ON FUNCTION public.affiliate_mature_commissions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_mature_commissions() TO service_role;
