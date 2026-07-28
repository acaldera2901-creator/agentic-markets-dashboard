-- #WEEKLY-RAILS-1: la Weekly Pick pagata in crypto non lasciava NESSUNA traccia in
-- Shopify (né ordine, né ricevuta, né riga in Finanze), a differenza dei piani che
-- vengono specchiati dal callback PayGate. Questa colonna è la memoria di
-- "quest'ordine l'ho già specchiato": senza, un secondo passaggio del callback
-- creerebbe un secondo ordine Shopify per lo stesso pagamento.
-- Additiva e nullable, stessa forma di paygate_orders.shopify_order_id: gli ordini
-- già esistenti la lasciano NULL e il callback si comporta come prima.
ALTER TABLE public.weekly_pick_orders
  ADD COLUMN IF NOT EXISTS shopify_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_weekly_pick_orders_shopify
  ON public.weekly_pick_orders (shopify_order_id);
