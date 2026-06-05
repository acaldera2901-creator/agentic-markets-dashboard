-- PROPOSAL #010 A+B — Supabase security hardening (2026-06-05, human-approved by Andrea)
-- Audit: exec_sql was SECURITY DEFINER + EXECUTE to anon/PUBLIC (RCE via public anon key);
-- profiles + council_* had no RLS; every table had direct DML grants to anon/authenticated.
-- All server access uses service_role (BYPASSRLS=true), so these changes do not break the app.
-- council_* intentionally untouched here (Block C — pending council-chat access verification).

-- ── Block A: exec_sql lockdown (closes the RCE) ──────────────────────────────
DO $$
DECLARE fn regprocedure;
BEGIN
  SELECT oid::regprocedure INTO fn
  FROM pg_proc WHERE proname = 'exec_sql' AND pronamespace = 'public'::regnamespace
  LIMIT 1;

  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn);
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  -- Fix "Function Search Path Mutable": fixed search_path. Code queries are
  -- non-schema-qualified (FROM profiles, ...) so it must include public; safe
  -- because after this block only service_role can invoke the function.
  EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn);
END $$;

-- ── Block B1: RLS on profiles (closes anon self-promotion to admin_full) ─────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- No policy on purpose: anon/authenticated get deny-all; service_role bypasses RLS.

-- ── Block B2: revoke direct DML from anon/authenticated on all product tables ─
-- Defense in depth: nothing should reach these tables with the public anon key;
-- all access is server-side via service_role. council_* excluded (Block C).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE 'council_%'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', r.tablename);
  END LOOP;
END $$;

-- ── Rollback (manual, if ever needed) ───────────────────────────────────────
-- GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO anon, authenticated, PUBLIC;
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- (re-granting per-table DML to anon/authenticated is intentionally NOT scripted)
