-- Persistent community actions. Public clients cannot access identifiers directly.
CREATE TABLE IF NOT EXISTS public.news_likes (
 news_guid text NOT NULL REFERENCES public.news_items(guid_hash) ON DELETE CASCADE,
 user_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(news_guid,user_id)
);
CREATE TABLE IF NOT EXISTS public.news_comments (
 id uuid PRIMARY KEY,
 news_guid text NOT NULL REFERENCES public.news_items(guid_hash) ON DELETE CASCADE,
 user_id text NOT NULL,
 display_name text NOT NULL CHECK(length(display_name) BETWEEN 1 AND 60),
 body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 minute_bucket bigint NOT NULL,
 UNIQUE(user_id,minute_bucket)
);
CREATE INDEX IF NOT EXISTS news_comments_feed_idx ON public.news_comments(news_guid,created_at DESC,id DESC);
ALTER TABLE public.news_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.news_likes,public.news_comments FROM anon,authenticated;
GRANT ALL ON public.news_likes,public.news_comments TO service_role;
