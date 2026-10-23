-- Rollback of supabase/migrations/20261023120000_affiliate_v2_leave_terms.sql
-- (#AFFILIATE-COMPLETE-1023). Run AFTER rolling back the code that reads
-- affiliates.left_at (ledger, /api/affiliate/me, /leave, /terms, /join): with the
-- column gone those routes fail closed (500) instead of silently paying a leaver.
--
-- What is lost: the history of accepted
-- Terms versions (affiliates.terms_version keeps the latest). Refuses to run if
-- anyone has ever left (affiliate_absences), so an exit is never silently undone.
--   psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f scripts/affiliate-v2/rollback_leave_terms_1023.sql
-- Repeatable (review Codex 23/10 #5): the data checks only run while the objects exist.
DO $$
BEGIN
  IF to_regclass('public.affiliate_absences') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.affiliate_absences) THEN
      RAISE EXCEPTION 'rollback_leave_terms_1023: some affiliates have left the program (affiliate_absences has rows) — export them first and handle by hand';
    END IF;
  END IF;
END $$;

DROP TABLE IF EXISTS public.affiliate_absences;
DROP TABLE IF EXISTS public.affiliate_terms_acceptances;
ALTER TABLE public.affiliates DROP COLUMN IF EXISTS left_at;
