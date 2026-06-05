-- Customer password auth (2026-06-05): email-only login was too weak (anyone
-- knowing an email logged in as them). Add a password hash; the signed session
-- cookie is now gated by a password. No email/domain dependency (vs the OTP path
-- which needs a verified sending domain).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash text;

-- Rollback: ALTER TABLE public.profiles DROP COLUMN IF EXISTS password_hash;
