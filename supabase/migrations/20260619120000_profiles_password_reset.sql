-- Password recovery (2026-06-19): a "forgot password" flow. We email a one-time
-- reset token (only its SHA-256 hash is stored, like activation) that lets the
-- user set a new password without knowing the old one. No usable token ever
-- lives in the DB; the column holds the hash + an expiry.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reset_token_hash text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reset_token_expires timestamptz;

-- Rollback:
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS reset_token_hash;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS reset_token_expires;
