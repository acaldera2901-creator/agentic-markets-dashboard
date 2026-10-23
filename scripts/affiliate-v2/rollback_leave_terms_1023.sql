-- Rollback of supabase/migrations/20261023120000_affiliate_v2_leave_terms.sql
-- (#AFFILIATE-COMPLETE-1023). Run AFTER rolling back the code that reads
-- affiliates.left_at (ledger, /api/affiliate/me, /leave, /terms, /join): with the
-- column gone those routes fail closed (500) instead of silently paying a leaver.
--
-- What is lost: who left the program and when, and the history of accepted
-- Terms versions (affiliates.terms_version keeps the latest). Refuses to run if
-- anyone has left, so a voluntary exit is never silently undone.
--   psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f scripts/affiliate-v2/rollback_leave_terms_1023.sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'affiliates' AND column_name = 'left_at')
     AND EXISTS (SELECT 1 FROM public.affiliates WHERE left_at IS NOT NULL) THEN
    RAISE EXCEPTION 'rollback_leave_terms_1023: some affiliates have left the program (left_at set) — export them first and handle by hand';
  END IF;
END $$;

DROP TABLE IF EXISTS public.affiliate_terms_acceptances;
ALTER TABLE public.affiliates DROP COLUMN IF EXISTS left_at;
