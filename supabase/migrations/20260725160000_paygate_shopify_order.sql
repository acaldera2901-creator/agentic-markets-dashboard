-- #SHOPIFY-CRYPTO-2: il rail crypto passa dal checkout Shopify (metodo manuale
-- "Crypto"), ma il pagamento lo esegue PayGate. L'ordine PayGate deve ricordare
-- QUALE ordine Shopify sta pagando, altrimenti al callback non sappiamo quale
-- ordine marcare come pagato e i libri di Shopify restano con un pendente eterno.
-- Additiva e nullable: gli ordini PayGate del rail diretto (nostro sito) la
-- lasciano NULL e il callback si comporta esattamente come prima.
ALTER TABLE public.paygate_orders
  ADD COLUMN IF NOT EXISTS shopify_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_paygate_orders_shopify
  ON public.paygate_orders (shopify_order_id);
