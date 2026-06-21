// B-serve: builder puro che unisce predizioni (lambda) + profili giocatore
// (player_profiles) + quote (player_odds) e produce i mercati marcatore per
// match. La parte I/O (fetch Supabase batch) vive nel route; questa funzione
// e` pura e testabile. Vedi spec 2026-06-21-goalscorer-model-design.md (B-serve).
import {
  computeGoalscorerMarkets,
  GsPlayer,
  GsOdd,
  GoalscorerMarket,
} from "./goalscorer-model";

export type GsPrediction = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  lambdaHome: number | null;
  lambdaAway: number | null;
};

export function normTeam(s: string): string {
  return (s || "").trim().toLowerCase().split(/\s+/).join(" ");
}

/**
 * Costruisce la mappa matchId -> mercati marcatore.
 * @param profilesByTeam chiave = nome squadra normalizzato (normTeam)
 * @param oddsByMatch chiave = matchId
 */
export function buildGoalscorerByMatch(
  predictions: GsPrediction[],
  profilesByTeam: Map<string, GsPlayer[]>,
  oddsByMatch: Map<string, GsOdd[]>,
  topN = 5,
): Map<string, GoalscorerMarket[]> {
  const out = new Map<string, GoalscorerMarket[]>();
  for (const p of predictions || []) {
    if (p.lambdaHome == null || p.lambdaAway == null) continue;
    const home = profilesByTeam.get(normTeam(p.homeTeam)) ?? [];
    const away = profilesByTeam.get(normTeam(p.awayTeam)) ?? [];
    if (home.length === 0 && away.length === 0) continue; // nessun dato giocatore
    const odds = oddsByMatch.get(p.matchId) ?? [];
    const markets = computeGoalscorerMarkets(
      p.lambdaHome,
      p.lambdaAway,
      home,
      away,
      odds,
      topN,
    );
    if (markets.length > 0) out.set(p.matchId, markets);
  }
  return out;
}

// Helper: raggruppa righe player_profiles (gia` filtrate eligible) per team
// normalizzato, mappandole a GsPlayer.
export type ProfileRow = {
  player_id: string | null;
  name: string;
  team: string;
  goals_per90_season: number | null;
  minutes_share: number | null;
  tier: number | null;
};

export function groupProfilesByTeam(rows: ProfileRow[]): Map<string, GsPlayer[]> {
  const m = new Map<string, GsPlayer[]>();
  for (const r of rows || []) {
    const key = normTeam(r.team);
    if (!key) continue;
    const player: GsPlayer = {
      playerId: r.player_id,
      name: r.name,
      goalsPer90: r.goals_per90_season ?? 0,
      minutesShare: r.minutes_share ?? 0,
      tier: r.tier ?? 0,
    };
    const arr = m.get(key);
    if (arr) arr.push(player);
    else m.set(key, [player]);
  }
  return m;
}

// Helper: raggruppa righe player_odds per matchId, mappandole a GsOdd.
export type OddRow = {
  match_id: string | null;
  player_name: string;
  price: number | null;
  bookmaker: string;
};

export function groupOddsByMatch(rows: OddRow[]): Map<string, GsOdd[]> {
  const m = new Map<string, GsOdd[]>();
  for (const r of rows || []) {
    if (!r.match_id || typeof r.price !== "number") continue;
    const odd: GsOdd = {
      playerName: r.player_name,
      price: r.price,
      bookmaker: r.bookmaker,
    };
    const arr = m.get(r.match_id);
    if (arr) arr.push(odd);
    else m.set(r.match_id, [odd]);
  }
  return m;
}
