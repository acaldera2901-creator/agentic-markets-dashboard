-- #GOLIVE-QW-C · GATED: applicare solo con APPROVE (audit go-live 2026-07-13)
--
-- Difesa in profondità (stessa logica di 20260610180000_rls_remaining_tables):
-- abilita ROW LEVEL SECURITY + REVOKE anon/authenticated su OGNI tabella dello
-- schema public che ancora non ha RLS. L'app le legge/scrive SOLO via exec_sql
-- (SECURITY DEFINER, owner postgres) che bypassa RLS → nessun impatto funzionale;
-- così un grant futuro accidentale non le espone via PostgREST.
--
-- Idempotente: le tabelle già con RLS non vengono toccate (WHERE NOT rowsecurity);
-- il REVOKE è per sua natura ri-eseguibile. Dinamico invece che array hardcoded
-- perché deve coprire "tutte quelle che non l'hanno" senza doverle enumerare a mano.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'              -- ordinary tables only
       AND c.relrowsecurity = FALSE     -- solo quelle senza RLS
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', r.tbl);
  END LOOP;
END $$;
