-- #AFFILIATE-V2-0930 — PR-1: le sei tabelle del programma affiliati a commissione.
--
-- SOLO ADDITIVA: sei tabelle nuove, nessuna tabella esistente toccata, nessun
-- dato scritto. Il vecchio referral a giorni PRO (`referral_rewards`) resta com'è.
-- Spec: artifacts/affiliate-v2/PROPOSAL-tecnica.md §4.1 (APPROVE #AFFILIATE-V2-0930).
--
-- NON si applica da sola: le migration partono solo a mano, via workflow_dispatch
-- con `approved_sha` (.github/workflows/supabase-migrations.yml).
--
-- Postura di sicurezza identica a `referral_rewards` (20260808155653): RLS attiva
-- e NESSUNA policy, deliberatamente. Si leggono e si scrivono solo dal server
-- (service_role / exec_sql). Una policy aggiunta qui APRIREBBE un accesso.
--
-- Importi in numeric(12,2) USD. Rollback: DROP delle sei tabelle, possibile solo
-- finché `affiliate_commissions` non contiene righe `paid` — da lì in poi è un
-- registro contabile e non si cancella.

-- ── affiliates: l'iscrizione (gratuita, T&C + 18+ obbligatori) ───────────────
CREATE TABLE IF NOT EXISTS public.affiliates (
  id                  bigserial    PRIMARY KEY,
  -- Il profilo, normalizzato LOWER(TRIM): il CHECK impedisce che una riga
  -- scritta male sfugga allo UNIQUE per una maiuscola.
  identifier          text         NOT NULL UNIQUE
                        CHECK (identifier = LOWER(TRIM(identifier))),
  -- Riusa profiles.referral_code (immutabile): i link /r/CODE già in giro
  -- continuano a funzionare. Salvato MAIUSCOLO (come normalizeRefCode e
  -- referred_by): la lookup è `code = $1` sul valore già maiuscolo, e usa
  -- l'indice dello UNIQUE.
  code                text         NOT NULL UNIQUE
                        CHECK (code = UPPER(code)),
  status              text         NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','terminated')),
  terms_version       text         NOT NULL,
  terms_accepted_at   timestamptz  NOT NULL,
  age_confirmed_at    timestamptz  NOT NULL,
  payout_provider     text,
  payout_recipient_id text,
  payout_status       text         DEFAULT 'none'
                        CHECK (payout_status IN ('none','pending_kyc','verified','blocked')),
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now()
);

-- ── affiliate_clicks: solo metrica, nessun valore in chiaro ─────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id            bigserial    PRIMARY KEY,
  affiliate_id  bigint       NOT NULL REFERENCES public.affiliates(id),
  clicked_at    timestamptz  NOT NULL DEFAULT now(),
  -- HMAC-SHA256 con segreto server AFFILIATE_HASH_SECRET, mai il valore in chiaro.
  ip_hash       text,
  ua_hash       text,
  landing       text
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate_time
  ON public.affiliate_clicks (affiliate_id, clicked_at);

-- ── affiliate_attributions: un utente, al massimo un affiliato, un livello ──
CREATE TABLE IF NOT EXISTS public.affiliate_attributions (
  -- La PK rende impossibili sia il doppio referente sia l'MLM.
  referred_identifier  text         PRIMARY KEY,
  affiliate_id         bigint       NOT NULL REFERENCES public.affiliates(id),
  source               text         CHECK (source IN ('signup_ref','claim','admin')),
  attributed_at        timestamptz  NOT NULL,
  signup_ip_hash       text,
  signup_device_hash   text,
  status               text         NOT NULL DEFAULT 'valid'
                         CHECK (status IN ('valid','self_referral','fraud_review','void')),
  status_reason        text
);

CREATE INDEX IF NOT EXISTS idx_affiliate_attributions_affiliate
  ON public.affiliate_attributions (affiliate_id);

-- ── affiliate_payouts: i batch verso il provider ────────────────────────────
-- Creata prima del ledger solo per ordine di lettura: il ledger ne tiene l'id
-- (payout_id) senza FK, come da spec.
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id                   bigserial      PRIMARY KEY,
  affiliate_id         bigint         NOT NULL,
  amount_usd           numeric(12,2)  NOT NULL CHECK (amount_usd > 0),
  provider             text           NOT NULL,
  provider_payment_id  text           UNIQUE,
  status               text           CHECK (status IN ('created','submitted','paid','failed','returned')),
  created_at           timestamptz    NOT NULL DEFAULT now(),
  settled_at           timestamptz
);

-- ── affiliate_commissions: il ledger, append-only ───────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id                   bigserial      PRIMARY KEY,
  affiliate_id         bigint         NOT NULL REFERENCES public.affiliates(id),
  referred_identifier  text           NOT NULL,
  rail                 text           NOT NULL
                         CHECK (rail IN ('paygate','crypto','paypal','shopify','stripe','admin')),
  rail_payment_ref     text           NOT NULL,
  -- Id dell'EVENTO sul rail che ha generato la riga, oltre al pagamento: per
  -- reversal/clawback è l'id del rimborso/dispute, così un pagamento può avere
  -- più rimborsi parziali. '' per first/renewal (l'evento è il pagamento
  -- stesso). NOT NULL con default perché è parte dello UNIQUE: un NULL lo
  -- renderebbe inefficace.
  rail_event_ref       text           NOT NULL DEFAULT '',
  kind              text           NOT NULL
                         CHECK (kind IN ('first','renewal','reversal','clawback')),
  gross_usd            numeric(12,2)  NOT NULL,
  net_usd              numeric(12,2)  NOT NULL,
  rate                 numeric(5,4)   NOT NULL,
  -- net_usd × rate arrotondato a 2 decimali; negativo su reversal/clawback.
  amount_usd           numeric(12,2)  NOT NULL,
  -- 0 = primo acquisto, poi 1, 2, …
  renewal_index        int            NOT NULL,
  status               text           NOT NULL
                         CHECK (status IN ('shadow','pending','payable','in_payout','paid','reversed','void')),
  -- Data dell'incasso; payable_after = paid_at + hold.
  paid_at              timestamptz    NOT NULL,
  payable_after        timestamptz    NOT NULL,
  reverses_id          bigint         REFERENCES public.affiliate_commissions(id),
  payout_id            bigint,
  created_at           timestamptz    NOT NULL DEFAULT now(),
  -- La redelivery di un webhook o un reconcile cron non scrivono mai due volte.
  -- `rail_event_ref` nella chiave: la redelivery dello STESSO rimborso è un
  -- duplicato, un secondo rimborso parziale dello stesso pagamento no.
  UNIQUE (rail, rail_payment_ref, kind, rail_event_ref),
  -- Una riga positiva non ha un evento distinto dal pagamento.
  CHECK (kind NOT IN ('first','renewal') OR rail_event_ref = ''),
  CHECK ((kind IN ('first','renewal')) = (amount_usd >= 0))
);

-- Lo UNIQUE qui sopra NON basta a deduplicare un incasso: il ledger sceglie
-- `kind` contando le righe già presenti, quindi la seconda consegna dello stesso
-- pagamento arriverebbe come 'renewal' dove la prima era 'first' — kind diverso,
-- nessun conflitto, commissione doppia. Un incasso produce al massimo UNA riga
-- positiva, qualunque kind abbia.
CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_commissions_one_positive_per_payment
  ON public.affiliate_commissions (rail, rail_payment_ref)
  WHERE kind IN ('first','renewal');

-- Due pagamenti CONCORRENTI dello stesso referito contano le stesse righe e
-- calcolerebbero lo stesso renewal_index (due 'first' al 20%). Il vincolo fa
-- perdere la corsa a uno dei due, che ricalcola l'indice e riprova.
CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_commissions_referred_index
  ON public.affiliate_commissions (referred_identifier, renewal_index)
  WHERE kind IN ('first','renewal');

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_referred
  ON public.affiliate_commissions (referred_identifier);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_status
  ON public.affiliate_commissions (affiliate_id, status);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status_payable
  ON public.affiliate_commissions (status, payable_after);

-- ── affiliate_payer_fingerprints: anti-self-referral oltre l'identificativo ──
CREATE TABLE IF NOT EXISTS public.affiliate_payer_fingerprints (
  identifier  text         NOT NULL,
  -- NOT NULL: è parte dello UNIQUE, e un NULL lo renderebbe inefficace.
  kind        text         NOT NULL
                CHECK (kind IN ('paypal_payer_id','stripe_card_fp','shopify_customer_id','email_canonical','ip_hash','device_hash')),
  value_hash  text         NOT NULL,
  seen_at     timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (identifier, kind, value_hash)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payer_fingerprints_kind_value
  ON public.affiliate_payer_fingerprints (kind, value_hash);

-- ── Accesso: solo server ────────────────────────────────────────────────────
ALTER TABLE public.affiliates                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_attributions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payer_fingerprints ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.affiliates, public.affiliate_clicks, public.affiliate_attributions,
              public.affiliate_payouts, public.affiliate_commissions,
              public.affiliate_payer_fingerprints
  FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
   ON public.affiliates, public.affiliate_clicks, public.affiliate_attributions,
      public.affiliate_payouts, public.affiliate_commissions,
      public.affiliate_payer_fingerprints
   TO service_role;

GRANT USAGE, SELECT
   ON SEQUENCE public.affiliates_id_seq, public.affiliate_clicks_id_seq,
               public.affiliate_payouts_id_seq, public.affiliate_commissions_id_seq
   TO service_role;
