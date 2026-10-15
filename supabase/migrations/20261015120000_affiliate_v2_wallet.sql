-- #AFFILIATE-V2-CRYPTO-1007 — PR-5: iscrizione + wallet dell'affiliato.
--
-- Spec: artifacts/affiliate-v2/SPEC-ui.md §3.1, §3.3, §3.4, §12 (decisioni di
-- Andrea del 15/10/2026). Si appoggia a 20261007120000_affiliate_v2.sql (PR #482).
--
-- Perché una migration nuova e non una modifica di quella di #482: #482 è già
-- approvata così com'è e non è applicata; qui ci sono solo ADD COLUMN su tabelle
-- che al momento dell'apply sono vuote (nessun endpoint le popola prima di PR-5)
-- più tre funzioni. Tenerle separate lascia #482 identica a quanto approvato e
-- rende questo diff leggibile da solo. L'ordine dei timestamp garantisce che
-- giri dopo #482.
--
-- NON si applica da sola: workflow_dispatch con `approved_sha`
-- (.github/workflows/supabase-migrations.yml). Idempotente: IF NOT EXISTS sulle
-- colonne, vincoli aggiunti solo se assenti, CREATE OR REPLACE sulle funzioni.
--
-- Perché funzioni e non SQL dal codice: `exec_sql` non restituisce né RETURNING
-- né il rowcount, e il cambio wallet DEVE essere una sola transazione (revoca +
-- nuovo wallet + dati del beneficiario + annullo del payout in preparazione +
-- commissioni rimesse a payable). Stesso schema di claim_paygate_order.
--
-- Rollback (solo prima che esistano dati veri): DROP delle tre funzioni e delle
-- colonne aggiunte qui. Le tabelle di #482 restano.

-- ── affiliates: clausole onerose + autodichiarazioni D3 separate ─────────────
-- Accettazione SPECIFICA delle clausole onerose (artt. 1341-1342 c.c.), separata
-- dai T&C: terza spunta obbligatoria all'iscrizione. NOT NULL come
-- terms_accepted_at: all'apply la tabella è vuota (nessuno può iscriversi prima
-- di PR-5); se non lo fosse, l'apply fallisce invece di inventare un consenso.
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS onerous_ack_at       timestamptz NOT NULL,
  ADD COLUMN IF NOT EXISTS onerous_ack_version  text        NOT NULL,
  -- D3: due autodichiarazioni distinte, ciascuna col suo timestamp (non una
  -- dichiarazione cumulativa). `payee_declared_at` (di #482) resta: è l'ultima
  -- volta che sono stati dichiarati i dati del beneficiario nel loro insieme.
  ADD COLUMN IF NOT EXISTS payee_sanctions_declared_at  timestamptz,
  ADD COLUMN IF NOT EXISTS payee_tax_declared_at        timestamptz,
  -- Versione del testo delle dichiarazioni accettato (stessa dei T&C affiliati).
  ADD COLUMN IF NOT EXISTS payee_declarations_version   text;

-- ── affiliate_wallets: conferma di rete + esito dello screening ──────────────
ALTER TABLE public.affiliate_wallets
  -- «Il mio wallet/exchange accetta USDT su questa rete»: spunta obbligatoria.
  ADD COLUMN IF NOT EXISTS network_ack_at       timestamptz,
  -- Screening dell'indirizzo contro le liste di sanzioni. Nessun provider è
  -- integrato (provider non scelto né verificato): senza provider il wallet si
  -- salva come 'not_screened' e NON è pagabile. Un indirizzo 'blocked' non si
  -- salva affatto (il codice risponde address_blocked), quindi qui non compare.
  ADD COLUMN IF NOT EXISTS screening_result     text NOT NULL DEFAULT 'not_screened',
  ADD COLUMN IF NOT EXISTS screened_at          timestamptz,
  ADD COLUMN IF NOT EXISTS screening_provider   text;

-- ── affiliate_payouts: motivo d'annullo enumerato (quello libero resta admin) ─
-- L'affiliato vede solo cancel_code → testo; cancel_reason (testo libero
-- dell'admin) non esce mai verso di lui.
ALTER TABLE public.affiliate_payouts
  ADD COLUMN IF NOT EXISTS cancel_code text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'affiliates_payee_decl_needs_payee') THEN
    ALTER TABLE public.affiliates ADD CONSTRAINT affiliates_payee_decl_needs_payee
      CHECK ((payee_sanctions_declared_at IS NULL AND payee_tax_declared_at IS NULL)
             OR (payee_legal_name IS NOT NULL AND payee_country IS NOT NULL
                 AND payee_declarations_version IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_wallets_screening_result') THEN
    ALTER TABLE public.affiliate_wallets ADD CONSTRAINT affiliate_wallets_screening_result
      CHECK (screening_result IN ('clear','not_screened'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_wallets_clear_needs_time') THEN
    ALTER TABLE public.affiliate_wallets ADD CONSTRAINT affiliate_wallets_clear_needs_time
      CHECK (screening_result <> 'clear' OR (screened_at IS NOT NULL AND screening_provider IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_payouts_cancel_code') THEN
    ALTER TABLE public.affiliate_payouts ADD CONSTRAINT affiliate_payouts_cancel_code
      CHECK (cancel_code IS NULL OR cancel_code IN
             ('wallet_changed','wallet_removed','admin_cancelled','affiliate_suspended','tx_dropped'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_payouts_cancelled_has_code') THEN
    ALTER TABLE public.affiliate_payouts ADD CONSTRAINT affiliate_payouts_cancelled_has_code
      CHECK ((status = 'cancelled') = (cancel_code IS NOT NULL));
  END IF;
END $$;

-- ── profiles: codice referral univoco (QA F11) ───────────────────────────────
-- Il codice dell'affiliato È profiles.referral_code: l'iscrizione si affida al suo
-- UNIQUE per perdere le corse. In prod l'indice esiste già (verificato in sola
-- lettura il 15/10/2026: uq_profiles_referral_code su UPPER(referral_code),
-- parziale, 0 duplicati) ma nessuna migration del repo lo crea: un ambiente
-- ricostruito dalle migration ne sarebbe privo. Stesso nome e stessa
-- definizione → in prod è un no-op.
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_referral_code
  ON public.profiles (UPPER(referral_code))
  WHERE referral_code IS NOT NULL;

-- ── Annullo dei payout in preparazione (interno) ─────────────────────────────
-- Solo `created`: un payout con un tx hash non si annulla mai (CHECK di #482).
-- Le righe del ledger congelate tornano `payable` e senza payout_id.
-- Chi chiama deve avere già il lock sulla riga di `affiliates`.
CREATE OR REPLACE FUNCTION public.affiliate_cancel_created_payouts(
  p_affiliate_id bigint, p_code text, p_reason text
) RETURNS bigint[]
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_ids bigint[];
BEGIN
  WITH c AS (
    UPDATE affiliate_payouts
       SET status = 'cancelled', cancelled_at = now(), cancel_code = p_code, cancel_reason = p_reason
     WHERE affiliate_id = p_affiliate_id AND status = 'created'
    RETURNING id
  )
  SELECT COALESCE(array_agg(id ORDER BY id), '{}') INTO v_ids FROM c;

  IF cardinality(v_ids) > 0 THEN
    UPDATE affiliate_commissions
       SET status = 'payable', payout_id = NULL
     WHERE payout_id = ANY (v_ids) AND status = 'in_payout';
  END IF;
  RETURN v_ids;
END;
$$;

-- ── Registra / cambia wallet: UNA transazione ────────────────────────────────
-- Il vecchio wallet è revocato SUBITO (non resta pagabile durante le 72 h: il
-- cooldown esiste contro l'account takeover, decisione di Andrea 15/10). Il
-- nuovo è utilizzabile dopo 72 h. Il cooldown sta qui e non nel codice: un env
-- con un refuso non può accorciarlo.
-- p_require_kyc = AFFILIATE_KYC_AT_WALLET (D3): il codice valida i campi, qui
-- si ricontrolla (difesa in profondità).
CREATE OR REPLACE FUNCTION public.affiliate_set_wallet(
  p_affiliate_id        bigint,
  p_coin                text,
  p_network             text,
  p_address             text,
  p_ip_hash             text,
  p_screening_result    text,
  p_screening_provider  text,
  p_legal_name          text,
  p_country             text,
  p_declared            boolean,
  p_declarations_version text,
  p_require_kyc         boolean
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status    text;
  v_old_id    bigint;
  v_new_id    bigint;
  v_usable    timestamptz;
  v_cancelled bigint[];
BEGIN
  -- Lock dell'affiliato: serializza i cambi wallet concorrenti e la creazione
  -- dei payout (che prende lo stesso lock), così un payout non può nascere sul
  -- vecchio wallet mentre questo lo sta sostituendo.
  SELECT status INTO v_status FROM affiliates WHERE id = p_affiliate_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_enrolled');
  END IF;
  IF v_status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', v_status);
  END IF;
  IF p_require_kyc AND (p_legal_name IS NULL OR p_country IS NULL OR NOT COALESCE(p_declared, false)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_payee');
  END IF;

  UPDATE affiliate_wallets SET revoked_at = now()
   WHERE affiliate_id = p_affiliate_id AND revoked_at IS NULL
  RETURNING id INTO v_old_id;

  INSERT INTO affiliate_wallets
    (affiliate_id, coin, network, address, created_ip_hash, usable_after,
     network_ack_at, screening_result, screened_at, screening_provider)
  VALUES
    (p_affiliate_id, p_coin, p_network, p_address, p_ip_hash, now() + interval '72 hours',
     now(), p_screening_result,
     CASE WHEN p_screening_result = 'clear' THEN now() END, p_screening_provider)
  RETURNING id, usable_after INTO v_new_id, v_usable;

  IF p_legal_name IS NOT NULL OR p_country IS NOT NULL OR COALESCE(p_declared, false) THEN
    UPDATE affiliates
       SET payee_legal_name = COALESCE(p_legal_name, payee_legal_name),
           payee_country    = COALESCE(p_country, payee_country),
           payee_sanctions_declared_at = CASE WHEN p_declared THEN now() ELSE payee_sanctions_declared_at END,
           payee_tax_declared_at       = CASE WHEN p_declared THEN now() ELSE payee_tax_declared_at END,
           payee_declarations_version  = CASE WHEN p_declared THEN p_declarations_version ELSE payee_declarations_version END,
           payee_declared_at           = now(),
           updated_at = now()
     WHERE id = p_affiliate_id;
  END IF;

  v_cancelled := affiliate_cancel_created_payouts(p_affiliate_id, 'wallet_changed', 'wallet_changed');

  RETURN jsonb_build_object(
    'ok', true,
    'wallet_id', v_new_id,
    'usable_after', v_usable,
    'replaced', v_old_id IS NOT NULL,
    'cancelled_payout_ids', to_jsonb(v_cancelled)
  );
END;
$$;

-- ── Rimuovi wallet (DELETE): revoca senza sostituire ─────────────────────────
-- Ammessa anche a un affiliato sospeso: togliere il proprio indirizzo riduce
-- ciò che si può pagare, non lo aumenta. I pagamenti restano fermi finché non
-- c'è un wallet nuovo (che riparte dalle 72 h).
CREATE OR REPLACE FUNCTION public.affiliate_revoke_wallet(p_affiliate_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old_id    bigint;
  v_cancelled bigint[];
BEGIN
  PERFORM 1 FROM affiliates WHERE id = p_affiliate_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_enrolled');
  END IF;

  UPDATE affiliate_wallets SET revoked_at = now()
   WHERE affiliate_id = p_affiliate_id AND revoked_at IS NULL
  RETURNING id INTO v_old_id;
  IF v_old_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_wallet');
  END IF;

  v_cancelled := affiliate_cancel_created_payouts(p_affiliate_id, 'wallet_removed', 'wallet_removed');
  RETURN jsonb_build_object('ok', true, 'revoked_wallet_id', v_old_id,
                            'cancelled_payout_ids', to_jsonb(v_cancelled));
END;
$$;

-- ── Accesso: solo service_role (come claim_*_order, 20260713150003) ──────────
REVOKE EXECUTE ON FUNCTION public.affiliate_cancel_created_payouts(bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_set_wallet(bigint, text, text, text, text, text, text, text, text, boolean, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_revoke_wallet(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_cancel_created_payouts(bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_set_wallet(bigint, text, text, text, text, text, text, text, text, boolean, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_revoke_wallet(bigint) TO service_role;
