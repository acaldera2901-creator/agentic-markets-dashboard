-- #WC-STAGE-CONSTRAINT-1 · GATED: applicare solo con APPROVE (Andrea 2026-07-18)
--
-- Schema drift: il modello WC produce gli stage `third_place` (finalina 3°/4°
-- posto, vedi core/world_cup_context.py:132) e `round32`, ma la CHECK constraint
-- ammetteva solo {group, round16, quarter, semi, final}. Risultato: ogni upsert
-- di una riga third_place/round32 veniva respinto con 23514 → il match non
-- atterrava mai su unified_predictions e non veniva mai surfacato sul board
-- (visto 2026-07-18: France vs England, finalina 3° posto, rifiutata a ogni ciclo).
--
-- Fix: allarga la lista ammessa ai valori che il codice già genera. Idempotente
-- (DROP IF EXISTS + ADD). Nessun dato modificato, nessun codice applicativo.

ALTER TABLE public.unified_predictions
  DROP CONSTRAINT IF EXISTS unified_predictions_world_cup_stage_check;

ALTER TABLE public.unified_predictions
  ADD CONSTRAINT unified_predictions_world_cup_stage_check
  CHECK (
    (world_cup_stage = ANY (ARRAY[
      'group'::text, 'round32'::text, 'round16'::text, 'quarter'::text,
      'semi'::text, 'third_place'::text, 'final'::text
    ]))
    OR (world_cup_stage IS NULL)
  );

-- Rollback (ripristina la lista precedente a 5 valori — riapre il drift):
-- ALTER TABLE public.unified_predictions DROP CONSTRAINT IF EXISTS unified_predictions_world_cup_stage_check;
-- ALTER TABLE public.unified_predictions ADD CONSTRAINT unified_predictions_world_cup_stage_check
--   CHECK ((world_cup_stage = ANY (ARRAY['group','round16','quarter','semi','final'])) OR (world_cup_stage IS NULL));
