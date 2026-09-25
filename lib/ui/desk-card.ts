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

/** Il sottoinsieme di `Prediction` (calcio) che serve alla card.
 *
 *  #RESTYLING-0921 — la tripla e le quote sono OPZIONALI: su una riga chiusa il
 *  server non le manda (proiezione d'accesso) e al loro posto arrivano
 *  `model_prob` e `market_odds`, i due numeri dell'esito di punta senza dire
 *  QUALE sia. Il tipo dichiarava `p_home: number` mentre a runtime arrivava
 *  `undefined`/`null`: è da lì che nasceva «MODEL 0%». */
export type DeskFootballRow = {
  match_id: string;
  league: string;
  league_name?: string | null;
  home_team: string;
  away_team: string;
  kickoff: string;
  p_home?: number | null;
  p_draw?: number | null;
  p_away?: number | null;
  odds_home?: number | null;
  odds_draw?: number | null;
  odds_away?: number | null;
  /** Riga chiusa: probabilità dell'esito di punta (senza nominarlo). */
  model_prob?: number | null;
  /** Riga chiusa: quota reale dello stesso esito, o null. */
  market_odds?: number | null;
  best_selection?: string | null;
  locked?: boolean;
  confidence_score?: number | null;
  explanation?: string | null;
  enrichment?: { surface?: { below_floor: boolean } | null } | null;
};

/** Il sottoinsieme di `TennisMatch` che serve alla card. Vedi la nota sopra
 *  per i campi opzionali. */
export type DeskTennisRow = {
  id: string;
  player1: string;
  player2: string;
  tournament: string;
  scheduled: string;
  p1?: number | null;
  p2?: number | null;
  odds_p1?: number | null;
  odds_p2?: number | null;
  model_prob?: number | null;
  market_odds?: number | null;
  best_selection?: "P1" | "P2" | null;
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
  /** #LIVE-SCORE-CARD-0925 — vedi la nota in prediction-card.ts. Già
   *  formattato dal chiamante (il desk conosce la forma del punteggio del suo
   *  sport, la card no). */
  liveScoreLabel?: string | null;
  locked?: boolean;
};

type FootballKey = "HOME" | "DRAW" | "AWAY";

/** L'esito più probabile secondo il modello. Il fallback quando il server non
 *  asserisce una pick direzionale (below floor, o best_selection assente). */
export function topFootballKey(row: Pick<DeskFootballRow, "p_home" | "p_draw" | "p_away">): FootballKey {
  const h = num(row.p_home) ?? -1;
  const d = num(row.p_draw) ?? -1;
  const a = num(row.p_away) ?? -1;
  if (h >= d && h >= a) return "HOME";
  return d >= a ? "DRAW" : "AWAY";
}

function isFootballKey(v: string | null | undefined): v is FootballKey {
  return v === "HOME" || v === "DRAW" || v === "AWAY";
}

/** Un numero, o null. `null * 100` fa **0**, non null: è da qui che passava il
 *  «MODEL 0%» delle righe chiuse (il board tennis serve `p1: null`). Ogni
 *  probabilità/quota passa da qui prima di diventare una percentuale. */
function num(v: number | null | undefined): number | null {
  return v == null || !Number.isFinite(v) ? null : v;
}

/** Probabilità 0-1 → percentuale, o null. */
function toPct(prob: number | null | undefined): number | null {
  const p = num(prob);
  return p == null ? null : p * 100;
}

/** Quota decimale → probabilità implicita in percentuale, o null. */
function impliedPct(odds: number | null | undefined): number | null {
  const o = num(odds);
  return o != null && o > 1 ? (1 / o) * 100 : null;
}

/** Sotto il floor non c'è un favorito netto: si NOMINA l'esito più probabile,
 *  ma non si dichiara una pick («X vince»). Stessa regola del board. */
function footballBelowFloor(row: DeskFootballRow): boolean {
  return row.enrichment?.surface?.below_floor === true;
}

export function fromDeskFootball(row: DeskFootballRow, opts: DeskCardOptions = {}): PredictionCardData {
  const belowFloor = footballBelowFloor(row);
  // Riga chiusa: la tripla non c'è. I numeri arrivano già scelti dal server
  // (l'esito di punta), e la pick NON si nomina — non perché sia sfocata, ma
  // perché il nome dell'esito è esattamente ciò che il piano Pro vende.
  const hasTriple = num(row.p_home) != null && num(row.p_draw) != null && num(row.p_away) != null;
  const top = topFootballKey(row);
  const key: FootballKey = belowFloor || !isFootballKey(row.best_selection) ? top : row.best_selection;

  const prob = hasTriple ? (key === "HOME" ? row.p_home : key === "DRAW" ? row.p_draw : row.p_away) : row.model_prob;
  const odds = hasTriple ? (key === "HOME" ? row.odds_home : key === "DRAW" ? row.odds_draw : row.odds_away) : row.market_odds;

  const name =
    key === "HOME" ? row.home_team
    : key === "AWAY" ? row.away_team
    : (opts.drawLabel ?? "Draw");

  // Il pareggio non «vince», e sotto il floor non si consiglia niente: in
  // entrambi i casi si nomina l'esito e basta.
  const pick = !hasTriple ? null
    : belowFloor || key === "DRAW" || !opts.winLabel ? name
    : `${name} ${opts.winLabel}`;

  const modelPct = toPct(prob);
  const marketPct = impliedPct(odds);

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
    liveScoreLabel: opts.liveScoreLabel ?? null,
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
  // Vedi la nota in fromDeskFootball: riga chiusa = numeri dal server, nessun
  // nome. `row.p1 >= row.p2` con due null è `true` e sceglieva P1 a caso.
  const hasPair = num(row.p1) != null && num(row.p2) != null;
  const key: "P1" | "P2" = row.best_selection ?? ((num(row.p1) ?? 0) >= (num(row.p2) ?? 0) ? "P1" : "P2");
  const prob = hasPair ? (key === "P1" ? row.p1 : row.p2) : row.model_prob;
  const odds = hasPair ? (key === "P1" ? row.odds_p1 : row.odds_p2) : row.market_odds;
  const name = key === "P1" ? row.player1 : row.player2;

  const modelPct = toPct(prob);
  const marketPct = impliedPct(odds);

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
    liveScoreLabel: opts.liveScoreLabel ?? null,
    pick: !hasPair ? null : opts.winLabel ? `${name} ${opts.winLabel}` : name,
    market: "Match winner",
    modelPct,
    marketPct,
    edgePct: edgePointsFrom(modelPct, marketPct),
    confidence: row.confidence_score ?? null,
    explanation: row.explanation ?? null,
    locked: opts.locked ?? row.locked ?? false,
  };
}
