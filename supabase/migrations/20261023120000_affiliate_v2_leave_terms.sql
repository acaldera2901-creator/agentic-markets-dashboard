-- #AFFILIATE-COMPLETE-1023 — leaving the program (self-service) and accepting
-- updated Terms, with the history of every accepted version.
--
-- 1. affiliates.left_at: the affiliate left the program (SPEC-ui §3.2 «Lascia il
--    programma», Terms §8). From that moment new payments of referred users earn
--    nothing (lib/affiliate/ledger.ts); the status stays 'active', so what was
--    legitimately earned keeps maturing and is paid out as usual («Legitimately
--    earned amounts are not forfeited simply because you leave»). 'terminated'
--    stays the operator's sanction, not the voluntary exit.
-- 2. affiliate_terms_acceptances: one row per (affiliate, Terms version) accepted
--    — at enrollment, when re-joining, or from the «Terms updated» banner. Needed
--    by Terms v3 («section 7A applies 30 days after we notify them, or earlier if
--    they accept it»): affiliates.terms_version only keeps the latest one.
--    Backfilled with the version each existing affiliate enrolled with.
--
-- ADDITIVE and idempotent: one nullable column, one table, no function touched.
-- Applies after 20261022160000. Rollback: scripts/affiliate-v2/rollback_leave_terms_1023.sql.

ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS left_at timestamptz;

CREATE TABLE IF NOT EXISTS public.affiliate_terms_acceptances (
  affiliate_id   bigint       NOT NULL REFERENCES public.affiliates(id),
  terms_version  text         NOT NULL CHECK (length(trim(terms_version)) BETWEEN 1 AND 64),
  accepted_at    timestamptz  NOT NULL DEFAULT now(),
  -- the separate approval of the onerous clauses (artt. 1341-1342 c.c.) for this version
  onerous_ack    boolean      NOT NULL,
  source         text         NOT NULL CHECK (source IN ('join','rejoin','update','backfill')),
  PRIMARY KEY (affiliate_id, terms_version)
);

ALTER TABLE public.affiliate_terms_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affiliate_terms_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.affiliate_terms_acceptances TO service_role;

INSERT INTO public.affiliate_terms_acceptances (affiliate_id, terms_version, accepted_at, onerous_ack, source)
SELECT id, terms_version, terms_accepted_at, onerous_ack_version = terms_version, 'backfill'
  FROM public.affiliates
ON CONFLICT (affiliate_id, terms_version) DO NOTHING;
