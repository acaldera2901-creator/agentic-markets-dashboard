// lib/ui/prediction-card.ts — #RESTYLING-0921
//
// La grammatica numerica della PredictionCard, fuori dal JSX così è testabile
// e condivisa da PredictionCard e MatchHeader.
//
// Convenzione del prodotto (lib/unified-adapter.ts): l'edge è in PUNTI
// percentuali = probabilità modello − probabilità implicita del mercato, e
// senza un prezzo di mercato reale NON si dichiara un edge (resta «model
// estimate»).
//
// Round 14: l'edge non si SCRIVE più da nessuna parte nell'interfaccia — via
// il chip accanto al pick, ultimo numero di mercato rimasto nella scheda. Resta
// un numero di ORDINAMENTO (quali partite salgono in cima, quali entrano nella
// fascia «High edge»: lib/ui/lobby.ts), quindi `edgePointsFrom` e
// `EDGE_HIGH_PP` vivono; `edgeTone`/`formatEdge`, che servivano solo a
// dipingerlo e a scriverlo col segno, sono stati rimossi con l'EdgeBadge.

import { impliedProbability } from "@/lib/betting-math";
import type { UnifiedPrediction } from "@/lib/unified-adapter";
import type { FootballTier } from "@/lib/surfacing-gate";

/** Da qui in su la card si merita il badge «High edge». Allineato a
 *  computeRisk() dell'adapter, dove edge > 4% = rischio basso. */
export const EDGE_HIGH_PP = 5;

/** Percentuale intera del modello: «64». null → «—». */
export function formatPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return String(Math.round(Math.max(0, Math.min(100, pct))));
}

/** L'EDGE della card è la differenza fra i due numeri che la card mostra.
 *
 *  Non è pedanteria: `UnifiedPrediction.edge_percent` NON è quella differenza.
 *  lib/unified-adapter.ts lo calcola come `row.edge * 100`, e `row.edge` è
 *  `fpEdge(p, odds) = p·odds − 1`, cioè il VALUE della scommessa. I due
 *  differiscono per un fattore `odds`:
 *
 *    value%      = (p·odds − 1)·100
 *    model−market = p·100 − (1/odds)·100 = value% / odds
 *
 *  Con p=0.64 e odds=1.92: value% = 22.9, model−market = 12.0. Una card che
 *  scrive «MODEL 64 · MARKET 52 · EDGE +22.9» si contraddice da sola in due
 *  secondi — ed è esattamente il tempo che il brief le concede.
 *
 *  Il value resta il numero giusto ALTROVE (il board lo mostra come «value»):
 *  qui vale la definizione che rende leggibile il confronto affiancato.
 */
export function edgePointsFrom(modelPct: number | null, marketPct: number | null): number | null {
  if (modelPct == null || marketPct == null) return null;
  if (!Number.isFinite(modelPct) || !Number.isFinite(marketPct)) return null;
  return Math.round((modelPct - marketPct) * 100) / 100;
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
  /** #TRE-LIVELLI-0925 — solo calcio. "pick" = pick piena; "reading" = la
   *  direzione si mostra ma la riga sta sotto il floor della sua lega (badge
   *  «Model read», fuori da Best Bets / Pick of the Day / track record
   *  pubblico); "readonly" = nessuna direzione. Assente = "pick", cosi' il
   *  tennis e i chiamanti che non lo passano non cambiano comportamento. */
  tier?: FootballTier;
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
  const modelPct = p.fair_odds != null ? toPct(impliedProbability(p.fair_odds)) : null;
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
    modelPct,
    marketPct,
    // NON `p.edge_percent`: quello è il value (p·odds−1). Vedi edgePointsFrom.
    edgePct: edgePointsFrom(modelPct, marketPct),
    confidence: p.confidence_score,
    explanation: p.explanation,
    locked: extra.locked ?? false,
  };
}
