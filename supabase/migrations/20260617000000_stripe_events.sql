-- Stripe webhook idempotency (#BUGCHECK-0617 P0).
-- Records every processed Stripe event id so a redelivered / replayed event
-- (e.g. invoice.paid) is handled exactly once: no double plan-extension, no
-- duplicate receipt email. The webhook does INSERT ... ON CONFLICT DO NOTHING
-- RETURNING; a returned row means "first delivery, process it".
--
-- service_role only: written by the webhook handler via exec_sql. No anon /
-- authenticated access (consistent with the exec_sql hardening migration).

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id     TEXT PRIMARY KEY,
  event_type   TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- No policies + revoke: only service_role (which bypasses RLS) can touch it.
REVOKE ALL ON stripe_events FROM anon, authenticated;
