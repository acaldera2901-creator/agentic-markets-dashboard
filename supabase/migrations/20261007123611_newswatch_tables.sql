-- News watcher tables (#NEWSWATCH-1, APPROVE Andrea 2026-10-07).
-- Applied to izscgffubtakzvwxchqt via apply_migration «newswatch_tables» (version 20261007123611).
-- Spec: docs/redesign/news-watcher-proposal.md §1. Rollback: DROP TABLE public.news_items; DROP TABLE public.news_state;
BEGIN;

CREATE TABLE public.news_items (
  guid_hash      text PRIMARY KEY CHECK (guid_hash ~ '^[0-9a-f]{64}$'),   -- sha256 of the source guid
  source         text NOT NULL CHECK (length(source) BETWEEN 1 AND 80),
  source_url     text NOT NULL CHECK (source_url ~ '^https?://'),
  published_at   timestamptz NOT NULL,
  rewritten_en   jsonb NOT NULL CHECK (jsonb_typeof(rewritten_en->'title') = 'string' AND jsonb_typeof(rewritten_en->'body') = 'string'),
  rewritten_it   jsonb NOT NULL CHECK (jsonb_typeof(rewritten_it->'title') = 'string' AND jsonb_typeof(rewritten_it->'body') = 'string'),
  teams          text[] NOT NULL DEFAULT '{}',
  rewrite_model  text NOT NULL,
  rewritten_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- no original title or teaser: by construction there is no column to put them in
CREATE INDEX news_items_published_at_idx ON public.news_items (published_at DESC);

CREATE TABLE public.news_state (
  id             smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled        boolean NOT NULL DEFAULT true,
  last_run_at    timestamptz,
  last_error     text,
  source_status  text NOT NULL DEFAULT 'ok' CHECK (source_status IN ('ok','degraded','blocked','limited')),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.news_state (id, enabled) VALUES (1, true);

-- RLS on, NO policy: anon/authenticated neither read nor write; service role only
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.news_items, public.news_state FROM anon, authenticated;

COMMIT;
