-- profiles: consent +18 e Terms/Privacy (SP3 onboarding, compliance). Additiva + idempotente.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS age_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS tos_accepted_at  timestamptz;

-- Rollback:
-- ALTER TABLE profiles DROP COLUMN IF EXISTS age_confirmed_at, DROP COLUMN IF EXISTS tos_accepted_at;
