-- #CREATOR-OFFERS-1031 (workstream B) — mese Pro per i creator, coorti, KPI
-- mensili per creator, conteggi dei click conservati oltre i 90 giorni.
--
-- Solo additiva, idempotente (riapplicabile). Il flusso standard non cambia:
--   * affiliates.cohort ha default 'standard' → gli affiliati esistenti restano tali;
--   * creator_grants è scritta solo dall'endpoint admin del grant;
--   * affiliate_purge_clicks cancella esattamente le stesse righe di prima, in più
--     ne somma i conteggi mensili in affiliate_click_months NELLO STESSO statement
--     (nessun dato personale: affiliato, mese, numero).
--
-- NON si applica da sola: PROPOSAL #CREATOR-OFFERS-1031, ordine dopo le
-- 20261101* del workstream A. Rollback: scripts/affiliate-v2/rollback_creator_grants_kpi_1102.sql.

-- ── Coorte: standard / creator umano / creator agente ───────────────────────
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS cohort text NOT NULL DEFAULT 'standard'
  CHECK (cohort IN ('standard','creator_human','creator_agent'));

-- ── Conteggi mensili dei click cancellati dalla retention ────────────────────
-- Contiene SOLO i click già cancellati da affiliate_referral_clicks: il totale
-- di un mese = righe vive + questa tabella (la vista lo fa già).
CREATE TABLE IF NOT EXISTS public.affiliate_click_months (
  affiliate_id  bigint  NOT NULL REFERENCES public.affiliates(id),
  month         date    NOT NULL CHECK (month = date_trunc('month', month)::date),
  clicks        bigint  NOT NULL CHECK (clicks >= 0),
  PRIMARY KEY (affiliate_id, month)
);
ALTER TABLE public.affiliate_click_months ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affiliate_click_months FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.affiliate_purge_clicks()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  -- Un solo statement: DELETE e somma mensile sono atomici (un giro fallito non
  -- perde conteggi, uno riuscito non li somma due volte).
  WITH gone AS (
    DELETE FROM public.affiliate_referral_clicks
     WHERE clicked_at < now() - interval '90 days'
    RETURNING affiliate_id, clicked_at
  ), months AS (
    INSERT INTO public.affiliate_click_months (affiliate_id, month, clicks)
    SELECT affiliate_id, date_trunc('month', clicked_at AT TIME ZONE 'UTC')::date, count(*)
      FROM gone GROUP BY 1, 2
    ON CONFLICT (affiliate_id, month)
      DO UPDATE SET clicks = public.affiliate_click_months.clicks + EXCLUDED.clicks
    RETURNING 1
  )
  SELECT count(*) INTO n FROM gone;
  RETURN jsonb_build_object('ok', true, 'purged', n, 'retention_days', 90);
END $$;

REVOKE ALL ON FUNCTION public.affiliate_purge_clicks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_purge_clicks() TO service_role;

-- ── creator_grants: il mese Pro di benvenuto, una volta per identifier ───────
CREATE TABLE IF NOT EXISTS public.creator_grants (
  id             bigserial    PRIMARY KEY,
  identifier     text         NOT NULL UNIQUE CHECK (identifier = LOWER(TRIM(identifier)) AND identifier <> ''),
  granted_at     timestamptz  NOT NULL DEFAULT now(),
  expires_at     timestamptz  NOT NULL,
  granted_by     text         NOT NULL CHECK (length(trim(granted_by)) >= 2),
  previous_plan  text,
  note           text,
  CHECK (expires_at > granted_at)
);

CREATE OR REPLACE FUNCTION public.creator_grants_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'creator_grants is append-only';
END $$;
DROP TRIGGER IF EXISTS trg_creator_grants_append_only ON public.creator_grants;
CREATE TRIGGER trg_creator_grants_append_only
  BEFORE UPDATE OR DELETE ON public.creator_grants
  FOR EACH ROW EXECUTE FUNCTION public.creator_grants_append_only();

ALTER TABLE public.creator_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.creator_grants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.creator_grants_id_seq FROM PUBLIC, anon, authenticated;

-- Concede 30 giorni di premium (decisione Andrea 31/10: durata fissa).
-- Rifiuta: profilo inesistente, admin_full, pending_payment (un pagamento USDT
-- in verifica va chiuso prima), qualunque piano base/premium ATTIVO che non sia
-- un regalo referral (= abbonamento pagato, anche USDT 'manual' o legacy senza
-- source). Un regalo referral attivo viene ESTESO dalla sua scadenza: mai
-- accorciato. Idempotente: un secondo grant restituisce quello esistente.
-- Il lock sul profilo serializza due grant concorrenti.
CREATE OR REPLACE FUNCTION public.affiliate_grant_creator_pro(
  p_identifier text, p_by text, p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id      text := LOWER(TRIM(COALESCE(p_identifier, '')));
  v_prof    record;
  v_grant   record;
  v_active  boolean;
  v_exp     timestamptz;
BEGIN
  IF v_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_identifier');
  END IF;
  IF p_by IS NULL OR length(trim(p_by)) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'actor_required');
  END IF;

  SELECT identifier, plan, plan_expires_at, plan_source INTO v_prof
    FROM profiles
   WHERE identifier = v_id OR LOWER(TRIM(identifier)) = v_id
   LIMIT 1
   FOR UPDATE;

  SELECT granted_at, expires_at, granted_by INTO v_grant FROM creator_grants WHERE identifier = v_id;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'identifier', v_id,
      'granted_at', v_grant.granted_at, 'expires_at', v_grant.expires_at, 'granted_by', v_grant.granted_by);
  END IF;

  IF v_prof.identifier IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_prof.plan = 'admin_full' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_plan');
  END IF;
  IF v_prof.plan = 'pending_payment' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pending_payment');
  END IF;

  v_active := v_prof.plan IN ('base','premium')
              AND (v_prof.plan_expires_at IS NULL OR v_prof.plan_expires_at > now());
  IF v_active AND v_prof.plan_source IS DISTINCT FROM 'referral' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'paid_plan_active');
  END IF;

  v_exp := GREATEST(CASE WHEN v_active THEN v_prof.plan_expires_at ELSE now() END, now()) + interval '30 days';

  INSERT INTO creator_grants (identifier, expires_at, granted_by, previous_plan, note)
  VALUES (v_id, v_exp, trim(p_by), v_prof.plan, NULLIF(trim(COALESCE(p_note, '')), ''))
  ON CONFLICT (identifier) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'identifier', v_id);
  END IF;

  UPDATE profiles
     SET plan = 'premium',
         requested_plan = NULL,
         plan_expires_at = v_exp,
         plan_source = 'manual',
         updated_at = now()
   WHERE identifier = v_prof.identifier;

  RETURN jsonb_build_object('ok', true, 'already', false, 'identifier', v_prof.identifier,
    'previous_plan', v_prof.plan, 'expires_at', v_exp);
END $$;

-- Coorte di un affiliato: solo admin (service_role via endpoint admin).
CREATE OR REPLACE FUNCTION public.affiliate_set_cohort(
  p_affiliate_id bigint, p_cohort text, p_by text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_old text;
BEGIN
  IF p_cohort IS NULL OR p_cohort NOT IN ('standard','creator_human','creator_agent') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_cohort');
  END IF;
  IF p_by IS NULL OR length(trim(p_by)) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'actor_required');
  END IF;
  SELECT cohort INTO v_old FROM affiliates WHERE id = p_affiliate_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_old <> p_cohort THEN
    UPDATE affiliates SET cohort = p_cohort WHERE id = p_affiliate_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'affiliate_id', p_affiliate_id, 'cohort', p_cohort,
    'previous', v_old, 'changed', v_old <> p_cohort);
END $$;

REVOKE EXECUTE ON FUNCTION public.affiliate_grant_creator_pro(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_set_cohort(bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_grant_creator_pro(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_set_cohort(bigint, text, text) TO service_role;

-- ── KPI mensili per affiliato (mese UTC) ─────────────────────────────────────
-- clicks          righe vive + conteggi conservati dalla retention
-- signups         attribuzioni valid con attributed_at nel mese
-- activated       referiti con un pagamento `first` nel mese, non stornato del tutto
-- paying          referiti distinti con un pagamento first|renewal nel mese, netto
--                 dopo gli storni (reverses_id) > 0
-- mrr_usd         somma del netto dopo gli storni dei pagamenti del mese. Il ledger
--                 non distingue mensile/annuale: un annuale pesa tutto nel mese
--                 in cui è pagato (non è spalmato ÷12).
-- commission_usd  somma amount_usd delle righe del mese (storni inclusi, void esclusi)
-- shadow_rows     righe del mese in stato `shadow` (programma in prova): se > 0 il
--                 mese contiene commissioni di prova, non pagabili.
-- Le righe void/reversed non contano come pagamento. security_invoker: la vista
-- non scavalca RLS/grant delle tabelle; nessun accesso a anon/authenticated.
DROP VIEW IF EXISTS public.affiliate_creator_monthly;
CREATE VIEW public.affiliate_creator_monthly WITH (security_invoker = true) AS
WITH click_m AS (
  SELECT affiliate_id, month, SUM(n)::bigint AS clicks FROM (
    SELECT affiliate_id, date_trunc('month', clicked_at AT TIME ZONE 'UTC')::date AS month, count(*) AS n
      FROM public.affiliate_referral_clicks GROUP BY 1, 2
    UNION ALL
    SELECT affiliate_id, month, clicks FROM public.affiliate_click_months
  ) k GROUP BY 1, 2
), signup_m AS (
  SELECT affiliate_id, date_trunc('month', attributed_at AT TIME ZONE 'UTC')::date AS month, count(*)::bigint AS signups
    FROM public.affiliate_attributions WHERE status = 'valid' GROUP BY 1, 2
), pay AS (
  SELECT c.affiliate_id, date_trunc('month', c.paid_at AT TIME ZONE 'UTC')::date AS month,
         c.referred_identifier, c.kind,
         c.net_usd + COALESCE((SELECT SUM(r.net_usd) FROM public.affiliate_commissions r WHERE r.reverses_id = c.id), 0) AS net_after
    FROM public.affiliate_commissions c
   WHERE c.kind IN ('first','renewal') AND c.status NOT IN ('void','reversed')
), pay_m AS (
  SELECT affiliate_id, month,
         count(DISTINCT referred_identifier) FILTER (WHERE kind = 'first' AND net_after > 0)::bigint AS activated,
         count(DISTINCT referred_identifier) FILTER (WHERE net_after > 0)::bigint AS paying,
         SUM(GREATEST(net_after, 0))::numeric(12,2) AS mrr_usd
    FROM pay GROUP BY 1, 2
), comm_m AS (
  SELECT affiliate_id, date_trunc('month', paid_at AT TIME ZONE 'UTC')::date AS month,
         SUM(amount_usd) FILTER (WHERE status <> 'void')::numeric(12,2) AS commission_usd,
         count(*) FILTER (WHERE status = 'shadow')::bigint AS shadow_rows
    FROM public.affiliate_commissions GROUP BY 1, 2
), keys AS (
  SELECT affiliate_id, month FROM click_m
  UNION SELECT affiliate_id, month FROM signup_m
  UNION SELECT affiliate_id, month FROM pay_m
  UNION SELECT affiliate_id, month FROM comm_m
)
SELECT a.id AS affiliate_id, a.code, a.cohort, k.month,
       COALESCE(cl.clicks, 0)          AS clicks,
       COALESCE(s.signups, 0)          AS signups,
       COALESCE(p.activated, 0)        AS activated,
       COALESCE(p.paying, 0)           AS paying,
       COALESCE(p.mrr_usd, 0)          AS mrr_usd,
       COALESCE(cm.commission_usd, 0)  AS commission_usd,
       COALESCE(cm.shadow_rows, 0)     AS shadow_rows
  FROM keys k
  JOIN public.affiliates a ON a.id = k.affiliate_id
  LEFT JOIN click_m  cl ON cl.affiliate_id = k.affiliate_id AND cl.month = k.month
  LEFT JOIN signup_m s  ON s.affiliate_id  = k.affiliate_id AND s.month  = k.month
  LEFT JOIN pay_m    p  ON p.affiliate_id  = k.affiliate_id AND p.month  = k.month
  LEFT JOIN comm_m   cm ON cm.affiliate_id = k.affiliate_id AND cm.month = k.month;

REVOKE ALL ON public.affiliate_creator_monthly FROM PUBLIC, anon, authenticated;
