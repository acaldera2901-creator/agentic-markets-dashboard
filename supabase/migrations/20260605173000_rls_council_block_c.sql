-- PROPOSAL #010 Block C — RLS on council_* (2026-06-05, human-approved by Andrea)
-- Verified: the council-chat app (lib/store.ts:44) accesses these via SERVICE_ROLE
-- only (no anon key anywhere in the repo), so RLS + revoke does not break it.
-- Closes the last 4 NO-RLS tables + the council_invites "Sensitive Columns
-- Exposed" (token) advisor.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'council_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', r.tablename);
  END LOOP;
END $$;
