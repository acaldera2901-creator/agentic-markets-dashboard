// lib/classic/league-groups.ts — #CLASSIC-PAGES-1014
//
// Le pagine sport del filone classic (Calcio, Tennis, e ogni sport che verrà)
// non sono più una griglia di tutte le schede: sono GRUPPI per lega/torneo,
// apribili uno per uno, con le schede dentro. Qui sta la logica pura — chi va
// in quale gruppo, in che ordine stanno i gruppi, quali sono aperti al primo
// render — perché è la parte che si deve poter testare senza il DOM.
//
// Sport-agnostica di proposito: lega/paese/tier/circuito vengono da
// lobby-model (le stesse regole dell'elenco per lega della Home), e un nuovo
// sport entra qui senza una riga in più.
//
// L'ORDINE DENTRO UN GRUPPO NON SI TOCCA: le pagine sport hanno già i loro
// filtri (competizione, superficie, ordinamento) e la regola delle righe
// sbloccate davanti (#UNLOCKED-FIRST-0831). Si rispetta ciò che arriva.
import type { LobbyItem } from "@/lib/ui/lobby";
import { leagueCountry, leagueTier, tennisCircuit, UNNAMED_LEAGUE, type LeagueGroup } from "@/lib/classic/lobby-model";

/** Quante schede di un gruppo si vedono prima di «Vedi tutte (N)»: due righe
 *  da quattro a 1440 (griglia a colonne da 300 px). Sul telefono sono le prime
 *  otto del carosello, e il contatore nell'intestazione dice il totale. */
export const CARDS_PER_LEAGUE = 8;

/** Quanti gruppi stanno aperti al primo render: i due con più partite FRA I
 *  PRIMI OPEN_WINDOW in ordine di pagina. Il resto è una pila di intestazioni —
 *  nome, paese, contatore — che si legge in un colpo d'occhio e si apre a
 *  richiesta. */
export const OPEN_BY_SIZE = 2;

/** Dentro quante intestazioni si scelgono le aperte: le prime quattro sono ciò
 *  che sta in una schermata a 1440. Visto il 14/10: i due gruppi più grandi del
 *  calcio erano la Serie A e una lega di terzo tier a metà pagina — sopra
 *  restavano tre chevron chiusi e nessuna scheda. Le leghe top vengono prima
 *  perché contano di più: una Champions da nove si apre, una League One da
 *  dodici no. */
export const OPEN_WINDOW = 4;

/** I gruppi con una partita in corso si aprono comunque (fino a questo
 *  numero): il live è l'adesso, e nasconderlo dietro un chevron sarebbe il
 *  contrario di ciò che la pagina deve dire. */
export const OPEN_LIVE_MAX = 2;

function startMs(it: LobbyItem): number {
  const t = new Date(it.data.startsAt).getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

/**
 * Items → gruppi per lega, nell'ordine DICHIARATO della pagina:
 *   1. prima le leghe con una partita in corso (live → adesso);
 *   2. poi le leghe top (tier 1, 2, 3…);
 *   3. a parità, chi comincia prima (prossime ore);
 *   4. a parità, il nome (così due leghe alla stessa ora non si scambiano).
 * Dentro il gruppo le righe restano nell'ordine ricevuto.
 */
export function groupLeagues(items: readonly LobbyItem[]): LeagueGroup[] {
  const byLeague = new Map<string, LobbyItem[]>();
  for (const it of items) {
    const league = it.data.league?.trim() || UNNAMED_LEAGUE;
    const key = `${it.data.sport}:${league}`;
    if (!byLeague.has(key)) byLeague.set(key, []);
    byLeague.get(key)!.push(it);
  }
  const groups: LeagueGroup[] = Array.from(byLeague.entries()).map(([id, rows]) => {
    const sport = rows[0].data.sport;
    const league = id.slice(sport.length + 1);
    const named = league === UNNAMED_LEAGUE ? null : league;
    return {
      id,
      sport,
      league,
      country: leagueCountry(sport, named),
      circuit: sport === "tennis" && named ? tennisCircuit(named) : null,
      tier: leagueTier(sport, named),
      items: rows,
      liveCount: rows.filter((r) => r.data.isLive).length,
      firstStart: Math.min(...rows.map(startMs)),
    };
  });
  groups.sort((a, b) =>
    Number(b.liveCount > 0) - Number(a.liveCount > 0)
    || a.tier - b.tier
    || a.firstStart - b.firstStart
    || a.league.localeCompare(b.league));
  return groups;
}

/** Gli id dei gruppi aperti al primo render: i live (fino a OPEN_LIVE_MAX) più
 *  i OPEN_BY_SIZE con più partite fra i primi OPEN_WINDOW (a parità vince chi
 *  viene prima). */
export function defaultOpenIds(groups: readonly LeagueGroup[]): Set<string> {
  const open = new Set<string>();
  for (const g of groups) {
    if (g.liveCount > 0 && open.size < OPEN_LIVE_MAX) open.add(g.id);
  }
  const bySize = groups
    .slice(0, OPEN_WINDOW)
    .map((g, i) => ({ g, i }))
    .sort((a, b) => b.g.items.length - a.g.items.length || a.i - b.i)
    .slice(0, OPEN_BY_SIZE);
  for (const { g } of bySize) open.add(g.id);
  return open;
}
