-- #IG-LINK-1106 — clicks on first-party campaign links (betredge.com/ig for the Instagram bio). Additive, aggregate metric only.
-- IP and UA are stored ONLY as HMAC (AFFILIATE_HASH_SECRET, IP with the UTC day: unique clicks per day, no link across days); nothing is written on the device.
-- Rollback: DROP TABLE public.link_clicks (no other table references it).
CREATE TABLE IF NOT EXISTS public.link_clicks (
  id          bigserial   PRIMARY KEY,
  channel     text        NOT NULL CHECK (channel ~ '^[a-z0-9-]{1,40}$'),
  clicked_at  timestamptz NOT NULL DEFAULT now(),
  ip_hash     text,
  ua_hash     text,
  landing     text
);
CREATE INDEX IF NOT EXISTS link_clicks_channel_time_idx ON public.link_clicks (channel, clicked_at);
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.link_clicks FROM anon, authenticated;
GRANT ALL ON public.link_clicks TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.link_clicks_id_seq TO service_role;
