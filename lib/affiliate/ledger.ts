// lib/affiliate/ledger.ts — #AFFILIATE-V2-0930 PR-2
// Scrive UNA riga commissione per ogni incasso attribuibile a un affiliato.
//
// Contratto (lo stesso di checkReferralTiersSafe in lib/plan-grant.ts):
//  · **Non lancia mai.** Il chiamante è un rail di pagamento che ha GIÀ concesso
//    il piano: una commissione mancata si ricostruisce dal log, un pagamento che
//    fallisce per colpa del ledger è un cliente perso.
//  · Si chiama DOPO il grant riuscito, dai CHIAMANTI delle activate*Plan: lì ci
//    sono importo e id ordine, dentro plan-grant.ts no.
//  · I rail usano `scheduleAffiliateCommission`: il lavoro gira in `after()` di
//    next/server, cioè DOPO che la risposta è partita — un webhook Shopify o
//    Stripe non aspetta i roundtrip del ledger.
//  · AFFILIATE_MODE=off (il default) → no-op totale: nessun after(), nessuna
//    query.
//  · shadow → calcola e scrive righe `status='shadow'`: non maturano, non si
//    pagano, non si convertono mai (decisione D10). live → righe `pending`.
//
// Idempotenza e corse: le garantisce il DB (migration 20260930200000).
//  · `uq_affiliate_commissions_one_positive_per_payment` → una sola riga
//    positiva per rail + pagamento: redelivery, PayPal capture+webhook, reconcile.
//  · `uq_affiliate_commissions_referred_index` → due pagamenti concorrenti dello
//    stesso referito non possono prendere lo stesso renewal_index: chi perde la
//    corsa ricalcola e riprova.

import { createHash } from "node:crypto";
import { after } from "next/server";
import { dbQueryStrict, dbExecute } from "@/lib/db";
import { affiliateConfig, affiliateMode, type AffiliateConfig, type AffiliateMode } from "./config";
import { netAmount, commissionAmount, round2, type AffiliateRail, type NetMeta } from "./net";
import { selfReferralCheck, type Fingerprint, type FingerprintKind } from "./self-referral";

export type RecordCommissionInput = {
  /** Chi ha pagato (il referito). */
  identifier: string;
  rail: AffiliateRail;
  /** Id dell'incasso sul rail (ordine, invoice). */
  paymentRef: string;
  /** Lordo in USD; null = importo ignoto → nessuna commissione. */
  grossUsd: number | null | undefined;
  /** Data dell'incasso. */
  paidAt: Date;
  meta?: NetMeta;
};

export type LedgerOutcome = { written: boolean; reason: string };

export type AttributionStatus = "valid" | "self_referral" | "fraud_review" | "void";

export type CommissionDecision =
  | {
      write: true;
      kind: "first" | "renewal";
      rate: number;
      amountUsd: number;
      status: "shadow" | "pending";
      payableAfterISO: string;
    }
  | { write: false; reason: string };

const DAY_MS = 86_400_000;
/** Tentativi sulla corsa del renewal_index: ne basta uno in più per ogni
 *  pagamento concorrente dello stesso referito, e tre sono già un caso limite. */
const MAX_INDEX_ATTEMPTS = 3;

/** Nei log mai l'email del referito: un tag stabile e non reversibile basta a
 *  incrociare le righe del log con il ledger (sha256 dell'identifier). */
export function referredTag(identifier: string): string {
  return createHash("sha256").update(identifier.trim().toLowerCase()).digest("hex").slice(0, 12);
}

/** La decisione, pura: tasso, cap dei rinnovi, stato, hold. */
export function decideCommission(opts: {
  mode: AffiliateMode;
  config: Pick<AffiliateConfig, "firstRate" | "renewalRate" | "renewalMaxMonths" | "holdDays">;
  attributionStatus: AttributionStatus;
  /** Pagamenti di piano già fatti dal referito: 0 = primo acquisto. */
  renewalIndex: number;
  netUsd: number;
  paidAt: Date;
}): CommissionDecision {
  if (opts.mode === "off") return { write: false, reason: "mode_off" };
  if (opts.attributionStatus === "self_referral" || opts.attributionStatus === "void") {
    return { write: false, reason: `attribution_${opts.attributionStatus}` };
  }
  const first = opts.renewalIndex === 0;
  // RENEWAL_MAX_MONTHS = quanti rinnovi pagano: con 12 pagano i rinnovi 1…12 e
  // il 13° no. null = illimitato.
  const max = opts.config.renewalMaxMonths;
  if (!first && max != null && opts.renewalIndex > max) {
    return { write: false, reason: "renewal_cap" };
  }
  const rate = first ? opts.config.firstRate : opts.config.renewalRate;
  const amountUsd = commissionAmount(opts.netUsd, rate);
  if (!(amountUsd > 0)) return { write: false, reason: "zero_amount" };
  return {
    write: true,
    kind: first ? "first" : "renewal",
    rate,
    amountUsd,
    status: opts.mode === "shadow" ? "shadow" : "pending",
    payableAfterISO: new Date(opts.paidAt.getTime() + opts.config.holdDays * DAY_MS).toISOString(),
  };
}

/** Il referito si è registrato dentro la finestra di attribuzione rispetto al
 *  pagamento che lo converte? Stessa finestra del link (lib/referral-code.ts):
 *  un codice di mesi fa non porta un cliente di oggi. Data assente o
 *  illeggibile → no: non si attribuisce su un dato che non c'è. */
export function withinAttributionWindow(signupISO: string | null, paidAt: Date, windowDays: number): boolean {
  if (!signupISO) return false;
  const signup = new Date(signupISO).getTime();
  if (Number.isNaN(signup)) return false;
  return paidAt.getTime() - signup <= windowDays * DAY_MS;
}

type AttributionRow = { affiliate_id: number | string; status: AttributionStatus; attributed_at: string };

async function readAttribution(referred: string): Promise<AttributionRow | null> {
  const rows = await dbQueryStrict<AttributionRow>(
    `SELECT affiliate_id, status, attributed_at::text AS attributed_at
       FROM affiliate_attributions
      WHERE referred_identifier = $1
      LIMIT 1`,
    [referred]
  );
  return rows[0] ?? null;
}

/** L'attribuzione congelata del referito. Alla prima conversione la crea da
 *  `profiles.referred_by` (first-touch, scritto alla registrazione), solo se la
 *  conversione cade nella finestra di attribuzione, e la passa
 *  dall'anti-self-referral. Dopo, non rilegge più `referred_by`. */
async function resolveAttribution(
  referred: string,
  paidAt: Date,
  config: AffiliateConfig
): Promise<{ attribution: AttributionRow } | { reason: string }> {
  const frozen = await readAttribution(referred);
  if (frozen) return { attribution: frozen };

  const prof = await dbQueryStrict<{ referred_by: string | null; created_at: string | null }>(
    `SELECT referred_by, created_at::text AS created_at FROM profiles
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1
      ORDER BY (identifier = $1) DESC
      LIMIT 1`,
    [referred]
  );
  const code = (prof[0]?.referred_by ?? "").trim().toUpperCase();
  if (!code) return { reason: "not_attributed" };
  if (!withinAttributionWindow(prof[0]?.created_at ?? null, paidAt, config.attributionWindowDays)) {
    return { reason: "outside_attribution_window" };
  }

  // Solo un affiliato ISCRITTO e attivo guadagna: `referred_by` alla
  // registrazione passa solo la regex, non l'iscrizione al programma.
  // `code` è salvato maiuscolo (CHECK nella migration): match esatto sull'indice.
  const aff = await dbQueryStrict<{ id: number | string; identifier: string }>(
    `SELECT id, identifier FROM affiliates
      WHERE code = $1 AND status = 'active'
      LIMIT 1`,
    [code]
  );
  const affiliate = aff[0];
  if (!affiliate) return { reason: "not_attributed" };

  const fps = await dbQueryStrict<{ identifier: string; kind: FingerprintKind; value_hash: string; seen_at: string }>(
    `SELECT identifier, kind, value_hash, seen_at::text AS seen_at
       FROM affiliate_payer_fingerprints
      WHERE identifier = $1 OR identifier = $2`,
    [affiliate.identifier, referred]
  );
  const of = (who: string): Fingerprint[] =>
    fps
      .filter((f) => f.identifier === who)
      .map((f) => ({ kind: f.kind, valueHash: f.value_hash, seenAt: f.seen_at }));

  const verdict = selfReferralCheck(
    { identifier: affiliate.identifier, fingerprints: of(affiliate.identifier) },
    { identifier: referred, fingerprints: of(referred) }
  );

  // La PK su referred_identifier è il lock: chi perde la corsa non scrive, e si
  // rilegge la riga del vincitore.
  await dbExecute(
    `INSERT INTO affiliate_attributions
       (referred_identifier, affiliate_id, source, attributed_at, status, status_reason)
     VALUES ($1, $2, 'signup_ref', NOW(), $3, $4)
     ON CONFLICT (referred_identifier) DO NOTHING`,
    [referred, Number(affiliate.id), verdict.status, verdict.reason]
  );
  const row = await readAttribution(referred);
  return row ? { attribution: row } : { reason: "not_attributed" };
}

async function paymentRecorded(rail: AffiliateRail, ref: string): Promise<boolean> {
  const rows = await dbQueryStrict<{ n: number | string }>(
    `SELECT COUNT(*)::int AS n FROM affiliate_commissions
      WHERE rail = $1 AND rail_payment_ref = $2 AND kind IN ('first','renewal')`,
    [rail, ref]
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

/** Pagamenti di piano del referito ANTERIORI all'attribuzione, fuori dal
 *  ledger: un cliente che pagava già prima del programma non è al «primo
 *  acquisto», e il suo prossimo pagamento è un rinnovo al 7%, non un 20%.
 *  Stabile nel tempo: dopo `attributed_at` ogni pagamento finisce nel ledger.
 *  Il pagamento corrente si esclude per ref (il suo grant precede di poco la
 *  creazione dell'attribuzione).
 *  Rail contati: paygate_orders (anche crypto), paypal_orders e shopify_events
 *  concessi — escluse le righe `crypto-paygate` (specchio di un ordine PayGate
 *  già contato) e le Weekly Pick. Stripe non ha una tabella ordini locale: i suoi
 *  pagamenti storici non si vedono (rail non ancora live). */
async function historicPayments(referred: string, attributedAtISO: string, currentRef: string): Promise<number> {
  const rows = await dbQueryStrict<{ n: number | string }>(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT id::text AS ref, granted_at AS ts FROM paygate_orders
        WHERE LOWER(TRIM(identifier)) = $1 AND granted_at IS NOT NULL
       UNION ALL
       SELECT id::text AS ref, granted_at AS ts FROM paypal_orders
        WHERE LOWER(TRIM(identifier)) = $1 AND granted_at IS NOT NULL
       UNION ALL
       SELECT event_id AS ref, processed_at AS ts FROM shopify_events
        WHERE LOWER(TRIM(identifier)) = $1
          AND event_type = 'orders/paid'
          AND status IN ('granted','granted+weekly','granted-partial')
     ) h
     WHERE h.ts < $2::timestamptz AND h.ref <> $3`,
    [referred, attributedAtISO, currentRef]
  );
  return Number(rows[0]?.n ?? 0);
}

async function ledgerPayments(referred: string): Promise<number> {
  const rows = await dbQueryStrict<{ n: number | string }>(
    `SELECT COUNT(*)::int AS n FROM affiliate_commissions
      WHERE referred_identifier = $1 AND kind IN ('first','renewal')`,
    [referred]
  );
  return Number(rows[0]?.n ?? 0);
}

async function record(input: RecordCommissionInput, config: AffiliateConfig): Promise<LedgerOutcome> {
  const referred = (input.identifier ?? "").trim().toLowerCase();
  const ref = String(input.paymentRef ?? "").trim();
  if (!referred || !ref) return { written: false, reason: "missing_identifier_or_ref" };
  const tag = referredTag(referred);

  const resolved = await resolveAttribution(referred, input.paidAt, config);
  if ("reason" in resolved) return { written: false, reason: resolved.reason };
  const attribution = resolved.attribution;
  if (attribution.status === "self_referral" || attribution.status === "void") {
    return { written: false, reason: `attribution_${attribution.status}` };
  }

  const net = netAmount(input.rail, input.grossUsd, input.meta);
  if (net == null) {
    // Mai una commissione su un importo inventato: si lascia la traccia e basta.
    console.log(`[affiliate] unresolved: importo non determinabile rail=${input.rail} ref=${ref} referred#${tag}`);
    return { written: false, reason: "net_unresolved" };
  }

  if (await paymentRecorded(input.rail, ref)) return { written: false, reason: "duplicate" };

  const historic = await historicPayments(referred, attribution.attributed_at, ref);

  for (let attempt = 0; attempt < MAX_INDEX_ATTEMPTS; attempt++) {
    const renewalIndex = historic + (await ledgerPayments(referred));
    const d = decideCommission({
      mode: config.mode,
      config,
      attributionStatus: attribution.status,
      renewalIndex,
      netUsd: net,
      paidAt: input.paidAt,
    });
    if (!d.write) return { written: false, reason: d.reason };

    await dbExecute(
      `INSERT INTO affiliate_commissions
         (affiliate_id, referred_identifier, rail, rail_payment_ref, kind,
          gross_usd, net_usd, rate, amount_usd, renewal_index, status,
          paid_at, payable_after)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, $13::timestamptz)
       ON CONFLICT DO NOTHING`,
      [
        Number(attribution.affiliate_id),
        referred,
        input.rail,
        ref,
        d.kind,
        round2(Number(input.grossUsd)),
        net,
        d.rate,
        d.amountUsd,
        renewalIndex,
        d.status,
        input.paidAt.toISOString(),
        d.payableAfterISO,
      ]
    );
    // exec_sql non riporta il rowcount: si verifica rileggendo. Assente = la
    // riga è stata respinta dal vincolo (referred, renewal_index), cioè un altro
    // pagamento dello stesso referito ha preso quell'indice: si ricalcola.
    if (await paymentRecorded(input.rail, ref)) {
      console.log(
        `[affiliate] ${d.status} ${d.kind} rail=${input.rail} ref=${ref} referred#${tag} index=${renewalIndex} net=${net} amount=${d.amountUsd}`
      );
      return { written: true, reason: d.status };
    }
  }
  console.error(`[affiliate] renewal_index conteso oltre ${MAX_INDEX_ATTEMPTS} tentativi rail=${input.rail} ref=${ref} referred#${tag}`);
  return { written: false, reason: "index_contention" };
}

export async function recordAffiliateCommissionSafe(input: RecordCommissionInput): Promise<LedgerOutcome> {
  try {
    const config = affiliateConfig();
    if (config.mode === "off") return { written: false, reason: "mode_off" };
    return await record(input, config);
  } catch (e) {
    console.error(
      `[affiliate] ledger fallito rail=${String(input?.rail)} ref=${String(input?.paymentRef)}:`,
      String(e)
    );
    return { written: false, reason: "error" };
  }
}

/** Il punto d'ingresso dei rail: registra la commissione DOPO la risposta.
 *  Sincrona e non lancia mai. Con AFFILIATE_MODE=off non registra nemmeno il
 *  callback. Fuori da uno scope di richiesta Next (script, test) `after()`
 *  lancia: lì si esegue comunque, in fire-and-forget, senza bloccare. */
export function scheduleAffiliateCommission(input: RecordCommissionInput): void {
  try {
    if (affiliateMode() === "off") return;
  } catch {
    return;
  }
  const run = () => recordAffiliateCommissionSafe(input);
  try {
    after(run);
  } catch {
    void run();
  }
}
