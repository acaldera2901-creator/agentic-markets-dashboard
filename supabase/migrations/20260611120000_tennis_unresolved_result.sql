-- #TENNIS-VOID-FIX-1 (Fase 1): consenti result='unresolved' su unified_predictions.
--
-- Un pick tennis che invecchia oltre la finestra di settlement senza che la
-- fonte (ESPN/Matchbook) abbia restituito un risultato NON è un void confermato.
-- Veniva bridgeato come 'void', falsando il track record pubblico (gap di fonte
-- mascherato da no-result). Il settlement agent ora lo segna 'unresolved' e
-- /api/v2/history lo esclude del tutto (lista + win_rate + conteggio void).
--
-- Cambiamento ADDITIVO: aggiunge 'unresolved' ai valori ammessi, non ne rimuove.
-- Reversibile: drop + re-add del constraint senza 'unresolved'.

ALTER TABLE unified_predictions
  DROP CONSTRAINT IF EXISTS unified_predictions_result_check;

ALTER TABLE unified_predictions
  ADD CONSTRAINT unified_predictions_result_check
  CHECK (
    result = ANY (ARRAY['won'::text, 'lost'::text, 'void'::text, 'pending'::text, 'unresolved'::text])
    OR result IS NULL
  );
