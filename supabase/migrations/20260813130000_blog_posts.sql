-- #SORO-RSS-0813: tabella di CATTURA per gli articoli del feed RSS Soro
-- (https://app.trysoro.com/api/rss/<uuid>, pull dal cron /api/cron/soro-rss).
-- Design concordato in #SORO-BLOG-0812-RSS-ACK (forma "hotpayout" adattata):
--   - status default 'draft' + CHECK: il gate di pubblicazione è UMANO, il
--     poller non pubblica mai. Il passaggio draft->published avviene con una
--     azione esplicita gated (forma decisa in REQ), mai in automatico.
--   - guid = chiave di idempotenza del feed (UUID Soro, isPermaLink=false).
--     Il poller usa ON CONFLICT (guid) DO NOTHING: mai UPDATE, così una bozza
--     corretta a mano non viene sovrascritta dal giro successivo.
--   - featured_image_url punta al NOSTRO storage (bucket blog-images):
--     le immagini su storage Soro diventano 404 a fine abbonamento, quindi
--     vengono scaricate e ri-ospitate all'ingestione. La sorgente originale
--     resta in source_featured_image_url per audit/retry.
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guid TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source_link TEXT,
  description TEXT,
  content_html TEXT NOT NULL,
  featured_image_url TEXT,
  source_featured_image_url TEXT,
  pub_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

-- Listing pubblico del blog: solo i published, ordinati per data.
CREATE INDEX IF NOT EXISTS idx_blog_posts_published
  ON public.blog_posts (pub_date DESC) WHERE status = 'published';

-- RLS attiva, ZERO policy: nega ogni accesso anon/authenticated; il service
-- role bypassa RLS (tutte le letture/scritture passano da exec_sql lato server).
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_posts FROM anon, authenticated;

-- Bucket pubblico per le immagini ri-ospitate. Lettura via /object/public/
-- (flag public del bucket, nessuna policy necessaria); scrittura solo service
-- role (nessuna policy su storage.objects = default deny per anon/auth).
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Rollback:
-- DROP TABLE IF EXISTS public.blog_posts;
-- DELETE FROM storage.buckets WHERE id = 'blog-images';
