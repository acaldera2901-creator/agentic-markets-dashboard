// lib/ui/desk-card.ts — #RESTYLING-0921
//
// Adapter dalle righe del DESK (app/app/page.tsx: `Prediction`, `TennisMatch`)
// ai dati della PredictionCard. Esiste separato da `fromUnifiedPrediction`
// perché il desk NON parla `UnifiedPrediction`: legge /api/predictions e
// /api/tennis, che servono le probabilità triple e le quote per esito.
//
// I tipi in ingresso sono STRUTTURALI (il sottoinsieme di campi che serve) e
// non gli `interface` della pagina: quelle vivono dentro un componente da
// 10.000 righe e non sono esportate. Passare la riga vera continua a
// type-checkare, e questo modulo resta testabile senza montare il desk.
//
// Regola numerica, una sola per tutto il redesign: EDGE = MODEL − MARKET, in
// punti percentuali. È l'unica definizione compatibile con una card che mostra
// i due numeri UNO ACCANTO ALL'ALTRO — vedi la nota in prediction-card.ts.

import type { PredictionCardData } from "@/lib/ui/prediction-card";
import { edgePointsFrom } from "@/lib/ui/prediction-card";

/** Il sottoinsieme di `Prediction` (calcio) che serve alla card. */
export type DeskFootballRow = {
  match_id: string;
  league: string;
  league_name?: string | null;
  home_team: string;
  away_team: string;
  kickoff: string;
  p_home: number;
  p_draw: number;
  p_away: number;
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
  best_selection: string | null;
  locked?: boolean;
  confidence_score?: number | null;
  explanation?: string | null;
  enrichment?: { surface?: { below_floor: boolean } | null } | null;
};

/** Il sottoinsieme di `TennisMatch` che serve alla card. */
export type DeskTennisRow = {
  id: string;
  player1: string;
  player2: string;
  tournament: string;
  scheduled: string;
  p1: number;
  p2: number;
  odds_p1: number | null;
  odds_p2: number | null;
  best_selection: "P1" | "P2" | null;
  locked?: boolean;
  confidence_score?: number | null;
  explanation?: string | null;
};

export type DeskCardOptions = {
  kickoffLabel?: string | null;
  /** Etichetta già localizzata per il pareggio ("Draw"/"Pareggio"/…). */
  drawLabel?: string;
  /** Suffisso già localizzato del pick 1X2 ("to win"/"vince"/…). */
  winLabel?: string;
  isLive?: boolean;
  liveMinute?: string | number | null;
  locked?: boolean;
};

type FootballKey = "HOME" | "DRAW" | "AWAY";

/** L'esito più probabile secondo il modello. Il fallback quando il server non
 *  asserisce una pick direzionale (below floor, o best_selection assente). */
export function topFootballKey(row: Pick<DeskFootballRow, "p_home" | "p_draw" | "p_away">): FootballKey {
  if (row.p_home >= row.p_draw && row.p_home >= row.p_away) return "HOME";
  return row.p_draw >= row.p_away ? "DRAW" : "AWAY";
}

function isFootballKey(v: string | null): v is FootballKey {
  return v === "HOME" || v === "DRAW" || v === "AWAY";
}

/** Sotto il floor non c'è un favorito netto: si NOMINA l'esito più probabile,
 *  ma non si dichiara una pick («X vince»). Stessa regola del board. */
function footballBelowFloor(row: DeskFootballRow): boolean {
  return row.enrichment?.surface?.below_floor === true;
}

export function fromDeskFootball(row: DeskFootballRow, opts: DeskCardOptions = {}): PredictionCardData {
  const belowFloor = footballBelowFloor(row);
  const top = topFootballKey(row);
  const key: FootballKey = belowFloor || !isFootballKey(row.best_selection) ? top : row.best_selection;

  const prob = key === "HOME" ? row.p_home : key === "DRAW" ? row.p_draw : row.p_away;
  const odds = key === "HOME" ? row.odds_home : key === "DRAW" ? row.odds_draw : row.odds_away;

  const name =
    key === "HOME" ? row.home_team
    : key === "AWAY" ? row.away_team
    : (opts.drawLabel ?? "Draw");

  // Il pareggio non «vince», e sotto il floor non si consiglia niente: in
  // entrambi i casi si nomina l'esito e basta.
  const pick = belowFloor || key === "DRAW" || !opts.winLabel ? name : `${name} ${opts.winLabel}`;

  const modelPct = prob * 100;
  const marketPct = odds != null && odds > 1 ? (1 / odds) * 100 : null;

  return {
    id: row.match_id,
    sport: "football",
    league: row.league_name || row.league || null,
    home: row.home_team,
    away: row.away_team,
    startsAt: row.kickoff,
    kickoffLabel: opts.kickoffLabel ?? null,
    isLive: opts.isLive ?? false,
    liveMinute: opts.liveMinute ?? null,
    pick,
    market: "1X2",
    modelPct,
    marketPct,
    edgePct: edgePointsFrom(modelPct, marketPct),
    confidence: row.confidence_score ?? null,
    explanation: row.explanation ?? null,
    locked: opts.locked ?? row.locked ?? false,
  };
}

export function fromDeskTennis(row: DeskTennisRow, opts: DeskCardOptions = {}): PredictionCardData {
  const key: "P1" | "P2" = row.best_selection ?? (row.p1 >= row.p2 ? "P1" : "P2");
  const prob = key === "P1" ? row.p1 : row.p2;
  const odds = key === "P1" ? row.odds_p1 : row.odds_p2;
  const name = key === "P1" ? row.player1 : row.player2;

  const modelPct = prob * 100;
  const marketPct = odds != null && odds > 1 ? (1 / odds) * 100 : null;

  return {
    id: row.id,
    sport: "tennis",
    league: row.tournament || null,
    home: row.player1,
    away: row.player2,
    startsAt: row.scheduled,
    kickoffLabel: opts.kickoffLabel ?? null,
    isLive: opts.isLive ?? false,
    liveMinute: opts.liveMinute ?? null,
    pick: opts.winLabel ? `${name} ${opts.winLabel}` : name,
    market: "Match winner",
    modelPct,
    marketPct,
    edgePct: edgePointsFrom(modelPct, marketPct),
    confidence: row.confidence_score ?? null,
    explanation: row.explanation ?? null,
    locked: opts.locked ?? row.locked ?? false,
  };
}
