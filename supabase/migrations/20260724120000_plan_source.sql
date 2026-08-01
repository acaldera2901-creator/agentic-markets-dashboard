-- Traccia quale gateway "possiede" il piano attivo (grandfather PayGate↔Shopify).
-- Serve l'invariante: un grant Shopify NON deve sovrascrivere un abbonato PayGate
-- ancora attivo (convivenza durante la transizione crypto→carta).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_source TEXT
  CHECK (plan_source IN ('paygate','shopify','stripe','paypal','manual') OR plan_source IS NULL);

-- Backfill: gli abbonati attivi oggi sono crypto (PayGate) o attivazioni admin manuali.
-- Chi ha stripe_subscription_id valorizzato → 'stripe'; il resto degli attivi → 'paygate'.
-- #MIGRATION-REPLAY-0801 — `created_at < '2026-07-24'` è una GUARDIA DI REPLAY.
-- L'`ELSE 'paygate'` era vero il 24/07, quando gli unici abbonati attivi erano
-- crypto o attivazioni manuali. Da allora è nato il rail carta Shopify: un replay
-- oggi etichetterebbe 'paygate' i piani con plan_source ancora NULL — misurati il
-- 2026-08-01: tre premium, di cui uno creato il 26/07, cioè in piena era Shopify.
-- Sarebbe un'attribuzione inventata su una colonna che il reporting per-rail usa
-- come fonte.
-- Non altera la storia: i profili creati dopo il 24/07 non esistevano quando la
-- migration girò, quindi la popolazione toccata allora è la stessa. Da ora in poi
-- un replay è un no-op.
-- NB i tre premium con plan_source NULL restano da attribuire A MANO, con
-- l'evidenza dell'ordine: era il minore segnalato il 29/07 e non si chiude
-- indovinando.
UPDATE public.profiles
   SET plan_source = CASE
         WHEN stripe_subscription_id IS NOT NULL THEN 'stripe'
         ELSE 'paygate'
       END
 WHERE plan IN ('base','premium')
   AND plan_source IS NULL
   AND created_at < '2026-07-24';
