// lib/weekly-pick.ts — #WEEKLY-PICK-1 (item 2).
// La "Weekly Pick" è la MULTIPLA DELLA CASA: le migliori pick della settimana
// combinate (schedina più probabile del modello). Venduta one-off a €12.99 a chi
// non è Pro; inclusa nel Pro.
//
// Questo file è la FONDAZIONE PURA (prezzo, flag, settimana corrente, costruzione
// della multipla). Il wiring pagamenti (checkout/callback/grant), il gating e la
// UI sono separati e GATED: nulla qui tocca il DB o attiva la feature finché
// WEEKLY_PICK_ENABLED non è "true" (attivazione al gate, dopo allineamento Michele
// + APPROVE ch_deploy_gate).

import { launchPromoActive, LAUNCH_PROMO_DISCOUNT } from "./paygate";

export const WEEKLY_PICK_PRICE_USD = 12.99;
// Gambe massime nella multipla della casa (min 2 per essere una multipla).
export const WEEKLY_PICK_MAX_LEGS = 5;

// Importo effettivo al checkout della weekly pick (USD, one-off flat: nessun
// piano/periodo). Riusa lo STESSO meccanismo di sconto dei piani — la stessa
// funzione gate launchPromoActive (flag LAUNCH_PROMO_ENABLED + deadline reale) e
// la stessa costante LAUNCH_PROMO_DISCOUNT — così NON esiste un secondo punto di
// verità sullo sconto. A lancio attivo: -50%. Il prezzo lo decide SEMPRE il
// server (mai dal client). PURA/testabile.
// NB: a differenza dei piani, la weekly pick NON gatta sull'"primo ordine
// pagato" (firstPaidOrder): lo sconto vale finché il lancio è attivo, per tutti,
// come da spec. Per limitarlo al primo acquisto basterebbe intersecare con
// promoEligibility() (lib/creator-promo) — one-liner nel checkout.
export function weeklyPickAmount(now?: Date): { amount: number; fullAmount: number; discounted: boolean } {
  const full = WEEKLY_PICK_PRICE_USD;
  if (!launchPromoActive(now)) return { amount: full, fullAmount: full, discounted: false };
  const amount = Math.round(full * (1 - LAUNCH_PROMO_DISCOUNT) * 100) / 100;
  return { amount, fullAmount: full, discounted: true };
}

// Feature spenta di default: col flag OFF il prodotto è inerte (nessun checkout,
// nessuna generazione, nessuna CTA).
export function weeklyPickEnabled(): boolean {
  return process.env.WEEKLY_PICK_ENABLED === "true";
}

// Inclusa nel Pro (premium/admin) → nessun paywall; gli altri la comprano one-off.
export function weeklyPickIncludedInPlan(plan: string): boolean {
  return plan === "premium" || plan === "admin_full";
}

export type WeeklyPickLeg = {
  id: string;
  label: string;
  market: string;
  sport: string;
  prob: number;
};

// Lunedì 00:00 UTC della settimana che contiene `now`, come "YYYY-MM-DD". PURA.
// (la weekly pick è unica per settimana; questa è la chiave.)
export function currentWeekStart(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const deltaToMonday = (d.getUTCDay() + 6) % 7; // Dom=0..Sab=6 → Lun=0
  d.setUTCDate(d.getUTCDate() - deltaToMonday);
  return d.toISOString().slice(0, 10);
}

// Costruisce la multipla della casa: prende le pick a probabilità più alta della
// settimana e le combina (prodotto delle prob). Deterministica (tie-break stabile
// per id). Ritorna null se non ci sono almeno 2 candidate valide. PURA.
export function buildHouseMultipla(
  items: WeeklyPickLeg[],
  maxLegs: number = WEEKLY_PICK_MAX_LEGS
): { selections: WeeklyPickLeg[]; combinedProb: number } | null {
  const valid = items.filter(
    (i) => i.id && i.label && i.market && Number.isFinite(i.prob) && i.prob > 0 && i.prob <= 1
  );
  if (valid.length < 2) return null;
  const sorted = [...valid].sort(
    (a, b) => b.prob - a.prob || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  const legs = Math.max(2, Math.min(maxLegs, sorted.length));
  const selections = sorted.slice(0, legs);
  const combinedProb = selections.reduce((acc, i) => acc * i.prob, 1);
  return { selections, combinedProb };
}

// Stato di una leg risolto contro il settlement della sua predizione.
export type LegStatus = "upcoming" | "won" | "lost" | "void";
// Esito aggregato della multipla nella settimana.
export type MultiplaOutcome = "live" | "won" | "lost";
// Riga minima di unified_predictions necessaria alla risoluzione.
export type PredOutcomeRow = {
  id: string;
  status: string | null;
  result: string | null; // "won" | "lost" | "void" | "pending" | null
  starts_at: string | null;
};
export type ResolvedLeg = WeeklyPickLeg & { status: LegStatus; kickoff: string | null };

// PURA. Mappa ogni leg (id = `wp_<predId>`) allo stato del suo pronostico e deriva
// l'esito aggregato. Regole: `lost` se ≥1 leg persa; altrimenti `live` se ≥1 leg
// ancora da giocare; altrimenti `won`. Una leg il cui predId non ha riga resta
// `upcoming` (mai `lost`): un dato mancante non fa fallire falsamente la multipla.
export function resolveWeeklyPickOutcomes(
  legs: WeeklyPickLeg[],
  predRows: PredOutcomeRow[]
): { legs: ResolvedLeg[]; outcome: MultiplaOutcome; remaining: number } {
  const byId = new Map(predRows.map((r) => [r.id, r]));
  const resolved: ResolvedLeg[] = legs.map((leg) => {
    const predId = leg.id.startsWith("wp_") ? leg.id.slice(3) : leg.id;
    const row = byId.get(predId);
    let status: LegStatus = "upcoming";
    if (row && (row.result === "won" || row.result === "lost" || row.result === "void")) {
      status = row.result;
    }
    return { ...leg, status, kickoff: row?.starts_at ?? null };
  });
  const anyLost = resolved.some((l) => l.status === "lost");
  const remaining = resolved.filter((l) => l.status === "upcoming").length;
  const outcome: MultiplaOutcome = anyLost ? "lost" : remaining > 0 ? "live" : "won";
  return { legs: resolved, outcome, remaining };
}
