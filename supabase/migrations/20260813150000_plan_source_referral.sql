-- 20260813150000_plan_source_referral.sql — #INTERNAL-INVITE-0813
--
-- NON ANCORA APPLICATA: attende APPROVE (modifica DB → gate).
--
-- Il buco che chiude, trovato collaudando il link invito interno il 2026-08-13:
-- `grantRewardDays()` (lib/referral-rewards.ts) scrive `plan_source = 'referral'`,
-- ma il CHECK in prod ammette solo paygate|shopify|stripe|paypal|manual|NULL.
-- Ogni premio Referral V2 falliva quindi con
--   new row for relation "profiles" violates check constraint "profiles_plan_source_check"
-- e il rail chiamante inghiotte l'errore (best-effort by design), per cui il
-- fallimento era invisibile: nessun bonus concesso da quando V2 è LIVE (08/08).
--
-- Peggio del semplice "non concede": `claimTier` INSERISCE la riga in
-- referral_rewards PRIMA di provare il grant, quindi ogni tentativo fallito
-- BRUCIA lo slot di idempotenza — quella persona non può più ricevere quel
-- premio nemmeno dopo il fix. In prod al 2026-08-13 15:48 WEST nessun utente
-- reale risulta colpito (referral_rewards vuota; l'unica riga generata era del
-- collaudo ed è stata rimossa).
--
-- Effetto: ALLARGA l'insieme ammesso. Non riscrive nessuna riga, non tocca
-- nessun dato esistente.
-- Rollback: rimettere il CHECK vecchio è possibile solo finché nessuna riga ha
-- plan_source = 'referral' (dopo, quelle righe vanno prima riportate a NULL).

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_source_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_source_check
  CHECK (
    plan_source = ANY (ARRAY['paygate'::text, 'shopify'::text, 'stripe'::text, 'paypal'::text, 'manual'::text, 'referral'::text])
    OR plan_source IS NULL
  );

COMMENT ON COLUMN public.profiles.plan_source IS
  'Rail che ha concesso il piano. ''referral'' = accesso REGALATO (bonus invitato, gradini referral, link invito interno): non è un pagamento e non va contato come revenue.';
