-- #SETTLE-0909 fase 2 — il settlement diventa correggibile per davvero.
-- APPROVE Andrea 10/09/2026 ("chiudiamo quello che resta fuori").
--
-- ⛔ STATO: NON ANCORA APPLICATA. Chi la applica aggiorna questo header con la
-- data e cosa ha verificato.
--
-- ⚠️ ORDINE OBBLIGATORIO, e non è una formalità:
--   1. PRIMA il deploy del codice che sposta i due scrittori sul conflict
--      target a 4 colonne (core/supabase_client.py::record_pick_settlement e
--      lib/pick-ledger-mirror.ts::LEDGER_MIRROR_CONFLICT). Puo' partire subito:
--      l'indice a 4 colonne esiste dal 09/09 (fase 1), quindi i writer nuovi
--      funzionano PRIMA che il vecchio indice sparisca.
--   2. POI questa migration.
-- Invertendo l'ordine, i writer nominano un indice che non c'e' piu' e
-- rispondono 42P10 — e sono fail-soft, quindi il libro mastro smetterebbe di
-- essere scritto IN SILENZIO. E' la ragione per cui la fase 1 ha affiancato
-- l'indice invece di sostituirlo.

-- ─── 1. Via il vincolo che impediva la correzione ───────────────────────────
-- `pick_settlement_pick_key` era UNIQUE su (source_table, source_id,
-- model_version): impediva alla revisione 2 di nascere. Il suo posto lo prende
-- `pick_settlement_pick_rev_key`, creato nella fase 1, che include
-- `settlement_revision` — quindi l'unicita' per pick E revisione resta
-- garantita: non si allenta niente, si sposta l'immutabilita' dal campo alla
-- riga.
DROP INDEX IF EXISTS public.pick_settlement_pick_key;

-- ─── 2. UN SOLO POSTO da cui si legge il mastro ─────────────────────────────
-- Il pericolo vero della revisione non e' scriverla: e' che i LETTORI contino
-- due righe per pick. Misurati il 10/09, sono quattro:
--   · tools/control_center/checks/results.py (_TRACK_SQL) — conterebbe doppio
--   · tools/control_center/checks/pipeline.py (void_rate)  — conterebbe doppio
--   · scripts/track_record_proof.py — «vince la prima», quindi terrebbe la
--     revisione SBAGLIATA
--   · tools/control_center/checks/daemons.py — salvo: cerca l'ASSENZA di righe
-- Correggerli uno per uno significa che il quinto lettore, scritto fra un mese,
-- ricomincia da zero. Quindi si legge da qui, e questa vista e' la definizione
-- di «il settlement corrente».
CREATE OR REPLACE VIEW public.pick_settlement_current AS
SELECT DISTINCT ON (source_table, source_id, model_version) *
FROM public.pick_settlement
ORDER BY source_table, source_id, model_version, settlement_revision DESC, id DESC;

COMMENT ON VIEW public.pick_settlement_current IS
  'Il settlement CORRENTE per pick: massima settlement_revision. Chi legge il '
  'track record legge da qui, non da pick_settlement — la tabella e '
  'append-only e contiene anche le revisioni superate. #SETTLE-0909';

-- ─── ROLLBACK (manuale) ─────────────────────────────────────────────────────
-- Ricreare il vecchio indice e' possibile SOLO se non esistono revisioni > 1,
-- altrimenti la UNIQUE a 3 colonne viene rifiutata dai dati. Quindi il rollback
-- vero e': prima cancellare le revisioni superate, poi ricreare l'indice.
--
-- DROP VIEW IF EXISTS public.pick_settlement_current;
-- DELETE FROM public.pick_settlement WHERE settlement_revision > 1;
-- CREATE UNIQUE INDEX pick_settlement_pick_key
--   ON public.pick_settlement (source_table, source_id, model_version);
--
-- ⚠️ Quel DELETE cancella la prova di una correzione. Se si arriva a doverlo
-- fare, va detto a chi legge il track record, non fatto in silenzio.
