-- #NEWSWATCH-2-IMG (APPROVE di Andrea 29/10): the cards made by the local news watcher.
-- Additive only. Rollback at the bottom.

-- 1. Public bucket: anyone with the URL can READ a card (it is shown on the site);
--    no storage.objects policy is added, so anon/authenticated can neither list,
--    upload, overwrite nor delete. Only the service role (the watcher) writes.
--    webp only, 300 KB max per file (cards weigh 15–55 KB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news-images', 'news-images', true, 307200, array['image/webp'])
on conflict (id) do nothing;

-- 2. The card of a note: NULL = no card (the site shows the picture of its kind).
--    Only a public URL of that bucket with our opaque name news-<12 hex>.webp is accepted.
alter table public.news_items
  add column if not exists image_url text
  check (image_url is null or image_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/news-images/news-[0-9a-f]{12}\.webp$');

-- Rollback:
--   alter table public.news_items drop column if exists image_url;
--   (empty the bucket from the dashboard or the Storage API, then)
--   delete from storage.buckets where id = 'news-images';
