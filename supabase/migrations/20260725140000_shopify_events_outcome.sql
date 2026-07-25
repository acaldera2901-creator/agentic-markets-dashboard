-- Perché un pagamento Shopify senza grant si possa RECUPERARE, l'evento deve
-- ricordare chi e cosa, non solo che è passato: con solo (event_id, event_type)
-- un ordine "unresolved" era indistinguibile da uno concesso.
-- Additiva: le righe già presenti restano valide con status NULL → la reconcile
-- guarda solo status='unresolved', quindi non ri-tenta lo storico alla cieca.
ALTER TABLE shopify_events
  ADD COLUMN IF NOT EXISTS identifier TEXT,
  ADD COLUMN IF NOT EXISTS variant_id TEXT,
  ADD COLUMN IF NOT EXISTS status     TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- La reconcile scansiona solo gli irrisolti recenti.
CREATE INDEX IF NOT EXISTS shopify_events_status_idx
  ON shopify_events (status, processed_at DESC);
