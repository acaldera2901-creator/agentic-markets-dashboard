-- Rollback of PROPOSAL #GROWTH-LIVE. Two independent parts — run only the one you need.
--
-- ─── Part A: undo the profiles column grant (2026-10-07) ─────────────────────
-- Restores table-level SELECT on public.profiles for growth_ro (re-opens
-- password_hash / reset_token_hash: use only if the dashboard breaks).
--
--   psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "GRANT SELECT ON public.profiles TO growth_ro;"
--
-- (Idempotent. The column grants become redundant; to leave no residue also run
--  REVOKE SELECT ON public.profiles FROM growth_ro; first.)
--
-- State BEFORE the change (measured 2026-10-07 08:31 UTC, as postgres):
--   pg_class.relacl  = {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,growth_ro=r/postgres}
--   table_privileges (growth_ro, profiles) = SELECT
--   column_privileges rows (growth_ro, profiles) = 34 (all columns, inherited from the table grant)
--   pg_attribute.attacl non-null on profiles = 0 rows
-- State AFTER: relacl without growth_ro; attacl growth_ro=r/postgres on exactly
--   id, created_at, tos_accepted_at, activated_at, referred_by, acquisition,
--   plan, plan_source, plan_expires_at.
--
-- ─── Part B: remove the growth_ro role entirely (this file, below) ───────────
-- Touches no data.
-- Before running: remove GROWTH_DATABASE_URL / GROWTH_DATA_SOURCE from the
-- Vercel project betredge-growth (otherwise the live page shows ERRORE tiles).
--
--   psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -f growth_ro_rollback.sql
--
-- Idempotent: does nothing if the role is already gone.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growth_ro') THEN
    -- revoke the RLS bypass first, then close open sessions of the role
    -- and drop everything granted to it (REVOKE ALL ON ALL TABLES also drops
    -- the column-level grants on profiles)
    EXECUTE 'ALTER ROLE growth_ro NOBYPASSRLS';
    PERFORM pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = 'growth_ro';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM growth_ro';
    EXECUTE 'REVOKE USAGE ON SCHEMA public FROM growth_ro';
    EXECUTE 'DROP OWNED BY growth_ro';
    EXECUTE 'DROP ROLE growth_ro';
  END IF;
END $$;
