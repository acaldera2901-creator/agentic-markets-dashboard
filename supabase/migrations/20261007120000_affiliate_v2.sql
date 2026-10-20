-- #AFFILIATE-V2-0930 — PR-1: le sette tabelle del programma affiliati a commissione.
--
-- SOLO ADDITIVA: sette tabelle nuove, nessuna tabella esistente toccata, nessun
-- dato scritto. Il vecchio referral a giorni PRO (`referral_rewards`) resta com'è.
-- Spec: artifacts/affiliate-v2/PROPOSAL-tecnica.md §4.1 (APPROVE #AFFILIATE-V2-0930),
-- rivista da PROPOSAL-crypto-payout.md (decisione di Andrea 2026-10-07: payout
-- SOLO in crypto, niente provider terzo).
--
-- Timestamp 20261007120000 (era 20260930200000): `supabase db push` rifiuta una
-- migration più vecchia dell'ultima già applicata in remoto, e su main c'è già
-- 20261003090000. Va riallineato di nuovo se al momento dell'apply ce n'è una più
-- recente.
--
-- NON si applica da sola: le migration partono solo a mano, via workflow_dispatch
-- con `approved_sha` (.github/workflows/supabase-migrations.yml).
--
-- Postura di sicurezza identica a `referral_rewards` (20260808155653): RLS attiva
-- e NESSUNA policy, deliberatamente. Si leggono e si scrivono solo dal server
-- (service_role / exec_sql). Una policy aggiunta qui APRIREBBE un accesso.
--
-- Importi in numeric(12,2) USD. Rollback: DROP delle sette tabelle, possibile solo
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
  -- Niente colonne di payout qui: il wallet sta in affiliate_wallets (storico
  -- dei cambi), il blocco dei pagamenti è `status = 'suspended'`.
  --
  -- D3 (KYC minimo alla registrazione del wallet: nome legale + paese ISO-3166
  -- alpha-2 + autodichiarazione "non sanzionato, responsabile delle mie tasse").
  -- Default RACCOMANDATO, non deciso: le colonne sono nullable e l'obbligo lo
  -- applica il codice (AFFILIATE_KYC_AT_WALLET), così spegnerlo non chiede una
  -- migration. Un documento d'identità sopra soglia è fuori da qui (fiscalista).
  payee_legal_name    text         CHECK (payee_legal_name IS NULL
                                          OR LENGTH(TRIM(payee_legal_name)) BETWEEN 2 AND 200),
  payee_country       text         CHECK (payee_country IS NULL OR payee_country ~ '^[A-Z]{2}$'),
  payee_declared_at   timestamptz,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),
  -- L'autodichiarazione vale solo insieme ai dati che dichiara.
  CHECK (payee_declared_at IS NULL
         OR (payee_legal_name IS NOT NULL AND payee_country IS NOT NULL))
);

-- ── affiliate_referral_clicks: solo metrica, nessun valore in chiaro ─────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_referral_clicks (
  id            bigserial    PRIMARY KEY,
  affiliate_id  bigint       NOT NULL REFERENCES public.affiliates(id),
  clicked_at    timestamptz  NOT NULL DEFAULT now(),
  -- HMAC-SHA256 con segreto server AFFILIATE_HASH_SECRET, mai il valore in chiaro.
  ip_hash       text,
  ua_hash       text,
  landing       text
);

CREATE INDEX IF NOT EXISTS idx_affiliate_referral_clicks_affiliate_time
  ON public.affiliate_referral_clicks (affiliate_id, clicked_at);

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

-- ── affiliate_wallets: dove l'affiliato vuole essere pagato (solo crypto) ────
-- Append-only: cambiare wallet = revocare la riga attiva e inserirne una nuova,
-- così lo storico dei cambi resta (serve all'antifrode e alle contestazioni).
-- Il formato per rete lo controlla il CHECK; il checksum (base58check Tron) lo
-- controlla lib/affiliate/wallet.ts prima dell'INSERT. Le due liste coin/network
-- devono restare uguali a PAYOUT_COINS / PAYOUT_NETWORKS in quel file.
CREATE TABLE IF NOT EXISTS public.affiliate_wallets (
  id               bigserial    PRIMARY KEY,
  affiliate_id     bigint       NOT NULL REFERENCES public.affiliates(id),
  coin             text         NOT NULL CHECK (coin IN ('USDT','USDC')),
  network          text         NOT NULL CHECK (network IN ('polygon','tron')),
  address          text         NOT NULL,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  -- HMAC come affiliate_referral_clicks: chi ha cambiato il wallet, senza IP in chiaro.
  created_ip_hash  text,
  -- Anti account-takeover: un wallet appena inserito non riceve pagamenti prima
  -- di questa data (created_at + cooldown, deciso dal codice).
  usable_after     timestamptz  NOT NULL,
  revoked_at       timestamptz,
  CHECK (usable_after >= created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  -- Circle ha ritirato USDC da Tron: la combinazione non esiste.
  CHECK (NOT (coin = 'USDC' AND network = 'tron')),
  CHECK (
       (network = 'tron'    AND address ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$')
    OR (network = 'polygon' AND address ~ '^0x[0-9a-fA-F]{40}$'
                            AND LOWER(address) <> '0x0000000000000000000000000000000000000000')
  )
);

-- Un solo wallet attivo per affiliato.
CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_wallets_one_active
  ON public.affiliate_wallets (affiliate_id)
  WHERE revoked_at IS NULL;

-- Antifrode: lo stesso indirizzo su due affiliati è un segnale (multi-account),
-- non un divieto — per questo indice semplice e non UNIQUE.
CREATE INDEX IF NOT EXISTS idx_affiliate_wallets_network_address
  ON public.affiliate_wallets (network, LOWER(address));

-- ── affiliate_payouts: un pagamento on-chain eseguito a mano dall'admin ──────
-- Ciclo: created (righe del ledger → in_payout) → submitted (tx hash registrato,
-- conferme on-chain in attesa) → paid (verificato on-chain; righe → paid).
-- cancelled solo PRIMA che esista una tx: le righe tornano payable.
-- Creata prima del ledger perché il ledger la referenzia (payout_id).
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id               bigserial      PRIMARY KEY,
  affiliate_id     bigint         NOT NULL REFERENCES public.affiliates(id),
  -- Il mese di competenza, sempre il primo del mese.
  period_month     date           NOT NULL
                     CHECK (period_month = date_trunc('month', period_month)::date),
  amount_usd       numeric(12,2)  NOT NULL CHECK (amount_usd > 0),
  coin             text           NOT NULL CHECK (coin IN ('USDT','USDC')),
  network          text           NOT NULL CHECK (network IN ('polygon','tron')),
  wallet_id        bigint         NOT NULL REFERENCES public.affiliate_wallets(id),
  -- Copia dell'indirizzo al momento del pagamento: il wallet può cambiare
  -- dopo, il pagamento resta dov'è andato.
  to_address       text           NOT NULL,
  -- Quanto è partito davvero on-chain (letto dalla verifica, non digitato).
  amount_coin      numeric(20,6),
  network_fee_usd  numeric(12,4),
  -- Minuscolo: Tron = 64 hex, EVM = 0x + 64 hex.
  tx_hash          text,
  status           text           NOT NULL DEFAULT 'created'
                     CHECK (status IN ('created','submitted','paid','cancelled')),
  created_by       text           NOT NULL,
  created_at       timestamptz    NOT NULL DEFAULT now(),
  submitted_at     timestamptz,
  paid_at          timestamptz,
  cancelled_at     timestamptz,
  cancel_reason    text,
  CHECK (tx_hash IS NULL
         OR (network = 'tron'    AND tx_hash ~ '^[0-9a-f]{64}$')
         OR (network = 'polygon' AND tx_hash ~ '^0x[0-9a-f]{64}$')),
  CHECK (status NOT IN ('submitted','paid') OR (tx_hash IS NOT NULL AND submitted_at IS NOT NULL)),
  CHECK (status <> 'paid' OR (paid_at IS NOT NULL AND amount_coin IS NOT NULL)),
  CHECK (status <> 'cancelled' OR (tx_hash IS NULL AND cancelled_at IS NOT NULL))
);

-- Un pagamento per affiliato per mese (gli annullati non contano).
CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_payouts_one_per_month
  ON public.affiliate_payouts (affiliate_id, period_month)
  WHERE status <> 'cancelled';

-- Una tx non paga due volte lo stesso indirizzo. Con `to_address` nella chiave
-- una futura multi-send (una tx, N destinatari) non richiede una migration.
CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_payouts_tx_recipient
  ON public.affiliate_payouts (network, tx_hash, LOWER(to_address))
  WHERE tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status
  ON public.affiliate_payouts (status, period_month);

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
  payout_id            bigint         REFERENCES public.affiliate_payouts(id),
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
ALTER TABLE public.affiliate_referral_clicks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_attributions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_wallets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payer_fingerprints ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.affiliates, public.affiliate_referral_clicks, public.affiliate_attributions,
              public.affiliate_wallets, public.affiliate_payouts, public.affiliate_commissions,
              public.affiliate_payer_fingerprints
  FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
   ON public.affiliates, public.affiliate_referral_clicks, public.affiliate_attributions,
      public.affiliate_wallets, public.affiliate_payouts, public.affiliate_commissions,
      public.affiliate_payer_fingerprints
   TO service_role;

GRANT USAGE, SELECT
   ON SEQUENCE public.affiliates_id_seq, public.affiliate_referral_clicks_id_seq,
               public.affiliate_wallets_id_seq, public.affiliate_payouts_id_seq,
               public.affiliate_commissions_id_seq
   TO service_role;
