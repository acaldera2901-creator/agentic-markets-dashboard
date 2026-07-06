-- 012_creator_revenue.sql — #CREATOR-REWARDS-V2 (modello deciso da Michele,
-- delega piena Andrea 06/07). Eseguire nel SQL Editor Supabase (come 006).
--
-- Modello: il creator di DEFAULT non guadagna nulla — il sistema CONTA solo
-- le conversioni pagate attribuite al suo codice (referred_by, rail 006).
-- Il guadagno sugli abbonamenti dei suoi utenti si accende SOLO dal backend
-- (BackOffice, lane Tommy) flippando `creator_revenue_enabled`, caso per caso.
-- `creator_revenue_enabled_at` fissa il momento: l'accrual NON è retroattivo —
-- conta solo i pagamenti granted DOPO l'accensione.
--
-- Nessuna tabella accrual per ora: con questi 2 campi + gli ordini
-- (paygate_orders/paypal_orders.granted_at) tutto è derivabile via query, e la
-- % rev-share non è ancora decisa (soci+Maven). Quando lo sarà, l'accrual si
-- calcola da qui senza perdere storia.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS creator_revenue_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS creator_revenue_enabled_at TIMESTAMPTZ;

-- ── Query di servizio (BackOffice / reporting) ────────────────────────────────
-- Contatore conversioni PAGATE per creator (la metrica di default per tutti):
--   SELECT p.referred_by AS creator_code,
--          COUNT(DISTINCT p.identifier) AS paying_users,
--          COUNT(o.id)                  AS paid_orders,
--          COALESCE(SUM(o.amount_usd), 0) AS gross_usd
--   FROM profiles p
--   JOIN (
--     SELECT identifier, id, amount_usd, granted_at FROM paygate_orders WHERE granted_at IS NOT NULL
--     UNION ALL
--     SELECT identifier, id, amount_usd, granted_at FROM paypal_orders  WHERE granted_at IS NOT NULL
--   ) o ON o.identifier = p.identifier
--   WHERE p.referred_by IS NOT NULL
--   GROUP BY 1 ORDER BY paying_users DESC;
--
-- Base accrual per un creator ACCESO (solo pagamenti post-accensione):
--   ... AND o.granted_at >= creator.creator_revenue_enabled_at
