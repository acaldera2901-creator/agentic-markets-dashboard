-- db/migrations/005_unified_enrichment.sql
-- Additive: structured Deep-Analysis payload for predictions (WC paper rows
-- first; football rows can adopt the same column later). JSONB, nullable, no
-- default — existing rows read NULL until backfilled. Idempotent.
-- Access is gated at projection time (lib/access-projection.ts PREMIUM_FIELDS),
-- never exposed to anon/free; the column itself stays service_role-only like
-- the rest of unified_predictions (anon grants already revoked).
ALTER TABLE unified_predictions ADD COLUMN IF NOT EXISTS enrichment JSONB;
