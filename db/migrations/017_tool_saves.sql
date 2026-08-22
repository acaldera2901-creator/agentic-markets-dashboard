-- 017_tool_saves.sql — #TOOLS-SAVE-0810
-- Eseguire nel SQL Editor Supabase (come 014/015). NON ANCORA APPLICATA.
-- (Il numero 016 è già occupato da 016_referral_room_view.sql, in lavorazione
--  su un altro ramo: questa prende il 017 per non collidere.)
--
-- PERCHÉ UNA TABELLA E NON localStorage.
-- Le 132 pagine /tools sono statiche e PUBBLICHE: accesso libero, nessuna email
-- (decisione di Andrea del 2026-08-05, non si ribalta — i tool sono acquisizione
-- organica). Il salvataggio del calcolo è quindi l'UNICA cosa che il login
-- aggiunge alla pagina. Se vivesse in localStorage, l'anonimo avrebbe già tutto
-- e registrarsi non servirebbe a niente: il valore del blocco è la
-- REGISTRAZIONE, e ciò che si compra registrandosi è la persistenza vera —
-- i propri numeri ritrovati domani, e da un altro dispositivo. Quella sta sul
-- server per definizione.
--
-- NON è un archivio. Cinque salvataggi per (utente, tool), FIFO: il sesto
-- espelle il più vecchio. Il cap è imposto dalla rotta (/api/tools/saves), non
-- da un trigger — così il limite è leggibile accanto alla validazione
-- dell'input, ed è il cap che tiene la tabella limitata per costruzione
-- (11 tool × 5 = 55 righe al massimo per utente: nessun rate limit serve).

CREATE TABLE IF NOT EXISTS public.tool_saves (
  id         BIGSERIAL   PRIMARY KEY,
  identifier TEXT        NOT NULL,
  -- Lo slug NON ha un CHECK sull'elenco dei tool: la fonte di verità è
  -- TOOL_SLUGS in lib/tools/registry.ts, e la rotta rifiuta tutto il resto.
  -- Duplicarlo qui vorrebbe dire una migration a ogni tool nuovo. Resta il
  -- guardrail sulla lunghezza, che è un limite di forma e non di elenco.
  slug       TEXT        NOT NULL CHECK (char_length(slug) BETWEEN 3 AND 40),
  -- Stato del calcolatore: { inputs: string[], groups: number[] } — i valori
  -- dei campi come li ha scritti l'utente e quale bottone di ogni segmentato
  -- era premuto. Nessun risultato: si ricalcola. Nessun PII.
  state      JSONB       NOT NULL,
  -- Riga leggibile del chip ("40.00% · Implied probability"): la sintesi che si
  -- vede prima di ricaricare il calcolo. La rotta la taglia a 80 caratteri,
  -- il CHECK è la difesa in profondità.
  summary    TEXT        NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- L'unica lettura che esiste: gli ultimi salvataggi di UN utente per UN tool.
CREATE INDEX IF NOT EXISTS idx_tool_saves_identifier_slug
  ON public.tool_saves (identifier, slug, created_at DESC);

-- Operator/service-role only: nessuna policy → nega anon/authenticated
-- (stessa postura di referral_rewards e weekly_pick_*). Le pagine /tools sono
-- pubbliche e statiche, ma questa tabella si legge SOLO passando dalla rotta
-- autenticata, che filtra per identifier di sessione.
ALTER TABLE public.tool_saves ENABLE ROW LEVEL SECURITY;

-- Rollback:
-- DROP TABLE IF EXISTS public.tool_saves;
