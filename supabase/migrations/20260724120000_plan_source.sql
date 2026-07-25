-- Traccia quale gateway "possiede" il piano attivo (grandfather PayGate↔Shopify).
-- Serve l'invariante: un grant Shopify NON deve sovrascrivere un abbonato PayGate
-- ancora attivo (convivenza durante la transizione crypto→carta).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_source TEXT
  CHECK (plan_source IN ('paygate','shopify','stripe','paypal','manual') OR plan_source IS NULL);

-- Backfill: gli abbonati attivi oggi sono crypto (PayGate) o attivazioni admin manuali.
-- Chi ha stripe_subscription_id valorizzato → 'stripe'; il resto degli attivi → 'paygate'.
UPDATE public.profiles
   SET plan_source = CASE
         WHEN stripe_subscription_id IS NOT NULL THEN 'stripe'
         ELSE 'paygate'
       END
 WHERE plan IN ('base','premium') AND plan_source IS NULL;
