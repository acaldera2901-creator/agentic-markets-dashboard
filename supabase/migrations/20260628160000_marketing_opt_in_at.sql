-- Timestamp del consenso marketing (prova ex art.7.1 GDPR), #CRM-LIFECYCLE.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marketing_opt_in_at TIMESTAMPTZ;
-- Rollback: ALTER TABLE public.profiles DROP COLUMN IF EXISTS marketing_opt_in_at;
