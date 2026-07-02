// Anytime-goalscorer model (sotto-progetto B-model).
// Funzione PURA: dal lambda di squadra (gia` servito da /api/predictions) +
// dati giocatore (player_profiles) + quote book US (player_odds) calcola
// P(segna) e l'Edge. Nessun I/O, nessun import Next. Vedi spec
// docs/superpowers/specs/2026-06-21-goalscorer-model-design.md

export type GsPlayer = {
  playerId: string | null;
  name: string;
  goalsPer90: number;
  minutesShare: number;
  tier: number;
};

export type GsOdd = {
  playerName: string;
  price: number;
  bookmaker: string;
};

export type GoalscorerMarket = {
  playerId: string | null;
  name: string;
  side: "home" | "away";
  pScores: number;
  marketImplied: number | null;
  bestPrice: number | null;
  bookmaker: string | null;
  edge: number | null;
  confidence: "alta" | "media";
};

// Normalizzazione nomi condivisa (giocatori e squadre): lowercase, trim,
// collasso spazi interni. Unica fonte, riusata da goalscorer-serve.
export function normName(s: string): string {
  return (s || "").trim().toLowerCase().split(/\s+/).join(" ");
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// Miglior prezzo (quota decimale piu` alta = piu` favorevole) per un giocatore.
function bestOddFor(name: string, byPlayer: Map<string, GsOdd>): GsOdd | null {
  return byPlayer.get(normName(name)) ?? null;
}

function indexBestOdds(odds: GsOdd[]): Map<string, GsOdd> {
  const best = new Map<string, GsOdd>();
  for (const o of odds || []) {
    if (!o || typeof o.price !== "number" || o.price <= 1.0) continue;
    const key = normName(o.playerName);
    if (!key) continue;
    const cur = best.get(key);
    if (!cur || o.price > cur.price) best.set(key, o);
  }
  return best;
}

// #GOALSCORER-CALIB-1 (fase 2): calibrazione isotonica addestrata su TUTTI i dati
// (5 leghe top × 3 stagioni + WC 2026 = 143.751 player-match; scripts/backtest_goalscorer.py).
// Il modello grezzo, pur corretto in aggregato, SOVRA-stima i bomber (fascia alta) e sotto-stima
// la fascia bassa; questa curva monotòna riallinea P(segna) ai tassi reali (Brier −0.3% out-of-sample,
// validato train/test temporale multi-lega). Curva fittata sul 100% dei dati (max campione).
// Coppie [p_grezzo, p_calibrato]; interpolazione lineare, clamp ai bordi.
const GS_CALIBRATION: readonly [number, number][] = [
  [0, 0.0306], [0.025, 0.0384], [0.05, 0.0542], [0.075, 0.0769], [0.1, 0.0924],
  [0.125, 0.1153], [0.15, 0.1261], [0.175, 0.146], [0.2, 0.1621], [0.225, 0.174],
  [0.25, 0.2083], [0.275, 0.2205], [0.3, 0.2565], [0.325, 0.2784], [0.35, 0.2789],
  [0.4, 0.2844], [0.425, 0.3255], [0.475, 0.3299], [0.5, 0.402], [0.575, 0.4552],
  [0.775, 0.5], [0.8, 0.5],
];

/** Applica la calibrazione isotonica (interpolazione lineare monotòna) a P(segna). */
export function calibrateScorerProb(p: number): number {
  if (!Number.isFinite(p)) return 0;
  const c = GS_CALIBRATION;
  if (p <= c[0][0]) return c[0][1];
  if (p >= c[c.length - 1][0]) return c[c.length - 1][1];
  for (let i = 1; i < c.length; i++) {
    if (p <= c[i][0]) {
      const [x0, y0] = c[i - 1], [x1, y1] = c[i];
      const t = (p - x0) / (x1 - x0 || 1);
      return y0 + t * (y1 - y0);
    }
  }
  return p;
}

function marketsForSide(
  side: "home" | "away",
  teamLambda: number,
  players: GsPlayer[],
  bestOdds: Map<string, GsOdd>,
  calibrate = true,
): GoalscorerMarket[] {
  if (!Number.isFinite(teamLambda) || teamLambda <= 0) return [];
  // Alloca i gol attesi della squadra (teamLambda) tra i giocatori per la loro
  // CONTRIBUZIONE attesa = gol/90 × quota-minuti. Normalizzando su questo peso, la
  // somma dei λ_giocatore = teamLambda (gol conservati). Il modello precedente
  // normalizzava solo su gol/90 e poi moltiplicava per i minuti → Σλ < teamLambda,
  // cioè SOTTO-stimava sistematicamente P(segna) di ogni giocatore (bug di calibrazione).
  const valid = (players || []).filter(
    (p) => Number.isFinite(p.goalsPer90) && p.goalsPer90 > 0 && Number.isFinite(p.minutesShare) && p.minutesShare > 0,
  );
  const weight = (p: GsPlayer) => p.goalsPer90 * clamp01(p.minutesShare);
  const denom = valid.reduce((s, p) => s + weight(p), 0);
  if (denom <= 0) return []; // fail-closed: nessun dato di contribuzione

  const out: GoalscorerMarket[] = [];
  for (const p of valid) {
    const share = weight(p) / denom;
    const lambdaPlayer = teamLambda * share; // Σ su tutti i giocatori = teamLambda (grezzo)
    if (lambdaPlayer <= 0) continue;
    const rawP = 1 - Math.exp(-lambdaPlayer);
    const pScores = calibrate ? calibrateScorerProb(rawP) : rawP;

    const odd = bestOddFor(p.name, bestOdds);
    const bestPrice = odd ? odd.price : null;
    const marketImplied = bestPrice ? 1 / bestPrice : null;
    const edge = marketImplied != null ? pScores - marketImplied : null;

    out.push({
      playerId: p.playerId,
      name: p.name,
      side,
      pScores,
      marketImplied,
      bestPrice,
      bookmaker: odd ? odd.bookmaker : null,
      edge,
      confidence: p.tier === 1 ? "alta" : "media",
    });
  }
  return out;
}

/**
 * Calcola i mercati anytime-goalscorer per una partita.
 * @param topN massimo numero di giocatori per squadra (default 5), ordinati per pScores desc.
 */
export function computeGoalscorerMarkets(
  lambdaHome: number,
  lambdaAway: number,
  homePlayers: GsPlayer[],
  awayPlayers: GsPlayer[],
  odds: GsOdd[],
  topN = 5,
  calibrate = true,
): GoalscorerMarket[] {
  const bestOdds = indexBestOdds(odds);
  const home = marketsForSide("home", lambdaHome, homePlayers, bestOdds, calibrate)
    .sort((a, b) => b.pScores - a.pScores)
    .slice(0, topN);
  const away = marketsForSide("away", lambdaAway, awayPlayers, bestOdds, calibrate)
    .sort((a, b) => b.pScores - a.pScores)
    .slice(0, topN);
  return [...home, ...away];
}
