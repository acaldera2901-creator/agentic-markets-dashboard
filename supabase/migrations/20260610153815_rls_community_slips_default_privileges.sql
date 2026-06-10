-- #AUDIT-2026-06-10 punto 1 (APPROVE Andrea): community_slips era nata (a mano,
-- 2026-06-07) senza RLS dopo il blanket revoke del 2026-06-05 — i default
-- privileges Supabase le hanno ri-concesso DML completo ad anon/authenticated.
-- L'app vi accede SOLO via exec_sql (SECURITY DEFINER, owner postgres), che
-- bypassa RLS: nessuna policy necessaria.
--
-- GIÀ APPLICATA in prod il 2026-06-10 via MCP (version 20260610153815, stesso
-- timestamp di questo file: supabase db push la vede come applicata). Tenuta
-- nel repo perché lo stato del DB e i file restino allineati.
ALTER TABLE public.community_slips ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_slips FROM anon, authenticated;

-- Root cause: le tabelle future nascono chiuse invece di ereditare i grant
-- default anon/authenticated (esposizione PostgREST) a ogni CREATE TABLE.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
