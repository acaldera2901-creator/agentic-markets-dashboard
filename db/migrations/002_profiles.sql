-- db/migrations/002_profiles.sql
-- Server-authoritative client profiles for server-side access gating (P0 #1).
-- Replaces the previous localStorage-only auth. The signed session cookie carries
-- only the profile identifier; the plan is always resolved from this table server-side,
-- so a tampered/stale cookie can never grant a higher plan than what is stored here.

CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- "identificatore": passwordless login key (email, lowercased+trimmed).
  identifier    TEXT NOT NULL UNIQUE,
  name          TEXT,
  plan          TEXT NOT NULL DEFAULT 'free'
                CHECK (plan IN ('free', 'pending_payment', 'base', 'premium', 'admin_full')),
  -- plan the user requested at checkout (kept while plan = pending_payment).
  requested_plan TEXT
                CHECK (requested_plan IN ('base', 'premium') OR requested_plan IS NULL),
  tx_hash       TEXT,
  language      TEXT,
  timezone      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_identifier ON profiles(identifier);
