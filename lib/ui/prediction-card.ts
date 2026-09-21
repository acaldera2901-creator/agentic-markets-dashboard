// lib/ui/prediction-card.ts — #RESTYLING-0921
//
// La grammatica numerica della PredictionCard, fuori dal JSX così è testabile
// e condivisa da EdgeBadge, ProbabilityComparison, MatchHeader.
//
// Convenzione del prodotto (lib/unified-adapter.ts): l'edge è in PUNTI
// percentuali = probabilità modello − probabilità implicita del mercato, e
// senza un prezzo di mercato reale NON si dichiara un edge (resta «model
// estimate»). La card eredita la regola: marketPct null → edge null → «—».

import { impliedProbability } from "@/lib/betting-math";
import type { UnifiedPrediction } from "@/lib/unified-adapter";

export type EdgeTone = "pos" | "neg" | "flat" | "none";

/** Sotto questo |edge| (pp) il numero è rumore: si mostra neutro, non verde. */
export const EDGE_FLAT_PP = 1;
/** Da qui in su la card si merita il badge «High edge». Allineato a
 *  computeRisk() dell'adapter, dove edge > 4% = rischio basso. */
export const EDGE_HIGH_PP = 5;

export function edgeTone(edgePct: number | null | undefined): EdgeTone {
  if (edgePct == null || !Number.isFinite(edgePct)) return "none";
  if (Math.abs(edgePct) < EDGE_FLAT_PP) return "flat";
  return edgePct > 0 ? "pos" : "neg";
}

/** «+12.0» / «−1.2» (meno tipografico U+2212, non il trattino) / «—». */
export function formatEdge(edgePct: number | null | undefined): string {
  if (edgePct == null || !Number.isFinite(edgePct)) return "—";
  const abs = Math.abs(edgePct).toFixed(1);
  if (edgePct > 0) return `+${abs}`;
  if (edgePct < 0) return `−${abs}`;
  return abs;
}

/** Percentuale intera per la riga MODEL | MARKET: «64». null → «—». */
export function formatPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return String(Math.round(Math.max(0, Math.min(100, pct))));
}

export type PredictionCardData = {
  id: string;
  sport: string;
  league: string | null;
  home: string;
  away: string;
  /** ISO. La card NON lo formatta: il desk ha già il suo formatter con timezone
   *  esplicita (app/app/page.tsx) — passare il testo pronto in kickoffLabel. */
  startsAt: string;
  kickoffLabel?: string | null;
  isLive: boolean;
  liveMinute?: string | number | null;
  pick: string | null;
  market?: string | null;
  modelPct: number | null;
  marketPct: number | null;
  edgePct: number | null;
  confidence?: number | null;
  explanation?: string | null;
  /** Pick riservato a Pro: la card mostra Model/Market, blocca Pick ed Edge. */
  locked?: boolean;
};

function toPct(prob: number | null): number | null {
  return prob == null ? null : prob * 100;
}

/** Adapter UnifiedPrediction → dati della card. Le probabilità vengono dalle
 *  quote (fair_odds = modello, odds = mercato con margine, come fa oggi il
 *  desk); l'edge è edge_percent, già in pp e già null senza mercato. */
export function fromUnifiedPrediction(
  p: UnifiedPrediction,
  extra: { kickoffLabel?: string | null; locked?: boolean } = {},
): PredictionCardData {
  const isTennis = p.sport === "tennis";
  const home = (isTennis ? p.player_one : p.home_team) ?? p.home_team ?? p.player_one ?? "";
  const away = (isTennis ? p.player_two : p.away_team) ?? p.away_team ?? p.player_two ?? "";
  const marketPct = p.odds != null ? toPct(impliedProbability(p.odds)) : null;
  return {
    id: p.id,
    sport: p.sport,
    league: p.league ?? p.competition ?? null,
    home,
    away,
    startsAt: p.starts_at,
    kickoffLabel: extra.kickoffLabel ?? null,
    isLive: p.is_live,
    pick: p.pick,
    market: p.market,
    modelPct: p.fair_odds != null ? toPct(impliedProbability(p.fair_odds)) : null,
    marketPct,
    edgePct: marketPct == null ? null : p.edge_percent,
    confidence: p.confidence_score,
    explanation: p.explanation,
    locked: extra.locked ?? false,
  };
}
