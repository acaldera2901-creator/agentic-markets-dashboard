-- Segmenti di marketing gestiti dal backoffice (#BO-SEGMENTS-FASE1).
-- Additiva + idempotente: nessuna tabella esistente toccata, safe re-run.
-- La `rule` è un mini-DSL JSON compilato in SQL parametrico lato server
-- (lib/segments.ts) — mai SQL raw dall'operatore.

CREATE TABLE IF NOT EXISTS public.segments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key            TEXT NOT NULL UNIQUE,            -- slug stabile (nome segmento/proprietà su Resend)
  name           TEXT NOT NULL,
  description    TEXT,
  rule           JSONB NOT NULL DEFAULT '{"all":[]}'::jsonb,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  resend_segment TEXT,                            -- id/nome del segmento lato Resend (nullable)
  last_count     INTEGER,
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segments_active ON public.segments (active) WHERE active;

-- Operator-only: accesso esclusivo via service role nelle route admin.
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
-- Nessuna policy → nega ogni accesso anon/authenticated; il service role bypassa RLS.

-- Rollback:
-- DROP TABLE IF EXISTS public.segments;
