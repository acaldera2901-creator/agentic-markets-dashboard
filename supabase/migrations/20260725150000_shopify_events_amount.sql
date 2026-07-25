-- Blocker go-live: senza l'importo dell'ordine, il webhook refunds/create non
-- può distinguere un rimborso TOTALE da uno PARZIALE, e revocava l'accesso in
-- entrambi i casi — azzerando un annuale pagato per un rimborso di una mensilità.
-- Additiva: le righe già presenti restano con amount NULL → isFullRefund tratta
-- l'importo ignoto come totale (comportamento attuale, nessuna regressione).
ALTER TABLE shopify_events
  ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2);
