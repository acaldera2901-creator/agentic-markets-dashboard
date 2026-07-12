-- profiles: pin WHICH version of ToS/Privacy was accepted (GDPR A1-B2, complement
-- to 20260712000000_profiles_consent.sql which stores WHEN). Additiva + idempotente.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS consent_version text;

-- Rollback:
-- ALTER TABLE profiles DROP COLUMN IF EXISTS consent_version;
