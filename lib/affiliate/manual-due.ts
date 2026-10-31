// lib/affiliate/manual-due.ts — #CREATOR-OFFERS-1031
// Quanto spetta a un creator in un mese: fisso (se i contenuti sono confermati)
// + bonus (al 3° mese dell'offerta) + commissioni % (solo se payout_channel =
// 'manual': altrimenti le paga la coda USDT). Il sistema CALCOLA E MOSTRA, non
// paga: il pagamento è Shopify / crypto fuori piattaforma.
//
// Regole (decise qui, dichiarate nella PR):
//  · periodo = mese UTC 'YYYY-MM'. L'offerta del mese = l'ultima (per
//    valid_from) che si sovrappone al mese.
//  · fisso: 'monthly' → uno slot 'YYYY-MM'; 'biweekly' → due slot 'YYYY-MM-1'
//    (1–15) e 'YYYY-MM-2' (16–fine), ognuno col suo minimo di contenuti; 'once'
//    → dovuto nel primo mese (da valid_from) in cui i contenuti sono confermati.
//    Conferme = righe `deliverables_confirmed` in affiliate_admin_actions,
//    sommate per slot. Nessun minimo ({}) = nessuna condizione.
//  · bonus: mese 1 = mese della PRIMA offerta del creator (cambiare offerta non
//    azzera il conteggio). Pagante del mese = referito con somma netta > 0 delle
//    sue righe (stornate incluse) pagate in quel mese: stessa misura di
//    payingReferredSql. Valutato solo nel mese 3. 'month3' = paganti del mese 3,
//    'avg_months_1_3' = media dei mesi 1–3. Scaglioni: il più alto raggiunto.
//  · commissioni: saldo `payable` (maturate dopo l'hold, come la coda USDT) —
//    è un SALDO, non un importo del mese: si azzera solo quando le righe
//    cambiano stato (registrazione del pagamento manuale: non ancora in scope).

import { dbQueryStrict } from "@/lib/db";
import { round2 } from "./net";
import { affiliateMode } from "./config";
import { offersOf, type AffiliateOffer, type BonusRule, type FixedPeriod } from "./offers";

export type Confirmation = { slot: string; counts: Record<string, number> };

export type ManualDueInput = {
  affiliateId: number;
  period: string;
  payoutChannel: "crypto" | "manual";
  offers: AffiliateOffer[];
  confirmations: Confirmation[];
  /** Paganti per mese 'YYYY-MM' (assente = 0). */
  payersByMonth: Record<string, number>;
  payableBalanceUsd: number;
  accruedInPeriodUsd: number;
};

export type FixedSlot = { slot: string; required: Record<string, number>; confirmed: Record<string, number>; met: boolean; usd: number };

export type ManualDue = {
  affiliate_id: number;
  period: string;
  payout_channel: "crypto" | "manual";
  offer_id: number | null;
  fixed: { period: FixedPeriod | null; usd_each: number; slots: FixedSlot[]; total_usd: number };
  bonus: {
    rule: BonusRule;
    start_month: string;
    month_index: number;
    payers: { month: string; payers: number }[];
    value: number;
    evaluated: boolean;
    reached: boolean;
    usd: number;
  } | null;
  commissions: { included: boolean; payable_balance_usd: number; accrued_in_period_usd: number };
  total_usd: number;
};

const PERIOD = /^(20[2-9][0-9])-(0[1-9]|1[0-2])$/;

export function parsePeriod(raw: string | null | undefined): string | null {
  const p = (raw ?? "").trim();
  return PERIOD.test(p) ? p : null;
}

const monthOf = (iso: string) => new Date(iso).toISOString().slice(0, 7);
const monthStart = (p: string) => new Date(`${p}-01T00:00:00Z`);
function addMonths(p: string, n: number): string {
  const d = monthStart(p);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}
function monthDiff(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/** L'offerta del mese: l'ultima per valid_from che si sovrappone al mese. */
export function offerForPeriod(offers: AffiliateOffer[], period: string): AffiliateOffer | null {
  const start = monthStart(period).getTime();
  const end = monthStart(addMonths(period, 1)).getTime();
  const hit = offers.filter((o) => {
    const from = new Date(o.validFrom).getTime();
    const to = o.validTo ? new Date(o.validTo).getTime() : Infinity;
    return from < end && to > start;
  });
  hit.sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());
  return hit[0] ?? null;
}

function confirmedFor(confirmations: Confirmation[], slot: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of confirmations) {
    if (c.slot !== slot) continue;
    for (const [k, n] of Object.entries(c.counts ?? {})) {
      if (Number.isFinite(n) && n > 0) out[k] = (out[k] ?? 0) + n;
    }
  }
  return out;
}

const meets = (required: Record<string, number>, confirmed: Record<string, number>) =>
  Object.entries(required).every(([k, n]) => (confirmed[k] ?? 0) >= n);

function fixedPart(offer: AffiliateOffer | null, period: string, confirmations: Confirmation[]): ManualDue["fixed"] {
  if (!offer || !(offer.fixedUsd > 0) || !offer.fixedPeriod) {
    return { period: offer?.fixedPeriod ?? null, usd_each: offer?.fixedUsd ?? 0, slots: [], total_usd: 0 };
  }
  const required = offer.fixedMinDeliverables ?? {};
  const slot = (name: string, eligible = true): FixedSlot => {
    const confirmed = confirmedFor(confirmations, name);
    const met = eligible && meets(required, confirmed);
    return { slot: name, required, confirmed, met, usd: met ? offer.fixedUsd : 0 };
  };
  let slots: FixedSlot[];
  if (offer.fixedPeriod === "monthly") slots = [slot(period)];
  else if (offer.fixedPeriod === "biweekly") slots = [slot(`${period}-1`), slot(`${period}-2`)];
  else {
    // 'once': dovuto solo nel PRIMO mese (da valid_from) con i contenuti confermati.
    const firstMonth = monthOf(offer.validFrom);
    let alreadyMet = false;
    for (let m = firstMonth; monthDiff(m, period) > 0; m = addMonths(m, 1)) {
      if (meets(required, confirmedFor(confirmations, m))) {
        alreadyMet = true;
        break;
      }
    }
    slots = [slot(period, monthDiff(firstMonth, period) >= 0 && !alreadyMet)];
  }
  return { period: offer.fixedPeriod, usd_each: offer.fixedUsd, slots, total_usd: round2(slots.reduce((s, x) => s + x.usd, 0)) };
}

/** Il premio per un valore di paganti: soglia unica o lo scaglione più alto raggiunto. */
export function bonusFor(rule: BonusRule, value: number): number {
  if (rule.type === "threshold") return value >= rule.min_payers ? rule.usd : 0;
  let usd = 0;
  for (const t of rule.tiers) if (value >= t.min_payers) usd = t.usd;
  return usd;
}

function bonusPart(offer: AffiliateOffer | null, offers: AffiliateOffer[], period: string, payersByMonth: Record<string, number>): ManualDue["bonus"] {
  if (!offer?.bonusRule || offers.length === 0) return null;
  const startMonth = offers.map((o) => monthOf(o.validFrom)).sort()[0];
  const monthIndex = monthDiff(startMonth, period) + 1;
  const payers = [0, 1, 2].map((i) => {
    const month = addMonths(startMonth, i);
    return { month, payers: payersByMonth[month] ?? 0 };
  });
  const value =
    offer.bonusRule.metric === "month3"
      ? payers[2].payers
      : round2(payers.reduce((s, p) => s + p.payers, 0) / payers.length);
  const evaluated = monthIndex === 3;
  const prize = bonusFor(offer.bonusRule, value);
  return {
    rule: offer.bonusRule,
    start_month: startMonth,
    month_index: monthIndex,
    payers,
    value,
    evaluated,
    reached: prize > 0,
    usd: evaluated ? prize : 0,
  };
}

/** Pura: tutto il calcolo, dai dati già letti. */
export function computeManualDue(i: ManualDueInput): ManualDue {
  const offer = offerForPeriod(i.offers, i.period);
  const fixed = fixedPart(offer, i.period, i.confirmations);
  const bonus = bonusPart(offer, i.offers, i.period, i.payersByMonth);
  const included = i.payoutChannel === "manual";
  const commissions = {
    included,
    payable_balance_usd: round2(i.payableBalanceUsd),
    accrued_in_period_usd: round2(i.accruedInPeriodUsd),
  };
  return {
    affiliate_id: i.affiliateId,
    period: i.period,
    payout_channel: i.payoutChannel,
    offer_id: offer?.id ?? null,
    fixed,
    bonus,
    commissions,
    total_usd: round2(fixed.total_usd + (bonus?.usd ?? 0) + (included ? commissions.payable_balance_usd : 0)),
  };
}

// ── DB ───────────────────────────────────────────────────────────────────────


/** Quanto spetta al creator `affiliateId` nel mese `period` ('YYYY-MM'); null se l'affiliato non esiste. */
export async function dovutoManuale(affiliateId: number, period: string): Promise<ManualDue | null> {
  const p = parsePeriod(period);
  if (!p) throw new Error(`dovutoManuale: periodo non valido ${period}`);
  const aff = await dbQueryStrict<{ payout_channel: "crypto" | "manual" }>(
    `SELECT payout_channel FROM affiliates WHERE id = $1`,
    [affiliateId]
  );
  if (!aff[0]) return null;
  const offers = await offersOf(affiliateId);
  const conf = await dbQueryStrict<{ detail: { slot?: string; counts?: Record<string, number> } }>(
    `SELECT detail FROM affiliate_admin_actions WHERE affiliate_id = $1 AND action = 'deliverables_confirmed' ORDER BY id`,
    [affiliateId]
  );
  // Gli stessi stati di payingReferredSql (lib/affiliate/tiers.ts): in shadow anche le righe shadow ($4).
  const shadow = affiliateMode() === "shadow";
  const payersByMonth: Record<string, number> = {};
  if (offers.length > 0) {
    const start = offers.map((o) => monthOf(o.validFrom)).sort()[0];
    const rows = await dbQueryStrict<{ month: string; payers: number | string }>(
      `SELECT to_char(m, 'YYYY-MM') AS month, COUNT(*)::int AS payers FROM (
         SELECT date_trunc('month', paid_at AT TIME ZONE 'UTC') AS m, referred_identifier
           FROM affiliate_commissions
          WHERE affiliate_id = $1 AND (status IN ('pending','payable','in_payout','paid') OR ($4 AND status = 'shadow'))
            AND paid_at >= $2::timestamptz AND paid_at < $3::timestamptz
          GROUP BY 1, 2
         HAVING SUM(amount_usd) > 0
       ) x GROUP BY m`,
      [affiliateId, monthStart(start).toISOString(), monthStart(addMonths(start, 3)).toISOString(), shadow]
    );
    for (const r of rows) payersByMonth[r.month] = Number(r.payers);
  }
  const sums = await dbQueryStrict<{ payable: number | string | null; accrued: number | string | null }>(
    `SELECT (SELECT SUM(amount_usd) FROM affiliate_commissions WHERE affiliate_id = $1 AND status = 'payable') AS payable,
            (SELECT SUM(amount_usd) FROM affiliate_commissions WHERE affiliate_id = $1
                AND (status IN ('pending','payable','in_payout','paid') OR ($4 AND status = 'shadow'))
                AND paid_at >= $2::timestamptz AND paid_at < $3::timestamptz) AS accrued`,
    [affiliateId, monthStart(p).toISOString(), monthStart(addMonths(p, 1)).toISOString(), shadow]
  );
  return computeManualDue({
    affiliateId,
    period: p,
    payoutChannel: aff[0].payout_channel,
    offers,
    confirmations: conf
      .filter((c) => typeof c.detail?.slot === "string")
      .map((c) => ({ slot: c.detail.slot as string, counts: c.detail.counts ?? {} })),
    payersByMonth,
    payableBalanceUsd: Number(sums[0]?.payable ?? 0),
    accruedInPeriodUsd: Number(sums[0]?.accrued ?? 0),
  });
}
