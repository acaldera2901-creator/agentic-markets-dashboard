-- #SETTLE-0909 — D1 + F1 (fase 1) + F2. Tutta ADDITIVA, tutta idempotente.
-- APPROVE Andrea 09/09/2026 (PROPOSAL-SETTLE-0909, parte 2).
--
-- ⛔ STATO: NON ANCORA APPLICATA A PROD. Chi la applica aggiorna questo header
-- con la data e cosa ha verificato — l'header stale del 014 ha già generato un
-- falso allarme in un audit; non ripetiamolo.
--
-- IL FATTO CHE LA MOTIVA. Il 09/09, sulle 1.402 righe tennis pubblicate e
-- mostrate come pick, il nuovo cancello di coerenza (core/tennis_set_validation)
-- ne rifiuta 468, di cui 289 con difetto DIMOSTRATO: punteggi come `6-1`,
-- `4-2`, `7-5` — set singoli incompleti, cioè esiti scritti mentre la partita
-- era in corso. Ri-verificato in dry-run read-only lo stesso giorno: 265
-- `set-vincitore-1`, 23 `set-vincitore-0`, 1 contraddittorio = 289 esatte.
-- Il football, che ha il gate `status === "FINISHED"` da sempre, non si muove:
-- 0 righe anomale su 266 (placebo test superato).
--
-- ORDINE DI APPLICAZIONE. Questa migration NON dipende dal deploy del codice e
-- il codice non dipende da lei: entrambe le direzioni restano funzionanti
-- mentre l'altra manca. È deliberato — vedi la nota su F1 più sotto.

-- ─── D1. Stato di verifica per riga ─────────────────────────────────────────
-- Serve a rendere vera la decisione di Andrea del 09/09: «/history NON si
-- nasconde, si rende corretta». Non serve nascondere la pagina — serve
-- nascondere le RIGHE non verificate. Il default 'unverified' non cambia il
-- comportamento di nulla finché /api/v2/history non filtra su 'verified'.
ALTER TABLE public.unified_predictions
  ADD COLUMN IF NOT EXISTS verification_state TEXT NOT NULL DEFAULT 'unverified';

ALTER TABLE public.unified_predictions
  ADD COLUMN IF NOT EXISTS verification_source TEXT;

ALTER TABLE public.unified_predictions
  ADD COLUMN IF NOT EXISTS verification_at TIMESTAMPTZ;

ALTER TABLE public.unified_predictions
  ADD COLUMN IF NOT EXISTS verification_note TEXT;

-- I quattro stati, vincolati dal DB e non dalla buona fede dello scrittore:
--   verified     — l'esito è confermato da una fonte con flag di completamento
--   defect       — l'esito salvato è dimostrabilmente falso
--   unverifiable — la fonte è muta o ambigua: non sappiamo, e lo diciamo
--   unverified   — non ancora guardata (default)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unified_predictions_verification_state_chk'
  ) THEN
    ALTER TABLE public.unified_predictions
      ADD CONSTRAINT unified_predictions_verification_state_chk
      CHECK (verification_state IN ('verified','defect','unverifiable','unverified'));
  END IF;
END $$;

-- /api/v2/history filtra su questa colonna a ogni richiesta, insieme a
-- is_historical: l'indice parziale tiene la query sulle sole righe chiuse.
CREATE INDEX IF NOT EXISTS unified_predictions_verification_idx
  ON public.unified_predictions (verification_state)
  WHERE is_historical = TRUE;

-- ─── F1 (fase 1). Il settlement diventa VERSIONABILE ────────────────────────
-- L'append-only di pick_settlement È UNA FEATURE: impedisce la riscrittura
-- silenziosa del track record (#SETTLEMENT-DEDUP-0801, e UPDATE/DELETE sono
-- REVOKEd). Il problema è che impedisce anche la correzione TRACCIATA: il
-- commento in core/supabase_client.py:786-790 dice testualmente che correggere
-- «is not possible, the unique index rejects it».
-- Non si rimuove l'immutabilità: si sposta dal campo alla RIGA. Una correzione
-- è una riga NUOVA con revision+1, e chi legge prende max(revision) per chiave.
-- Così resta la prova di COSA avevamo pubblicato e QUANDO l'abbiamo corretto —
-- che è esattamente ciò che serve davanti a un revisore.
ALTER TABLE public.pick_settlement
  ADD COLUMN IF NOT EXISTS settlement_revision INT NOT NULL DEFAULT 1;

ALTER TABLE public.pick_settlement
  ADD COLUMN IF NOT EXISTS correction_reason TEXT;

-- ⚠️ PERCHÉ IL VECCHIO INDICE RESTA, PER ORA.
-- `pick_settlement_pick_key` è UNIQUE su (source_table, source_id,
-- model_version) e i due scrittori lo nominano come conflict target:
-- `?on_conflict=source_table,source_id,model_version` in
-- core/supabase_client.py e LEDGER_MIRROR_CONFLICT in
-- app/api/cron/settle/route.ts. Se lo si sostituisce QUI, ogni scrittura di
-- settlement inizia a rispondere «no unique constraint matching the ON CONFLICT
-- specification» finché il deploy del codice non atterra: una finestra in cui
-- il libro mastro smette di essere scritto, in silenzio (i writer sono
-- fail-soft). Non vale il rischio per anticipare un passo.
-- Quindi: qui si AFFIANCA l'indice a 4 colonne, e i writer continuano a usare
-- quello a 3. Finché il vecchio indice esiste una revision 2 viene rifiutata —
-- ed è corretto, perché nulla scrive revision 2 fino alla ri-aggiudicazione
-- (passo E2), che è un lavoro separato e successivo.
-- La fase 2 (drop del vecchio indice + conflict target a 4 colonne nei due
-- writer) va nella migration che accompagna E2, non qui.
CREATE UNIQUE INDEX IF NOT EXISTS pick_settlement_pick_rev_key
  ON public.pick_settlement (source_table, source_id, model_version, settlement_revision);

-- ─── F2. L'audit del settlement ─────────────────────────────────────────────
-- La parte che rende inutile la PROSSIMA archeologia. Il 09/09 per capire
-- perché 289 righe erano sbagliate è servita una notte di ri-interrogazione
-- delle fonti, perché di ogni grading non conservavamo NIENTE: né chi aveva
-- risposto, né cosa aveva risposto, né se la fonte dichiarasse la partita
-- conclusa. Una riga per TENTATIVO, non per esito: anche un tentativo rifiutato
-- dal cancello è un fatto che vogliamo poter rileggere.
CREATE TABLE IF NOT EXISTS public.settlement_audit (
  id                    BIGSERIAL PRIMARY KEY,

  prediction_id         TEXT NOT NULL,   -- unified_predictions.id o match_id
  sport                 TEXT NOT NULL,

  source                TEXT NOT NULL,   -- 'espn-archive' | 'matchbook' | 'football-data' | ...
  source_event_id       TEXT,
  -- Il flag DELLA FONTE, non la nostra deduzione. È la colonna che il 09/09
  -- avrebbe risposto in un secondo alla domanda «era finita?».
  source_completed_flag BOOLEAN,
  source_status         TEXT,            -- 'STATUS_FINAL' | 'STATUS_RETIRED' | 'FINISHED' | ...
  raw_score             TEXT,

  gate_passed           BOOLEAN NOT NULL,
  gate_reason           TEXT,            -- il motivo del cancello: 'bo5-concluso', 'due-set-in-bo5', ...

  fetched_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS settlement_audit_prediction_idx
  ON public.settlement_audit (prediction_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS settlement_audit_rejected_idx
  ON public.settlement_audit (fetched_at DESC)
  WHERE gate_passed = FALSE;

-- Stesso regime delle altre tabelle di prova: RLS attiva, nessuna policy =
-- solo il service role. Un audit leggibile dal client non è un audit.
ALTER TABLE public.settlement_audit ENABLE ROW LEVEL SECURITY;
