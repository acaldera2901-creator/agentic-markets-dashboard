-- supabase/migrations/20260713120000_paypal_orders_refunded_status.sql
-- #GOLIVE-QW-B: allow status='refunded' on paypal_orders.
-- The webhook now handles PAYMENT.CAPTURE.REFUNDED / .REVERSED and marks the
-- order 'refunded' so a chargeback never passes unnoticed. The original CHECK
-- (('pending','paid','expired')) would reject that write at runtime. Additive
-- + idempotent: drop the old inline-named constraint and re-add it with the
-- extra allowed value.

ALTER TABLE public.paypal_orders DROP CONSTRAINT IF EXISTS paypal_orders_status_check;
ALTER TABLE public.paypal_orders
  ADD CONSTRAINT paypal_orders_status_check
  CHECK (status IN ('pending','paid','expired','refunded'));

-- Rollback (only if no row is 'refunded'):
-- ALTER TABLE public.paypal_orders DROP CONSTRAINT IF EXISTS paypal_orders_status_check;
-- ALTER TABLE public.paypal_orders
--   ADD CONSTRAINT paypal_orders_status_check
--   CHECK (status IN ('pending','paid','expired'));
