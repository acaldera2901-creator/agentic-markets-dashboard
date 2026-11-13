-- Private profile storage, exposed only through authenticated server routes.
CREATE TABLE IF NOT EXISTS public.community_profiles (
 user_id text PRIMARY KEY REFERENCES public.profiles(identifier) ON DELETE CASCADE,
 display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 40),
 username text CHECK (username IS NULL OR (username ~ '^[a-z0-9_]{3,20}$' AND username NOT IN ('admin','administrator','support','betredge','moderator','official','staff','system','root','help','api','news'))),
 bio text NOT NULL DEFAULT '' CHECK (length(bio)<=160),
 avatar_url text CHECK (avatar_url IS NULL OR (avatar_url LIKE 'data:image/webp;base64,%' AND length(avatar_url)<=64000)),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS community_profiles_username_unique ON public.community_profiles(lower(username)) WHERE username IS NOT NULL;
ALTER TABLE public.community_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_profiles FROM anon,authenticated;
GRANT ALL ON public.community_profiles TO service_role;
CREATE INDEX IF NOT EXISTS news_comments_user_activity_idx ON public.news_comments(user_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS news_likes_user_activity_idx ON public.news_likes(user_id,created_at DESC,news_guid);
