-- Subscription lifecycle (2026-06-05, payments GAP2): a plan today never
-- expires — we were effectively selling a lifetime at 49.50 USDT. Add an
-- expiry; access is enforced at runtime (lib/auth) AND swept by a daily cron.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

-- Index for the cron sweep (find expired paid plans cheaply).
CREATE INDEX IF NOT EXISTS idx_profiles_plan_expires_at
  ON public.profiles (plan_expires_at)
  WHERE plan_expires_at IS NOT NULL;

-- Rollback: DROP INDEX IF EXISTS idx_profiles_plan_expires_at;
--           ALTER TABLE public.profiles DROP COLUMN IF EXISTS plan_expires_at;
