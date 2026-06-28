-- CRM lifecycle (#CRM-LIFECYCLE). Additiva + idempotente.
CREATE TABLE IF NOT EXISTS public.crm_trigger_sends (
  trigger_key TEXT NOT NULL,
  identifier  TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trigger_key, identifier)
);
ALTER TABLE public.crm_trigger_sends ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

-- Rollback:
-- DROP TABLE IF EXISTS public.crm_trigger_sends;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS marketing_opt_out;
