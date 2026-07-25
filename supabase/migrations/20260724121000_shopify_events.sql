-- Idempotenza webhook Shopify: registra ogni order id processato così una
-- redelivery di orders/paid non ri-estende il piano né duplica la ricevuta.
-- I rinnovi ricorrenti creano NUOVI order id → passano correttamente.
-- Rispecchia stripe_events. service_role only (scritto dal webhook via exec_sql).
CREATE TABLE IF NOT EXISTS shopify_events (
  event_id     TEXT PRIMARY KEY,   -- Shopify order id
  event_type   TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE shopify_events ENABLE ROW LEVEL SECURITY;

-- No policies + revoke: solo service_role (che bypassa RLS) può toccarla.
REVOKE ALL ON shopify_events FROM anon, authenticated;
