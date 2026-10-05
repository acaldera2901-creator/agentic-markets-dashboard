-- 20261006130000_stripe_events_amount.sql — #GROWTH-TRACKING-1006.4
--
-- NON ANCORA APPLICATA: attende APPROVE (modifica DB → gate).
--
-- Perché: stripe_events registrava solo (event_id, event_type, processed_at).
-- L'importo di un invoice.paid esisteva nel webhook (inv.amount_paid,
-- inv.currency) ma non veniva salvato, quindi l'incassato Stripe non era
-- ricostruibile dal DB. Il webhook ora lo scrive best-effort su queste colonne,
-- e lib/revenue.ts lo legge.
--
-- Additiva: le righe esistenti restano con NULL (lib/revenue le conta come
-- amount_unknown, non come 0). Nessun dato toccato, nessun default cambiato.
-- amount è in unità maggiori (amount_paid / 100), currency minuscola (es. 'usd').
--
-- ORDINE DI DEPLOY: il codice tollera la migration assente (il webhook fa
-- l'UPDATE in try/catch; /api/admin/revenue riporta la fonte stripe in
-- source_errors invece di fallire), quindi si può applicare prima o dopo il deploy.

ALTER TABLE stripe_events
  ADD COLUMN IF NOT EXISTS amount     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS currency   TEXT,
  ADD COLUMN IF NOT EXISTS identifier TEXT,
  ADD COLUMN IF NOT EXISTS plan       TEXT,
  ADD COLUMN IF NOT EXISTS period     TEXT;

-- Rollback (perde solo gli importi salvati dopo l'apply):
-- ALTER TABLE stripe_events
--   DROP COLUMN IF EXISTS period,
--   DROP COLUMN IF EXISTS plan,
--   DROP COLUMN IF EXISTS identifier,
--   DROP COLUMN IF EXISTS currency,
--   DROP COLUMN IF EXISTS amount;
