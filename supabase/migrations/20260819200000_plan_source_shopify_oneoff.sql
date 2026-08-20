-- 20260819200000_plan_source_shopify_oneoff.sql — #PLAN-SOURCE-ONEOFF-0819
--
-- NON ANCORA APPLICATA: attende APPROVE (modifica DB → gate).
--
-- IL BUCO CHE CHIUDE, e non è teorico: `lib/plan-grant.ts:370` scrive
--   const source = oneOff ? "shopify_oneoff" : "shopify";
-- ma NESSUNA migration ha mai ammesso 'shopify_oneoff' nel CHECK. L'ultimo vincolo
-- definito (20260813150000_plan_source_referral.sql, applicata — lo dimostra la riga
-- con plan_source='referral' presente in prod) permette esattamente:
--   paygate | shopify | stripe | paypal | manual | referral | NULL
-- Quindi il PRIMO acquisto dello SKU one-off Shopify — il rail crypto pagato con
-- carta — proverebbe a scrivere un valore vietato e l'UPDATE fallirebbe su
--   new row for relation "profiles" violates check constraint "profiles_plan_source_check"
-- cioè: il cliente paga e non riceve il piano.
--
-- È LA STESSA FORMA del bug che la migration del 13/08 documenta per 'referral':
-- codice che scrive un valore che il CHECK non conosce, su un rail il cui chiamante
-- non fa rumore. Là era un bonus non concesso in silenzio; qui è un pagamento.
-- Oggi in prod nessuna riga ha 'shopify_oneoff' (valori presenti: shopify 1,
-- paygate 4, manual 3, referral 1, NULL 11), quindi NESSUN cliente è stato colpito:
-- si chiude prima che accada, non dopo.
--
-- ⚠️ DA VERIFICARE PRIMA DI APPLICARLA: il vincolo VIVO potrebbe già ammettere il
-- valore. Nella finestra di drift delle migration (29 versioni remote senza file
-- locali, luglio-agosto) alcune ALTER sono state applicate a mano, quindi il file
-- non è una prova di cosa c'è in prod. Chi ha accesso esegua
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'profiles_plan_source_check';
-- e se 'shopify_oneoff' c'è già, questa migration è un no-op da registrare e basta.
--
-- Effetto: ALLARGA l'insieme ammesso. Non riscrive nessuna riga, non tocca nessun
-- dato esistente, non cambia nessun default.
-- Rollback: rimettere il CHECK precedente è possibile solo finché nessuna riga ha
-- plan_source = 'shopify_oneoff' (dopo, quelle righe vanno prima riportate a NULL).

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_source_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_source_check
  CHECK (
    plan_source = ANY (ARRAY[
      'paygate'::text,
      'shopify'::text,
      'shopify_oneoff'::text,
      'stripe'::text,
      'paypal'::text,
      'manual'::text,
      'referral'::text
    ])
    OR plan_source IS NULL
  );

COMMENT ON COLUMN public.profiles.plan_source IS
  'Rail che ha concesso il piano. Distingue anche il RINNOVO: ''shopify'' e ''stripe'' = contratto ricorrente che si rinnova da solo; ''shopify_oneoff'', ''paygate'', ''paypal'' = pagamento singolo che NON si rinnova; ''referral''/''manual'' = accesso regalato, non è un pagamento e non va contato come revenue. Il CRM legge questo campo per non dire a un abbonato che deve pagare di nuovo (#CRM-RENEWAL-COND-0819).';
