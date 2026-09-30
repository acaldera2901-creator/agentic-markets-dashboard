// lib/affiliate/ledger.ts — #AFFILIATE-V2-0930 PR-2
// Scrive UNA riga commissione per ogni incasso attribuibile a un affiliato.
//
// Contratto (lo stesso di checkReferralTiersSafe in lib/plan-grant.ts):
//  · **Non lancia mai.** Il chiamante è un rail di pagamento che ha GIÀ concesso
//    il piano: una commissione mancata si ricostruisce dal log, un pagamento che
//    fallisce per colpa del ledger è un cliente perso.
//  · Si chiama DOPO il grant riuscito, dai CHIAMANTI delle activate*Plan: lì ci
//    sono importo e id ordine, dentro plan-grant.ts no.
//  · AFFILIATE_MODE=off (il default) → no-op totale: ritorna prima di qualsiasi
//    query.
//  · shadow → calcola e scrive righe `status='shadow'`: non maturano, non si
//    pagano, non si convertono mai (decisione D10). live → righe `pending`.
//
// Idempotenza: la garantisce il DB. `uq_affiliate_commissions_one_positive_per_payment`
// (una sola riga positiva per rail+pagamento) + `UNIQUE (rail, rail_payment_ref,
// kind)`, con INSERT … ON CONFLICT DO NOTHING. La redelivery di un webhook, la
// doppia strada PayPal capture+webhook o un giro di reconcile non scrivono due
// volte. Il pre-check qui sotto evita solo lavoro inutile, non è il lock.

import { dbQueryStrict, dbExecute } from "@/lib/db";
import { affiliateConfig, type AffiliateConfig, type AffiliateMode } from "./config";
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

/** La decisione, pura: tasso, cap dei rinnovi, stato, hold. */
export function decideCommission(opts: {
  mode: AffiliateMode;
  config: Pick<AffiliateConfig, "firstRate" | "renewalRate" | "renewalMaxMonths" | "holdDays">;
  attributionStatus: AttributionStatus;
  /** Righe first|renewal già presenti per il referito: 0 = primo acquisto. */
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

type AttributionRow = { affiliate_id: number | string; status: AttributionStatus };

async function readAttribution(referred: string): Promise<AttributionRow | null> {
  const rows = await dbQueryStrict<AttributionRow>(
    `SELECT affiliate_id, status FROM affiliate_attributions
      WHERE referred_identifier = $1
      LIMIT 1`,
    [referred]
  );
  return rows[0] ?? null;
}

/** L'attribuzione congelata del referito. Alla prima conversione la crea da
 *  `profiles.referred_by` (first-touch, scritto alla registrazione) e la passa
 *  dall'anti-self-referral. Dopo, non rilegge più `referred_by`. */
async function resolveAttribution(referred: string): Promise<AttributionRow | null> {
  const frozen = await readAttribution(referred);
  if (frozen) return frozen;

  const prof = await dbQueryStrict<{ referred_by: string | null }>(
    `SELECT referred_by FROM profiles
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1
      ORDER BY (identifier = $1) DESC
      LIMIT 1`,
    [referred]
  );
  const code = (prof[0]?.referred_by ?? "").trim().toUpperCase();
  if (!code) return null;

  // Solo un affiliato ISCRITTO e attivo guadagna: `referred_by` alla
  // registrazione passa solo la regex, non l'iscrizione al programma.
  const aff = await dbQueryStrict<{ id: number | string; identifier: string }>(
    `SELECT id, identifier FROM affiliates
      WHERE UPPER(code) = $1 AND status = 'active'
      LIMIT 1`,
    [code]
  );
  const affiliate = aff[0];
  if (!affiliate) return null;

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
  return readAttribution(referred);
}

async function record(input: RecordCommissionInput, config: AffiliateConfig): Promise<LedgerOutcome> {
  const referred = (input.identifier ?? "").trim().toLowerCase();
  const ref = String(input.paymentRef ?? "").trim();
  if (!referred || !ref) return { written: false, reason: "missing_identifier_or_ref" };

  const attribution = await resolveAttribution(referred);
  if (!attribution) return { written: false, reason: "not_attributed" };
  if (attribution.status === "self_referral" || attribution.status === "void") {
    return { written: false, reason: `attribution_${attribution.status}` };
  }

  const net = netAmount(input.rail, input.grossUsd, input.meta);
  if (net == null) {
    // Mai una commissione su un importo inventato: si lascia la traccia e basta.
    console.log(
      `[affiliate] unresolved: importo non determinabile rail=${input.rail} ref=${ref} referred=${referred}`
    );
    return { written: false, reason: "net_unresolved" };
  }

  const seen = await dbQueryStrict<{ n: number | string }>(
    `SELECT COUNT(*)::int AS n FROM affiliate_commissions
      WHERE rail = $1 AND rail_payment_ref = $2 AND kind IN ('first','renewal')`,
    [input.rail, ref]
  );
  if (Number(seen[0]?.n ?? 0) > 0) return { written: false, reason: "duplicate" };

  const prior = await dbQueryStrict<{ n: number | string }>(
    `SELECT COUNT(*)::int AS n FROM affiliate_commissions
      WHERE referred_identifier = $1 AND kind IN ('first','renewal')`,
    [referred]
  );
  const renewalIndex = Number(prior[0]?.n ?? 0);

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
  console.log(
    `[affiliate] ${d.status} ${d.kind} rail=${input.rail} ref=${ref} referred=${referred} net=${net} amount=${d.amountUsd}`
  );
  return { written: true, reason: d.status };
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
