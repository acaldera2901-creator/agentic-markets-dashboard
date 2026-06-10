-- #AUDIT MEDIUM-22: 5 tabelle prod avevano RLS disabilitata, protette SOLO
-- dall'assenza di grant ad anon/authenticated. Difesa in profondità: abilitiamo
-- RLS + REVOKE espliciti, così un eventuale grant futuro non le espone via
-- PostgREST. L'app le legge via exec_sql (SECURITY DEFINER, owner postgres) che
-- bypassa RLS — nessun impatto funzionale.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'prediction_log',
    'squad_condition_reports',
    'wc_squad_players',
    'wc_squad_snapshots',
    'wc_squads'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
