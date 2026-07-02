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

// #GOLIVE: ripara i nomi mojibake (UTF-8 salvato come latin1: es. "Östman" → "Ã stman")
// che arrivano da alcune fonti player. Guardato: agisce solo se c'è la firma mojibake e
// la ri-decodifica non introduce caratteri di sostituzione — altrimenti lascia com'è.
export function fixMojibake(s: string): string {
  // Firma mojibake: lead-byte latin1 (Ã/Â) seguito da un byte di continuazione
  // UTF-8 (U+0080–U+00BF), dove cade la seconda metà del carattere accentato.
  if (!s || !/[\u00c3\u00c2][\u0080-\u00bf]/.test(s)) return s;
  try {
    const fixed = Buffer.from(s, "latin1").toString("utf8");
    if (fixed && fixed !== s && !fixed.includes("�")) return fixed;
  } catch { /* keep original */ }
  return s;
}

// #GS-DEDUP: chiave di dedup più robusta di normName — accent-insensitive e
// tollerante all'iniziale, così "M. Arnautović" = "Marko Arnautovic" = "Marko
// Arnautović" e "R. Schmid" = "Romano Schmid". Chiave = iniziale-nome|cognome
// (diacritici rimossi). Trade-off marcato: due giocatori DIVERSI della stessa
// squadra con stesso cognome e stessa iniziale si fonderebbero (rarissimo su una
// rosa; moreRelevant tiene comunque il più rilevante). NON tocca normName, che
// serve anche al matching squadre e quote.
function dedupKey(rawName: string): string {
  const clean = fixMojibake(rawName)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();
  const toks = clean.split(/\s+/).filter(Boolean);
  if (toks.length < 2) return toks[0] || clean;
  return `${toks[0][0]}|${toks[toks.length - 1]}`;
}

export function groupProfilesByTeam(rows: ProfileRow[]): Map<string, GsPlayer[]> {
  // #GS-DEDUP-0626: player_profiles può contenere lo STESSO giocatore due volte
  // (player_id diversi, doppia ingestione legacy/moderno) → le schede Marcatori
  // ripetevano i nomi. Dedup per chiave robusta (vedi dedupKey) dentro la squadra,
  // tenendo il record più rilevante (vedi moreRelevant).
  const byTeam = new Map<string, Map<string, GsPlayer>>();
  for (const r of rows || []) {
    const key = normTeam(r.team);
    if (!key) continue;
    const player: GsPlayer = {
      playerId: r.player_id,
      name: fixMojibake(r.name),
      goalsPer90: r.goals_per90_season ?? 0,
      minutesShare: r.minutes_share ?? 0,
      tier: r.tier ?? 0,
    };
    let players = byTeam.get(key);
    if (!players) { players = new Map(); byTeam.set(key, players); }
    const nameKey = dedupKey(r.name);
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
