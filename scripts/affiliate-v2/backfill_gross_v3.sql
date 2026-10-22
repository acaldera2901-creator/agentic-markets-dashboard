-- scripts/affiliate-v2/backfill_gross_v3.sql — #AFFILIATE-TERMS-V3-1022
-- Termini aff-2026-10-22-v3 (decisione di Andrea, 22/10/2026): la base lorda
-- vale anche per le commissioni GIÀ registrate. Fino a questo deploy Shopify e
-- Stripe scrivevano net_usd = lordo − imposte (gli altri rail erano già lordi).
-- Questo file riporta quelle righe al lordo. NON è una migration: a mano, con
-- APPROVE, DOPO il deploy del codice (altrimenti nuove righe nette arrivano
-- mentre si corregge), sulla connessione diretta:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
--        -c "SET lock_timeout = '5s'" -f scripts/affiliate-v2/backfill_gross_v3.sql
--
-- Prima (sola lettura) per vedere cosa cambierebbe:
--   SELECT id, affiliate_id, rail, status, gross_usd, net_usd, rate, amount_usd,
--          round(gross_usd * rate, 2) AS new_amount
--     FROM affiliate_commissions
--    WHERE kind IN ('first','renewal') AND net_usd < gross_usd;
--
-- Si ferma senza toccare niente se una riga da correggere è già in un payout
-- (in_payout/paid) o ha storni collegati: quei casi si sistemano a mano con
-- una riga di rettifica, non con un UPDATE (registro contabile). Righe void/
-- reversed non si toccano. Le righe di questo tipo NON hanno rimborsi già
-- dedotti all'incasso: nessun chiamante passava refundedUsd (verificato sul
-- codice: shopify/stripe webhook passano solo taxUsd).
-- Ordine dei lock comune: affiliates → affiliate_commissions.

DO $$
DECLARE n bigint;
BEGIN
  PERFORM 1 FROM public.affiliates ORDER BY id FOR UPDATE;
  SELECT count(*) INTO n FROM public.affiliate_commissions c
   WHERE c.kind IN ('first','renewal') AND c.net_usd < c.gross_usd
     AND (c.status IN ('in_payout','paid') OR c.payout_id IS NOT NULL
          OR EXISTS (SELECT 1 FROM public.affiliate_commissions r WHERE r.reverses_id = c.id));
  IF n > 0 THEN
    RAISE EXCEPTION 'backfill v3 rifiutato: % righe nette già in payout o con storni: rettifica manuale', n;
  END IF;

  UPDATE public.affiliate_commissions
     SET net_usd = gross_usd, amount_usd = round(gross_usd * rate, 2)
   WHERE kind IN ('first','renewal') AND net_usd < gross_usd
     AND status IN ('shadow','pending','payable') AND payout_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'backfill v3: % righe portate al lordo', n;
END $$;
