-- PROPOSAL #GROWTH-LIVE (approved variant: dedicated read-only role, SELECT on
-- the tables the dashboard actually reads — no service key, no write access).
--
-- Idempotent. The password is NOT in this file: pass it as a psql variable
--   psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -v growth_ro_password="$(cat pw.txt)" -f growth_ro.sql
-- Re-running it rotates the password and re-applies the settings/grants.
--
-- Tables = exactly the ones read by core/sql.ts, data/live-source.ts and
-- scripts/verify.ts (checked on feat/growth-standalone and feat/growth-a).
--
-- RLS: all 10 tables have RLS enabled and no policy targets this role, so
-- without BYPASSRLS every SELECT returns 0 rows (measured 2026-10-06: profiles
-- 0 vs 50, events 0 vs 42288). Andrea approved option (1) of #GROWTH-LIVE:
-- BYPASSRLS (applied 2026-10-06). It widens nothing beyond the GRANTs below:
-- tables not granted stay "permission denied", writes stay refused.
-- Requires the executing admin to have BYPASSRLS itself (Supabase `postgres` does).

-- NOSUPERUSER / NOREPLICATION only at CREATE: on Supabase `postgres` is not a
-- superuser, and ALTER ROLE naming those attributes is refused even to unset them.
SELECT format('CREATE ROLE growth_ro LOGIN NOSUPERUSER NOREPLICATION PASSWORD %L', :'growth_ro_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growth_ro') \gexec

ALTER ROLE growth_ro LOGIN NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS CONNECTION LIMIT 5;
SELECT format('ALTER ROLE growth_ro PASSWORD %L', :'growth_ro_password') \gexec
ALTER ROLE growth_ro SET default_transaction_read_only = on;
ALTER ROLE growth_ro SET statement_timeout = '60s';

GRANT USAGE ON SCHEMA public TO growth_ro;
GRANT SELECT ON TABLE
  public.events,
  public.profiles,
  public.paygate_orders,
  public.paypal_orders,
  public.shopify_events,
  public.odds_snapshots,
  public.match_predictions,
  public.tennis_predictions,
  public.error_patterns_log,
  public.prediction_log
TO growth_ro;
