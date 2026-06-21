-- Hardening RLS sulle 3 tabelle player nuove (coerente con rls_remaining_tables).
-- Nessuna policy = deny-all per anon/authenticated; il service-role bypassa RLS,
-- quindi l'app (dbQuery service-role) e i collector continuano a funzionare.
-- Applicata in prod (Agentic project) il 2026-06-21 via Supabase MCP.
ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_odds ENABLE ROW LEVEL SECURITY;

-- Rollback:
-- ALTER TABLE public.player_match_stats DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.player_lineups DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.player_odds DISABLE ROW LEVEL SECURITY;
