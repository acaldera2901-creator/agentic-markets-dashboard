// lib/affiliate/offers.ts — #CREATOR-OFFERS-1031
// L'offerta economica di un singolo creator (migration 20261101120000):
// tassi propri sul primo acquisto (mensile / annuale), rinnovi opzionali, fisso
// e bonus. Il ledger legge l'offerta in vigore ALLA DATA DEL PAGAMENTO
// (`offerFor(id, paidAt)`), così un ricalcolo tardivo dà lo stesso tasso.
// Nessuna offerta = config env invariata (`applyOffer(config, null)` = config).
// Fisso e bonus non entrano mai nel ledger: li calcola manual-due.ts.

import { dbQueryStrict } from "@/lib/db";
import { resolveOrderFromVariant } from "@/lib/shopify";
import type { AffiliateConfig } from "./config";
import type { AffiliateRail } from "./net";
import { effectiveTiers, type TierStep } from "./tiers";

export type FixedPeriod = "biweekly" | "monthly" | "once";
export type BonusMetric = "month3" | "avg_months_1_3";
export type BonusRule =
  | { type: "threshold"; min_payers: number; usd: number; metric: BonusMetric }
  | { type: "tiers"; tiers: { min_payers: number; usd: number }[]; metric: BonusMetric };

export type AffiliateOffer = {
  id: number;
  affiliateId: number;
  validFrom: string;
  validTo: string | null;
  firstRateMonthly: number | null;
  firstRateAnnual: number | null;
  renewalRate: number | null;
  renewalTiers: TierStep[] | null;
  fixedUsd: number;
  fixedPeriod: FixedPeriod | null;
  fixedMinDeliverables: Record<string, number>;
  bonusRule: BonusRule | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
};

export type PurchasePeriod = "monthly" | "annual" | null;

// ── Applicazione al ledger (pura) ────────────────────────────────────────────

/** La config del ledger con i campi non-NULL dell'offerta. Periodo ignoto
 *  (es. Stripe, nessuna tabella ordini locale) → il MINORE dei due tassi sul
 *  primo acquisto: una commissione scritta è immutabile, meglio non pagare
 *  troppo che dover stornare. */
export function applyOffer(config: AffiliateConfig, offer: AffiliateOffer | null, period: PurchasePeriod): AffiliateConfig {
  if (!offer) return config;
  const monthly = offer.firstRateMonthly ?? config.firstRate;
  const annual = offer.firstRateAnnual ?? config.firstRate;
  const firstRate = period === "annual" ? annual : period === "monthly" ? monthly : Math.min(monthly, annual);
  const renewalRate = offer.renewalRate ?? config.renewalRate;
  return {
    ...config,
    firstRate,
    renewalRate,
    renewalTiers: effectiveTiers(offer.renewalTiers ?? config.renewalTiers, renewalRate),
  };
}

/** Serve sapere mensile/annuale solo se l'offerta li distingue davvero. */
export function offerNeedsPeriod(offer: AffiliateOffer): boolean {
  return (offer.firstRateMonthly ?? null) !== (offer.firstRateAnnual ?? null);
}

// ── Input admin (puro) ───────────────────────────────────────────────────────

export type OfferInput = {
  valid_from: string | null;
  first_rate_monthly: number | null;
  first_rate_annual: number | null;
  renewal_rate: number | null;
  renewal_tiers: TierStep[] | null;
  fixed_usd: number;
  fixed_period: FixedPeriod | null;
  fixed_min_deliverables: Record<string, number>;
  bonus_rule: BonusRule | null;
  note: string | null;
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const decimals = (n: number, max: number) => Number(n.toFixed(max)) === n;
const posInt = (v: unknown, max = 100_000): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= max;
const usdOk = (v: unknown, min: number): v is number => isNum(v) && v >= min && v <= 1_000_000 && decimals(v, 2);

function rateOrNull(v: unknown): number | null | undefined {
  if (v == null) return null;
  return isNum(v) && v >= 0 && v <= 1 && decimals(v, 4) ? v : undefined;
}

function parseBonus(v: unknown): BonusRule | null | undefined {
  if (v == null) return null;
  if (typeof v !== "object" || Array.isArray(v)) return undefined;
  const b = v as Record<string, unknown>;
  if (b.metric !== "month3" && b.metric !== "avg_months_1_3") return undefined;
  const metric = b.metric;
  if (b.type === "threshold") {
    return posInt(b.min_payers) && usdOk(b.usd, 0.01) ? { type: "threshold", min_payers: b.min_payers, usd: b.usd, metric } : undefined;
  }
  if (b.type === "tiers") {
    if (!Array.isArray(b.tiers) || b.tiers.length === 0 || b.tiers.length > 10) return undefined;
    const tiers: { min_payers: number; usd: number }[] = [];
    for (const t of b.tiers as unknown[]) {
      const s = (t ?? {}) as Record<string, unknown>;
      if (!posInt(s.min_payers) || !usdOk(s.usd, 0.01)) return undefined;
      const prev = tiers[tiers.length - 1];
      // Scaglioni crescenti in soglia E in premio: uno incoerente non si indovina.
      if (prev && (s.min_payers <= prev.min_payers || s.usd <= prev.usd)) return undefined;
      tiers.push({ min_payers: s.min_payers, usd: s.usd });
    }
    return { type: "tiers", tiers, metric };
  }
  return undefined;
}

function parseRenewalTiers(v: unknown): TierStep[] | null | undefined {
  if (v == null) return null;
  if (!Array.isArray(v) || v.length > 10) return undefined;
  const out: TierStep[] = [];
  for (const t of v as unknown[]) {
    const s = (t ?? {}) as Record<string, unknown>;
    const rate = rateOrNull(s.rate);
    if (!posInt(s.min) || rate == null) return undefined;
    const prev = out[out.length - 1];
    if (prev && (s.min <= prev.min || rate <= prev.rate)) return undefined;
    out.push({ min: s.min, rate });
  }
  return out;
}

function parseDeliverables(v: unknown): Record<string, number> | undefined {
  if (v == null) return {};
  if (typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(k) || !Number.isInteger(n) || (n as number) < 0 || (n as number) > 1000) return undefined;
    out[k] = n as number;
  }
  return Object.keys(out).length <= 20 ? out : undefined;
}

/** Valida il corpo dell'offerta. `{ error }` col nome del primo campo invalido. */
export function parseOfferInput(raw: unknown): { offer: OfferInput } | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "invalid_offer" };
  const o = raw as Record<string, unknown>;
  const first_rate_monthly = rateOrNull(o.first_rate_monthly);
  if (first_rate_monthly === undefined) return { error: "invalid_first_rate_monthly" };
  const first_rate_annual = rateOrNull(o.first_rate_annual);
  if (first_rate_annual === undefined) return { error: "invalid_first_rate_annual" };
  const renewal_rate = rateOrNull(o.renewal_rate);
  if (renewal_rate === undefined) return { error: "invalid_renewal_rate" };
  const renewal_tiers = parseRenewalTiers(o.renewal_tiers);
  if (renewal_tiers === undefined) return { error: "invalid_renewal_tiers" };
  const fixed_usd = o.fixed_usd == null ? 0 : o.fixed_usd;
  if (!usdOk(fixed_usd, 0)) return { error: "invalid_fixed_usd" };
  const fp = o.fixed_period ?? null;
  if (fp !== null && fp !== "biweekly" && fp !== "monthly" && fp !== "once") return { error: "invalid_fixed_period" };
  if (fixed_usd > 0 && fp === null) return { error: "fixed_period_required" };
  const fixed_min_deliverables = parseDeliverables(o.fixed_min_deliverables);
  if (fixed_min_deliverables === undefined) return { error: "invalid_fixed_min_deliverables" };
  const bonus_rule = parseBonus(o.bonus_rule);
  if (bonus_rule === undefined) return { error: "invalid_bonus_rule" };
  let valid_from: string | null = null;
  if (o.valid_from != null) {
    const t = typeof o.valid_from === "string" ? Date.parse(o.valid_from) : NaN;
    if (Number.isNaN(t)) return { error: "invalid_valid_from" };
    valid_from = new Date(t).toISOString();
  }
  const note = o.note == null ? null : typeof o.note === "string" && o.note.trim().length <= 500 ? o.note.trim() || null : undefined;
  if (note === undefined) return { error: "invalid_note" };
  return {
    offer: {
      valid_from,
      first_rate_monthly,
      first_rate_annual,
      renewal_rate,
      renewal_tiers,
      fixed_usd,
      fixed_period: fp as FixedPeriod | null,
      fixed_min_deliverables,
      bonus_rule,
      note,
    },
  };
}

// ── DB ───────────────────────────────────────────────────────────────────────

type OfferRow = {
  id: number | string;
  affiliate_id: number | string;
  valid_from: string;
  valid_to: string | null;
  first_rate_monthly: number | string | null;
  first_rate_annual: number | string | null;
  renewal_rate: number | string | null;
  renewal_tiers: TierStep[] | null;
  fixed_usd: number | string;
  fixed_period: FixedPeriod | null;
  fixed_min_deliverables: Record<string, number> | null;
  bonus_rule: BonusRule | null;
  note: string | null;
  created_by: string;
  created_at: string;
};

const numOrNull = (v: number | string | null) => (v == null ? null : Number(v));

export function offerFromRow(r: OfferRow): AffiliateOffer {
  return {
    id: Number(r.id),
    affiliateId: Number(r.affiliate_id),
    validFrom: r.valid_from,
    validTo: r.valid_to,
    firstRateMonthly: numOrNull(r.first_rate_monthly),
    firstRateAnnual: numOrNull(r.first_rate_annual),
    renewalRate: numOrNull(r.renewal_rate),
    renewalTiers: r.renewal_tiers ?? null,
    fixedUsd: Number(r.fixed_usd),
    fixedPeriod: r.fixed_period,
    fixedMinDeliverables: r.fixed_min_deliverables ?? {},
    bonusRule: r.bonus_rule ?? null,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

/** L'offerta in vigore all'istante `at`, o null. Fail-loud: senza sapere se c'è
 *  un'offerta il ledger non deve scrivere una commissione (che è immutabile). */
export async function offerFor(affiliateId: number, at: Date): Promise<AffiliateOffer | null> {
  const rows = await dbQueryStrict<OfferRow>(
    `SELECT * FROM affiliate_offers
      WHERE affiliate_id = $1 AND valid_from <= $2::timestamptz
        AND (valid_to IS NULL OR $2::timestamptz < valid_to)
      ORDER BY valid_from DESC LIMIT 1`,
    [affiliateId, at.toISOString()]
  );
  return rows[0] ? offerFromRow(rows[0]) : null;
}

export async function offersOf(affiliateId: number): Promise<AffiliateOffer[]> {
  const rows = await dbQueryStrict<OfferRow>(
    `SELECT * FROM affiliate_offers WHERE affiliate_id = $1 ORDER BY valid_from`,
    [affiliateId]
  );
  return rows.map(offerFromRow);
}

/** Mensile o annuale, dall'ordine del rail: paygate_orders (paygate e crypto) e
 *  paypal_orders hanno `period`; Shopify lo ricava dal variant salvato in
 *  shopify_events. Stripe non ha una tabella ordini locale → null. Fail-soft:
 *  un errore qui dà null, cioè il tasso più basso (applyOffer). */
export async function purchasePeriod(rail: AffiliateRail, ref: string): Promise<PurchasePeriod> {
  try {
    if (rail === "paygate" || rail === "crypto" || rail === "paypal") {
      const rows = await dbQueryStrict<{ period: string | null }>(
        rail === "paypal"
          ? `SELECT period FROM paypal_orders WHERE id::text = $1 LIMIT 1`
          : `SELECT period FROM paygate_orders WHERE id::text = $1 LIMIT 1`,
        [ref]
      );
      const p = rows[0]?.period;
      return p === "monthly" || p === "annual" ? p : null;
    }
    if (rail === "shopify") {
      const rows = await dbQueryStrict<{ variant_id: string | null }>(
        `SELECT variant_id FROM shopify_events WHERE event_id = $1 LIMIT 1`,
        [ref]
      );
      return resolveOrderFromVariant(rows[0]?.variant_id)?.period ?? null;
    }
  } catch (e) {
    console.error(`[affiliate/offers] periodo non leggibile rail=${rail} ref=${ref}:`, String(e));
  }
  return null;
}
