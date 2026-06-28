-- Consenso marketing esplicito (#CRM-LIFECYCLE, requisito legale-compliance 2026-06-28).
-- L'acquisition (sconti a utenti free mai paganti) richiede opt-in ESPLICITO,
-- non basta il soft opt-in. Default FALSE: finché non c'è la checkbox al signup,
-- nessun free riceve email di acquisition.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

-- Rollback:
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS marketing_opt_in;
