-- referral_rewards — file RICOSTRUITO il 2026-09-21 (#MIGRATION-RICONCILIAZIONE-0921)
--
-- Questa migration era stata applicata A MANO in produzione il 2026-08-08
-- (version 20260808155653) senza lasciare un file nel repo. Il file non crea
-- niente di nuovo: descrive ciò che in produzione ESISTE GIÀ, perché la regola
-- del progetto è che ogni migration viva nel repo (docs/RUNBOOK-DB.md:37,
-- lezione del drift di `weekly_pick_orders`).
--
-- ⚠️ Il nome del file riprende la version ESATTA con cui la migration risulta
-- registrata in `supabase_migrations.schema_migrations`. Serve così: se un
-- domani la CI torna a funzionare, `supabase db push` la vede già applicata e
-- non la riesegue. Con un timestamp nuovo il registro resterebbe disallineato.
--
-- Struttura letta dalla produzione il 2026-09-21 (information_schema.columns,
-- pg_indexes, pg_constraint, pg_class, pg_policy), non ricostruita a memoria.

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id            bigserial    PRIMARY KEY,
  identifier    text         NOT NULL,
  tier          smallint     NOT NULL,
  granted_at    timestamptz  NOT NULL DEFAULT now(),
  paying_count  integer      NOT NULL
);

-- Le soglie premio sono una lista chiusa. ⚠️ Se un giorno va aggiunto un tier,
-- il vincolo va confrontato NEI DUE VERSI (cercare solo il valore da aggiungere
-- può restringerlo invece di allargarlo — #CHECK-DUE-VERSI).
ALTER TABLE public.referral_rewards DROP CONSTRAINT IF EXISTS chk_referral_tier;
ALTER TABLE public.referral_rewards
  ADD CONSTRAINT chk_referral_tier CHECK (tier = ANY (ARRAY[0, 2, 5, 10]));

-- Un premio solo per (chi, quale soglia): è ciò che rende il grant idempotente.
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_rewards_identifier_tier
  ON public.referral_rewards USING btree (identifier, tier);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_identifier
  ON public.referral_rewards USING btree (identifier);

-- RLS attiva e NESSUNA policy: è deliberato, non un lavoro lasciato a metà.
-- In produzione `anon` e `authenticated` non hanno nemmeno il GRANT sulla
-- tabella (solo `postgres` e `service_role`), quindi la chiusura è doppia —
-- a livello di privilegio prima ancora che di policy. La tabella si legge solo
-- dal server. Una policy aggiunta qui APRIREBBE un accesso che oggi non esiste.
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
