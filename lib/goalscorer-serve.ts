// B-serve: builder puro che unisce predizioni (lambda) + profili giocatore
// (player_profiles) + quote (player_odds) e produce i mercati marcatore per
// match. La parte I/O (fetch Supabase batch) vive nel route; questa funzione
// e` pura e testabile. Vedi spec 2026-06-21-goalscorer-model-design.md (B-serve).
import {
  computeGoalscorerMarkets,
  normName,
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

// Alias: stessa normalizzazione dei nomi (unica fonte in goalscorer-model).
export const normTeam = normName;

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

// Keep the more relevant of two same-name records: higher goalsPer90×minutesShare
// (the player's weight in the model), tie-broken by tier 1 (high confidence).
function moreRelevant(a: GsPlayer, b: GsPlayer): boolean {
  const wa = (a.goalsPer90 || 0) * (a.minutesShare || 0);
  const wb = (b.goalsPer90 || 0) * (b.minutesShare || 0);
  if (wa !== wb) return wa > wb;
  if ((a.tier === 1) !== (b.tier === 1)) return a.tier === 1;
  return false; // full tie → keep the one already seen (stable)
}

export function groupProfilesByTeam(rows: ProfileRow[]): Map<string, GsPlayer[]> {
  // #GS-DEDUP-0626: player_profiles può contenere lo STESSO giocatore due volte
  // (player_id diversi, doppia ingestione legacy/moderno) → le schede Marcatori
  // ripetevano i nomi. Dedup per nome normalizzato dentro la squadra, tenendo il
  // record più rilevante (vedi moreRelevant).
  const byTeam = new Map<string, Map<string, GsPlayer>>();
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
    let players = byTeam.get(key);
    if (!players) { players = new Map(); byTeam.set(key, players); }
    const nameKey = normName(r.name);
    const existing = players.get(nameKey);
    if (!existing || moreRelevant(player, existing)) players.set(nameKey, player);
  }
  const m = new Map<string, GsPlayer[]>();
  for (const [team, players] of byTeam) m.set(team, [...players.values()]);
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
