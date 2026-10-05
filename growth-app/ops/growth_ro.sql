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
-- OPEN DECISION (RLS): all 10 tables have RLS enabled and no policy targets this
-- role, so every SELECT returns 0 rows (measured 2026-10-06: profiles 0 vs 50,
-- events 0 vs 42288). The live source is unusable until Andrea picks one of:
--   (1) ALTER ROLE growth_ro BYPASSRLS;  -- same tables, all rows (blast radius
--       already assumed by the PROPOSAL: "profiles leggibile a livello DB")
--   (2) one `CREATE POLICY growth_ro_read ON <t> FOR SELECT TO growth_ro USING (true)`
--       per table (DDL on 10 prod tables)
--   (3) security_barrier views + GRANT only on the views (the stricter variant).
-- Not applied here: it was outside the approved change-spec.

-- NOSUPERUSER / NOREPLICATION only at CREATE: on Supabase `postgres` is not a
-- superuser, and ALTER ROLE naming those attributes is refused even to unset them.
SELECT format('CREATE ROLE growth_ro LOGIN NOSUPERUSER NOREPLICATION PASSWORD %L', :'growth_ro_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growth_ro') \gexec

ALTER ROLE growth_ro LOGIN NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS CONNECTION LIMIT 5;
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
