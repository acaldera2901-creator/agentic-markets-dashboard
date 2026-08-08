-- 015_referral_rewards.sql — #REFERRAL-V2-0808
-- Eseguire nel SQL Editor Supabase (come 006/012/013).
--
-- La scala premi del referral. Un invito è VALIDO solo se l'invitato ha pagato
-- almeno una volta (scelta di Andrea 2026-08-08): il conteggio guarda gli ordini
-- con granted_at, non profiles.plan, così un amico che paga e poi disdice resta
-- contato e il premio non regredisce dopo essere stato concesso.
--
-- Soglie: 2 → 29gg PRO · 5 → altri 60gg · 10 → stanza Telegram riservata.
-- (29 e non 30 per l'invariante anti-arbitraggio: 2 × BASE = $29.98 di costo
--  minimo contro $29.99 che valevano 30 giorni di PRO. Deciso da Andrea.)
-- tier 0 = bonus dell'INVITATO (7 giorni), tenuto nella stessa tabella perché
-- ha la stessa esigenza: concedere una volta sola.
--
-- I premi sono ACCESSO, mai denaro (vincolo VIA A).

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id            BIGSERIAL PRIMARY KEY,
  identifier    TEXT        NOT NULL,
  tier          SMALLINT    NOT NULL,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paying_count  INT         NOT NULL,
  CONSTRAINT chk_referral_tier CHECK (tier IN (0, 2, 5, 10))
);

-- Il lock vero contro il doppio grant: due richieste concorrenti sullo stesso
-- gradino non possono vincere entrambe.
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_rewards_identifier_tier
  ON public.referral_rewards (identifier, tier);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_identifier
  ON public.referral_rewards (identifier);

-- Gradino 10: accesso alla stanza riservata. Revocabile — lo legge il bot.
-- "Attivo" = piano a pagamento non scaduto, inclusi i giorni regalati.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_room_access BOOLEAN NOT NULL DEFAULT FALSE;

-- Operator/service-role only: nessuna policy → nega anon/authenticated
-- (stessa postura di paygate_orders e della 014).
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
