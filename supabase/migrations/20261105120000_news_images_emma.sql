-- #NEWS-EMMA-CARDS (G4): vertical 4:5 cards are published as news-<12 hex>-e.webp, with the photo credit
-- beside them as news-<12 hex>-e.credit.json. Additive and reversible. NOT applied anywhere: needs APPROVE of Andrea.
-- Rollback: supabase/rollbacks/20261105120000_news_images_emma.rollback.sql

-- 1. image_url may also be news-<12 hex>-e.webp (same constraint name, drop + add).
alter table public.news_items drop constraint if exists news_items_image_url_check;
alter table public.news_items
  add constraint news_items_image_url_check
  check (image_url is null or image_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/news-images/news-[0-9a-f]{12}(-e)?\.webp$');

-- 2. The bucket also accepts the credit file (json, a few hundred bytes; the 300 KB limit stays).
-- Pinned to the bucket not yet allowing json: a replay finds no row (#CI-VERDE-1111).
update storage.buckets set allowed_mime_types = array['image/webp','application/json']
  where id = 'news-images' and not (coalesce(allowed_mime_types, array[]::text[]) @> array['application/json']);
