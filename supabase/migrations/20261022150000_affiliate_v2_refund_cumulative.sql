-- #AFFILIATE-REFUND-CUMULATIVE-1022 — storno proporzionale sul rimborsato CUMULATO.
--
-- Chiude il debito «micro-rimborsi» di 20261022120000 (review Codex #3, PR #550):
-- la quota di ogni storno parziale era round(commissione × rimborso / lordo, 2)
-- calcolata per singolo rimborso. Un rimborso con quota sotto mezzo centesimo
-- non scriveva riga (il CHECK vieta uno storno da 0) e il suo lordo spariva dal
-- cumulato: N micro-rimborsi lasciavano fino a N centesimi di commissione, e il
-- referito restava «pagante» per lo scaglione.
--
-- Ora ogni evento di rimborso (anche con quota zero) si registra in
-- affiliate_refund_events, chiave (rail, pagamento, evento) = idempotenza della
-- redelivery. Lo storno di un evento è
--     round(commissione × rimborsato_cumulato / lordo, 2) − già_stornato
-- quindi dopo ogni evento la somma degli storni è ESATTAMENTE la quota
-- proporzionale del rimborsato totale (mai oltre la commissione residua).
-- Il lordo della riga di storno è il rimborsato non ancora coperto da righe:
-- la somma del lordo delle righe = rimborsato cumulato.
--
-- ADDITIVA: una tabella nuova (senza FK verso il ledger: niente lock nuovi su
-- affiliate_commissions), backfill dagli storni già scritti, ridefinizione di
-- affiliate_reverse_commission (stessa firma, stesso contratto di risposta,
-- stesso ordine di lock affiliates → affiliate_commissions). Il ledger non
-- cambia schema e le righe esistenti non si toccano.
--
-- NON si applica da sola: workflow_dispatch con `approved_sha`, DOPO
-- 20261022140000. Idempotente (IF NOT EXISTS / ON CONFLICT / CREATE OR REPLACE).
-- Rollback: scripts/affiliate-v2/rollback_refund_cumulative_1022.sql.

CREATE TABLE IF NOT EXISTS public.affiliate_refund_events (
  rail              text           NOT NULL,
  rail_payment_ref  text           NOT NULL,
  rail_event_ref    text           NOT NULL,
  -- Lordo rimborsato da questo evento (per uno storno totale senza importo: il
  -- lordo che restava da rimborsare).
  refunded_usd      numeric(12,2)  NOT NULL CHECK (refunded_usd >= 0),
  created_at        timestamptz    NOT NULL DEFAULT now(),
  PRIMARY KEY (rail, rail_payment_ref, rail_event_ref)
);

ALTER TABLE public.affiliate_refund_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affiliate_refund_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.affiliate_refund_events TO service_role;

-- Backfill: gli storni scritti dalla versione precedente entrano nel cumulato
-- col loro lordo (per uno storno totale è già il lordo residuo). Gli `void` no,
-- come nel calcolo del residuo. I micro-rimborsi passati senza riga non sono
-- recuperabili (nessuna traccia): nessun rail ne ha emessi (non verificato su prod).
INSERT INTO public.affiliate_refund_events (rail, rail_payment_ref, rail_event_ref, refunded_usd, created_at)
SELECT rail, rail_payment_ref, rail_event_ref, GREATEST(-gross_usd, 0), created_at
  FROM public.affiliate_commissions
 WHERE kind IN ('reversal','clawback') AND status <> 'void'
ON CONFLICT (rail, rail_payment_ref, rail_event_ref) DO NOTHING;

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
  v_done_net    numeric;
  v_done_gross  numeric;
  v_prev        numeric;
  v_this        numeric;
  v_cum         numeric;
  v_remaining   numeric;
  v_amount      numeric;
  v_net         numeric;
  v_gross       numeric;
  v_full        boolean;
  v_kind        text;
  v_status      text;
  v_after       timestamptz;
BEGIN
  -- Review indipendente (nit): NULL disattiverebbe la finestra di clawback.
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
  -- Duplicato = evento già registrato (anche con quota zero) o già in una riga.
  IF EXISTS (SELECT 1 FROM affiliate_refund_events
              WHERE rail = p_rail AND rail_payment_ref = p_ref AND rail_event_ref = p_event)
     OR EXISTS (SELECT 1 FROM affiliate_commissions
              WHERE rail = p_rail AND rail_payment_ref = p_ref
                AND rail_event_ref = p_event AND kind IN ('reversal','clawback')) THEN
    RETURN jsonb_build_object('ok', true, 'written', false, 'reason', 'duplicate');
  END IF;
  IF o.status NOT IN ('shadow','pending','payable','in_payout','paid') THEN
    RETURN jsonb_build_object('ok', true, 'written', false, 'reason', 'original_' || o.status);
  END IF;

  SELECT COALESCE(SUM(-amount_usd), 0), COALESCE(SUM(-net_usd), 0), COALESCE(SUM(-gross_usd), 0)
    INTO v_done, v_done_net, v_done_gross
    FROM affiliate_commissions
   WHERE rail = p_rail AND rail_payment_ref = p_ref
     AND kind IN ('reversal','clawback') AND status <> 'void';
  v_remaining := o.amount_usd - v_done;
  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'written', false, 'reason', 'already_reversed');
  END IF;
  -- Fuori finestra: non si registra nemmeno l'evento (nessuna azione).
  IF o.status NOT IN ('shadow','pending')
     AND now() - o.paid_at > make_interval(days => p_clawback_days) THEN
    RETURN jsonb_build_object('ok', true, 'written', false, 'reason', 'outside_clawback_window');
  END IF;

  SELECT COALESCE(SUM(refunded_usd), 0) INTO v_prev FROM affiliate_refund_events
   WHERE rail = p_rail AND rail_payment_ref = p_ref;
  v_this := CASE WHEN p_refunded IS NULL THEN GREATEST(o.gross_usd - v_prev, 0)
                 ELSE round(p_refunded, 2) END;
  v_cum := v_prev + v_this;
  INSERT INTO affiliate_refund_events (rail, rail_payment_ref, rail_event_ref, refunded_usd)
  VALUES (p_rail, p_ref, p_event, v_this);

  -- Totale (o entro 1 cent dal lordo): chiude il residuo, niente centesimi orfani.
  IF p_refunded IS NULL OR o.gross_usd <= 0 OR v_cum + 0.01 >= o.gross_usd THEN
    v_amount := v_remaining;
    v_net    := o.net_usd - v_done_net;
    v_gross  := GREATEST(o.gross_usd - v_done_gross, 0);
  ELSE
    -- Quota cumulata meno il già stornato. È monotona nel cumulato, quindi ≥ 0
    -- salvo storni legacy arrotondati per eccesso (allora 0 e si recupera dopo).
    v_amount := LEAST(v_remaining, round(o.amount_usd * v_cum / o.gross_usd, 2) - v_done);
    v_net    := round(o.net_usd * (v_done + v_amount) / o.amount_usd, 2) - v_done_net;
    v_gross  := GREATEST(v_cum - v_done_gross, 0);
  END IF;
  IF v_amount <= 0 THEN
    -- L'evento resta registrato: il suo lordo entra nel cumulato del prossimo.
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
     -v_gross, -GREATEST(v_net, 0), o.rate, -v_amount, o.renewal_index, v_status,
     o.paid_at, v_after, o.id);

  RETURN jsonb_build_object('ok', true, 'written', true, 'reason', v_kind, 'status', v_status,
                            'amount', -v_amount, 'full', v_full);
END $$;

REVOKE EXECUTE ON FUNCTION public.affiliate_reverse_commission(text, text, text, numeric, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_reverse_commission(text, text, text, numeric, integer) TO service_role;
