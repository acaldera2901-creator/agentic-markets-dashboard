-- Stripe subscription linkage on profiles (fiat payments, GAP5).
-- Additive + idempotent: no data loss, safe to re-run.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription
  ON profiles (stripe_subscription_id);
