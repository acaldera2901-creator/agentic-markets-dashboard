-- Structured Deep-Analysis payload for predictions (2026-06-06). World Cup
-- paper rows carry a JSONB enrichment block (form, venue/travel, squad,
-- lambdas, market) that the dashboard renders as the premium Deep Analysis
-- panel. Additive + idempotent. Mirrors db/migrations/005_unified_enrichment.sql.
-- Access stays service_role-only (anon grants already revoked) and is gated at
-- projection time (lib/access-projection.ts PREMIUM_FIELDS) before reaching a client.
ALTER TABLE public.unified_predictions ADD COLUMN IF NOT EXISTS enrichment JSONB;
