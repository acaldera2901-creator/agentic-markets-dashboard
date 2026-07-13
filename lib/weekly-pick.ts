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
  // #WEEKLY-PICK-4: kickoff ISO della leg — serve alla distribuzione settimanale
  // (max 1 leg/giorno). Opzionale per retro-compatibilità: selections salvate e
  // candidate senza data seguono il comportamento legacy (pool top-prob).
  startsAt?: string | null;
};

// Lunedì 00:00 UTC della settimana che contiene `now`, come "YYYY-MM-DD". PURA.
// (la weekly pick è unica per settimana; questa è la chiave.)
export function currentWeekStart(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const deltaToMonday = (d.getUTCDay() + 6) % 7; // Dom=0..Sab=6 → Lun=0
  d.setUTCDate(d.getUTCDate() - deltaToMonday);
  return d.toISOString().slice(0, 10);
}

// Costruisce la multipla della casa. #WEEKLY-PICK-4 ("la schedina dura tutta la
// settimana", Andrea 2026-07-13): il solo criterio top-prob concentrava le leg sui
// match IMMINENTI (le prob alte sono quasi sempre a 1-2 giorni) e la schedina
// moriva in 24h. Ora: MAX 1 LEG PER GIORNO (giorno UTC di startsAt) — per ogni
// giorno vince la prob più alta, poi si tengono i migliori `maxLegs` giorni; se i
// giorni distinti non bastano si riempie dal pool residuo (comportamento legacy,
// che copre anche le candidate senza startsAt). Selections in ordine cronologico.
// Deterministica (tie-break stabile per id). Null se <2 candidate valide. PURA.
export function buildHouseMultipla(
  items: WeeklyPickLeg[],
  maxLegs: number = WEEKLY_PICK_MAX_LEGS
): { selections: WeeklyPickLeg[]; combinedProb: number } | null {
  const valid = items.filter(
    (i) => i.id && i.label && i.market && Number.isFinite(i.prob) && i.prob > 0 && i.prob <= 1
  );
  if (valid.length < 2) return null;
  const byProb = (a: WeeklyPickLeg, b: WeeklyPickLeg) =>
    b.prob - a.prob || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  // 1 vincitore per giorno; il resto (incluse le leg senza data) va in riserva.
  const dayBest = new Map<string, WeeklyPickLeg>();
  const reserve: WeeklyPickLeg[] = [];
  for (const i of [...valid].sort(byProb)) {
    const day = i.startsAt ? i.startsAt.slice(0, 10) : null;
    if (day && !dayBest.has(day)) dayBest.set(day, i);
    else reserve.push(i);
  }
  const legs = Math.max(2, Math.min(maxLegs, valid.length));
  const selections = [...dayBest.values()].sort(byProb).slice(0, legs);
  for (const r of reserve) {
    if (selections.length >= legs) break;
    selections.push(r); // fill: meglio una multipla piena che giorni-only sotto target
  }

  // Lettura cronologica della settimana (leg senza data in coda).
  selections.sort((a, b) => {
    const ka = a.startsAt ?? "9999";
    const kb = b.startsAt ?? "9999";
    return ka < kb ? -1 : ka > kb ? 1 : byProb(a, b);
  });
  const combinedProb = selections.reduce((acc, i) => acc * i.prob, 1);
  return { selections, combinedProb };
}

// #WEEKLY-PICK-4 — SCHEDINA PROGRESSIVA. La pipeline predizioni copre ~2 giorni,
// quindi il lunedì la multipla non può nascere già spalmata su tutta la settimana.
// Regola: le leg esistenti sono CONGELATE (mai toccate — qualcuno può averle
// comprate); a ogni giro si APPENDONO nuove leg (la migliore per ogni giorno non
// ancora coperto, candidate non già presenti) finché si arriva a maxLegs. Così la
// schedina vive e cresce lungo la settimana. Ritorna null se non c'è nulla da
// aggiungere. PURA (le leg esistenti vanno passate già arricchite di startsAt).
export function appendWeeklyLegs(
  existing: WeeklyPickLeg[],
  candidates: WeeklyPickLeg[],
  maxLegs: number = WEEKLY_PICK_MAX_LEGS
): { selections: WeeklyPickLeg[]; combinedProb: number } | null {
  if (existing.length >= maxLegs) return null;
  const byProb = (a: WeeklyPickLeg, b: WeeklyPickLeg) =>
    b.prob - a.prob || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const usedIds = new Set(existing.map((l) => l.id));
  const usedDays = new Set(
    existing.map((l) => (l.startsAt ? l.startsAt.slice(0, 10) : null)).filter(Boolean) as string[]
  );
  const added: WeeklyPickLeg[] = [];
  for (const c of [...candidates].sort(byProb)) {
    if (existing.length + added.length >= maxLegs) break;
    if (usedIds.has(c.id)) continue;
    const day = c.startsAt ? c.startsAt.slice(0, 10) : null;
    if (!day || usedDays.has(day)) continue; // solo giorni NUOVI: è ciò che allunga la settimana
    usedDays.add(day);
    usedIds.add(c.id);
    added.push(c);
  }
  if (added.length === 0) return null;
  const selections = [...existing, ...added].sort((a, b) => {
    const ka = a.startsAt ?? "9999";
    const kb = b.startsAt ?? "9999";
    return ka < kb ? -1 : ka > kb ? 1 : byProb(a, b);
  });
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

// #WEEKLY-PICK-2. Dati del brief settimanale (aggregati). NON produce testo: la UI
// compone la frase multilingua dai campi (nessuna frase qui). Null-safe: col teaser
// lockato prob/market sono null → strongest null; la combinata la passa il chiamante
// (null quando nascosta). Tie-break stabile per label così, a pari prob, lo strongest
// è deterministico. PURA/testabile.
export type WeeklyBrief = {
  legs: number;
  competitions: number; // # sport distinti (proxy competizione in Fase 1)
  combinedProb: number | null;
  avgConfidence: number | null; // 0..100
  strongest: { label: string; market: string; prob: number } | null;
};

export function weeklyBrief(
  legs: Array<{ label: string; sport: string; market: string | null; prob: number | null }>,
  combinedProb: number | null,
  confidences: number[]
): WeeklyBrief {
  const competitions = new Set(legs.map((l) => l.sport)).size;
  const withProb = legs.filter(
    (l): l is { label: string; sport: string; market: string; prob: number } =>
      typeof l.prob === "number" && Number.isFinite(l.prob) && typeof l.market === "string"
  );
  const strongest = withProb.length
    ? withProb.reduce((best, l) =>
        l.prob > best.prob || (l.prob === best.prob && l.label < best.label) ? l : best
      )
    : null;
  const avgConfidence = confidences.length
    ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
    : null;
  return {
    legs: legs.length,
    competitions,
    combinedProb: combinedProb ?? null,
    avgConfidence,
    strongest: strongest ? { label: strongest.label, market: strongest.market, prob: strongest.prob } : null,
  };
}
