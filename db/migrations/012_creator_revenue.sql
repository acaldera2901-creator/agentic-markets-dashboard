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
-- La % di revenue è PER-CREATOR e la decidiamo NOI dal backend insieme allo
-- switch: `creator_revenue_pct` (0-100, su ogni abbonamento dei suoi utenti).
-- Nessun default globale: switch ON senza pct = si continua a contare ma non
-- matura nulla (fail-closed sul denaro). Nessuna tabella accrual per ora: con
-- questi campi + gli ordini (paygate_orders/paypal_orders.granted_at) tutto è
-- derivabile via query. Quando i primi creator andranno ON con % ferma, si
-- valuta il freeze per-ordine (tabella accrual) così un cambio % futuro non
-- riscrive il passato.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS creator_revenue_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS creator_revenue_enabled_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS creator_revenue_pct NUMERIC(5,2)
  CHECK (creator_revenue_pct IS NULL OR (creator_revenue_pct >= 0 AND creator_revenue_pct <= 100));

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
-- Accrual per un creator ACCESO (solo pagamenti post-accensione, con la SUA %):
--   SELECT c.identifier AS creator,
--          c.creator_revenue_pct,
--          COALESCE(SUM(o.amount_usd), 0)                                  AS gross_usd,
--          ROUND(COALESCE(SUM(o.amount_usd), 0) * c.creator_revenue_pct / 100, 2) AS accrued_usd
--   FROM profiles c
--   JOIN profiles p ON p.referred_by = c.creator_code  -- (creator_code = il codice che distribuisce)
--   JOIN ( ...ordini granted come sopra... ) o ON o.identifier = p.identifier
--   WHERE c.creator_revenue_enabled
--     AND c.creator_revenue_pct IS NOT NULL
--     AND o.granted_at >= c.creator_revenue_enabled_at
--   GROUP BY 1, 2;
-- NB: manca ancora il mapping ufficiale codice→creator (oggi referred_by è
-- testo libero, rail 006). Quando si iscrive il primo creator reale va deciso:
-- codice = campo sul suo profilo (semplice) o tabella codici dedicata.
