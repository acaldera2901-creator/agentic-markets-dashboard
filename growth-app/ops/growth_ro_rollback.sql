-- Rollback of PROPOSAL #GROWTH-LIVE: removes the growth_ro role. Touches no data.
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
    -- and drop everything granted to it
    EXECUTE 'ALTER ROLE growth_ro NOBYPASSRLS';
    PERFORM pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = 'growth_ro';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM growth_ro';
    EXECUTE 'REVOKE USAGE ON SCHEMA public FROM growth_ro';
    EXECUTE 'DROP OWNED BY growth_ro';
    EXECUTE 'DROP ROLE growth_ro';
  END IF;
END $$;
