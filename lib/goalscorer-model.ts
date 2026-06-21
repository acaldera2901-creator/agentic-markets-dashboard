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

function marketsForSide(
  side: "home" | "away",
  teamLambda: number,
  players: GsPlayer[],
  bestOdds: Map<string, GsOdd>,
): GoalscorerMarket[] {
  if (!Number.isFinite(teamLambda) || teamLambda <= 0) return [];
  const valid = (players || []).filter((p) => Number.isFinite(p.goalsPer90) && p.goalsPer90 > 0);
  const denom = valid.reduce((s, p) => s + p.goalsPer90, 0);
  if (denom <= 0) return []; // fail-closed: nessun dato di share

  const out: GoalscorerMarket[] = [];
  for (const p of valid) {
    const share = p.goalsPer90 / denom;
    const minutesFactor = clamp01(p.minutesShare);
    const lambdaPlayer = teamLambda * share * minutesFactor;
    if (lambdaPlayer <= 0) continue; // es. minutesShare=0 -> niente riga P=0% fuorviante
    const pScores = 1 - Math.exp(-lambdaPlayer);

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
): GoalscorerMarket[] {
  const bestOdds = indexBestOdds(odds);
  const home = marketsForSide("home", lambdaHome, homePlayers, bestOdds)
    .sort((a, b) => b.pScores - a.pScores)
    .slice(0, topN);
  const away = marketsForSide("away", lambdaAway, awayPlayers, bestOdds)
    .sort((a, b) => b.pScores - a.pScores)
    .slice(0, topN);
  return [...home, ...away];
}
