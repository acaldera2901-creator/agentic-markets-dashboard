-- Client OTP auth (2026-06-05, decision Andrea: email-only login was too weak —
-- anyone knowing a customer's email could log in as them). One-time 6-digit codes
-- emailed via Resend gate the session-cookie issuance.
--
-- RLS on + no policy + no anon/authenticated grants: consistent with #010 — the
-- table is reachable only by the server via service_role (BYPASSRLS).

CREATE TABLE IF NOT EXISTS public.login_codes (
  identifier   text PRIMARY KEY,            -- normalized email; one active code per identity
  code_hash    text NOT NULL,               -- HMAC-SHA256(code, SESSION_SECRET) — plaintext never stored
  expires_at   timestamptz NOT NULL,
  attempts     int NOT NULL DEFAULT 0,      -- verify attempts on the current code (lockout at 5)
  last_sent_at timestamptz NOT NULL DEFAULT now(),  -- request cooldown anchor
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.login_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.login_codes FROM anon;
REVOKE ALL ON public.login_codes FROM authenticated;

-- Rollback: DROP TABLE public.login_codes;
