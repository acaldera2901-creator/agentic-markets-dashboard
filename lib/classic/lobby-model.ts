// lib/classic/lobby-model.ts — filone «classic», lobby (#CLASSIC-LOBBY-1008)
//
// La lobby stile Roobet: banner, tab, striscia sport, fascia in evidenza, poi
// le partite divise sport → lega. Qui sta SOLO la logica pura (chi entra in
// quale blocco, in che ordine), fuori dal JSX, perché le regole che contano
// sono negative e vanno testate:
//   - nessun gruppo vuoto si rende;
//   - «Where our estimate differs most» non accoglie una partita il cui
//     modello grezzo si allontana dal mercato di più di 15 punti;
//   - un ordine dichiarato (leghe top prima, poi per orario), non un ordine
//     che dipende da come l'API ha messo le righe.
//
// Le righe sono le STESSE `LobbyItem` che la lobby di oggi riceve dal desk
// (app/app/page.tsx → HomeLobby): nessun dato nuovo, nessuna chiamata.

import type { LobbyItem } from "@/lib/ui/lobby";
import { startingSoonLabel } from "@/lib/ui/lobby";
import { MARKET_BLEND_ALPHA } from "@/lib/poisson-model";

// ─── Leghe: paese e rango ───────────────────────────────────────────────────

/** Il paese di una lega. ISO 3166-1 alpha-2 dove esiste (lo traduce
 *  `Intl.DisplayNames`), altrimenti una delle tre chiavi che Intl non conosce:
 *  Inghilterra e Scozia non sono stati ISO, le coppe UEFA/FIFA non hanno un
 *  paese. Queste tre stanno nella tabella di copy (11 lingue). */
export type LeagueCountry = { iso: string } | { key: "england" | "scotland" | "international" };

type LeagueMeta = { country: LeagueCountry; tier: number };

const ENG: LeagueCountry = { key: "england" };
const SCO: LeagueCountry = { key: "scotland" };
const INTL: LeagueCountry = { key: "international" };
const iso = (code: string): LeagueCountry => ({ iso: code });

/** Le leghe che il board serve (misurate su /api/predictions l'8/10: 26 nomi)
 *  più le coppe che compaiono in stagione. La chiave è il NOME mostrato
 *  (`PredictionCardData.league` porta `league_name`, non il codice).
 *
 *  `tier` è l'ordine delle leghe top: 1 = le coppe europee e i cinque grandi
 *  campionati, 2 = le seconde divisioni dei grandi e i primi campionati
 *  degli altri paesi europei, 3 = il resto. A parità di tier decide l'orario. */
const LEAGUES: Record<string, LeagueMeta> = {
  "UEFA Champions League": { country: INTL, tier: 1 },
  "Champions League": { country: INTL, tier: 1 },
  "UEFA Europa League": { country: INTL, tier: 1 },
  "Europa League": { country: INTL, tier: 1 },
  "UEFA Conference League": { country: INTL, tier: 1 },
  "Conference League": { country: INTL, tier: 1 },
  "FIFA World Cup": { country: INTL, tier: 1 },
  "World Cup": { country: INTL, tier: 1 },
  "Premier League": { country: ENG, tier: 1 },
  "Serie A": { country: iso("IT"), tier: 1 },
  "La Liga": { country: iso("ES"), tier: 1 },
  "Primera Division": { country: iso("ES"), tier: 1 },
  "Bundesliga": { country: iso("DE"), tier: 1 },
  "Ligue 1": { country: iso("FR"), tier: 1 },
  "Championship": { country: ENG, tier: 2 },
  "Serie B": { country: iso("IT"), tier: 2 },
  "Segunda Division": { country: iso("ES"), tier: 2 },
  "2. Bundesliga": { country: iso("DE"), tier: 2 },
  "Ligue 2": { country: iso("FR"), tier: 2 },
  "Eredivisie": { country: iso("NL"), tier: 2 },
  "Primeira Liga": { country: iso("PT"), tier: 2 },
  "Belgian Pro League": { country: iso("BE"), tier: 2 },
  "Scottish Premiership": { country: SCO, tier: 2 },
  "Turkish Super Lig": { country: iso("TR"), tier: 2 },
  "Brasileirao": { country: iso("BR"), tier: 2 },
  "Liga Profesional": { country: iso("AR"), tier: 2 },
  "Liga MX": { country: iso("MX"), tier: 2 },
  "MLS": { country: iso("US"), tier: 2 },
  "League One": { country: ENG, tier: 3 },
  "League Two": { country: ENG, tier: 3 },
  "League of Ireland": { country: iso("IE"), tier: 3 },
  "Veikkausliiga": { country: iso("FI"), tier: 3 },
  "Chinese Super League": { country: iso("CN"), tier: 3 },
  "Ekstraklasa": { country: iso("PL"), tier: 3 },
  "Allsvenskan": { country: iso("SE"), tier: 3 },
  "Eliteserien": { country: iso("NO"), tier: 3 },
  "J1 League": { country: iso("JP"), tier: 3 },
  "K League 1": { country: iso("KR"), tier: 3 },
  "A-League": { country: iso("AU"), tier: 3 },
};

/** Tennis: il circuito principale (ATP/WTA e gli Slam) davanti a Challenger e
 *  ITF. Il torneo non porta un paese nei dati di oggi: si dice il circuito. */
const TENNIS_LOWER = /challenger|\bitf\b|\butr\b|\bm15\b|\bm25\b|\bw\d{2,3}\b|\b125\b/i;
const SLAMS = /australian open|roland garros|french open|wimbledon|us open/i;

export function tennisCircuit(tournament: string | null): string | null {
  const t = tournament ?? "";
  if (/challenger/i.test(t)) return "Challenger";
  if (/\bitf\b|\bm15\b|\bm25\b|\bw\d{2,3}\b/i.test(t)) return "ITF";
  if (/\bwta\b/i.test(t)) return "WTA";
  if (/\batp\b/i.test(t)) return "ATP";
  if (SLAMS.test(t)) return "Grand Slam";
  return null;
}

/** Il rango di una lega: più basso = più in alto nella pagina. Le leghe che
 *  la tabella non conosce stanno in fondo (tier 4), mai sopra le note. */
export function leagueTier(sport: string, league: string | null): number {
  // Senza nome (il feed partner del tennis non porta il torneo): in fondo.
  if (!league || !league.trim()) return 4;
  if (sport === "tennis") {
    const t = league ?? "";
    if (SLAMS.test(t)) return 1;
    if (TENNIS_LOWER.test(t)) return 3;
    return /\b(atp|wta)\b/i.test(t) ? 1 : 2;
  }
  return LEAGUES[league ?? ""]?.tier ?? 4;
}

export function leagueCountry(sport: string, league: string | null): LeagueCountry | null {
  if (sport === "tennis") return null;
  return LEAGUES[league ?? ""]?.country ?? null;
}

// ─── Il giorno di una partita, nel fuso dell'utente ────────────────────────

/** "YYYY-MM-DD" nel fuso dato. `en-CA` formatta proprio così. */
export function dayKey(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

export type DateFilter = "all" | "live" | "today" | "tomorrow";

export function matchesDateFilter(it: LobbyItem, f: DateFilter, tz: string, now: number): boolean {
  if (f === "all") return true;
  if (f === "live") return it.data.isLive;
  const t = new Date(it.data.startsAt).getTime();
  if (!Number.isFinite(t)) return false;
  // Una partita in corso è «di oggi» anche se è iniziata ieri sera: è sullo
  // schermo adesso. Il domani non la contiene mai.
  if (f === "today") return it.data.isLive || dayKey(t, tz) === dayKey(now, tz);
  return !it.data.isLive && dayKey(t, tz) === dayKey(now + 24 * 3600 * 1000, tz);
}

// ─── Gruppi: sport → lega ──────────────────────────────────────────────────

export type LeagueGroup = {
  /** Chiave stabile per React e per lo stato aperto/chiuso. */
  id: string;
  sport: string;
  league: string;
  country: LeagueCountry | null;
  circuit: string | null;
  tier: number;
  items: LobbyItem[];
  liveCount: number;
  /** Il primo calcio d'inizio del gruppo (ms) — secondo criterio d'ordine. */
  firstStart: number;
};

/** La chiave del gruppo delle righe senza lega/torneo. Il componente la
 *  mostra come «Other tournaments» / «Other leagues» (tradotto). */
export const UNNAMED_LEAGUE = "\u0000unnamed";

export type SportBlock = { sport: string; groups: LeagueGroup[]; count: number };

const SPORT_ORDER = ["football", "tennis"];

function startMs(it: LobbyItem): number {
  const t = new Date(it.data.startsAt).getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

/** Dentro un gruppo: prima le partite in corso, poi per orario. */
export function byLiveThenKickoff(a: LobbyItem, b: LobbyItem): number {
  if (a.data.isLive !== b.data.isLive) return a.data.isLive ? -1 : 1;
  return startMs(a) - startMs(b);
}

/** L'ordine DICHIARATO della pagina: sport nell'ordine del prodotto (calcio,
 *  tennis); dentro lo sport le leghe per tier, poi per primo calcio d'inizio,
 *  poi per nome (così due leghe alla stessa ora non si scambiano a ogni
 *  render). Nessun gruppo vuoto. */
export function groupBySportLeague(items: readonly LobbyItem[]): SportBlock[] {
  const bySport = new Map<string, Map<string, LobbyItem[]>>();
  for (const it of items) {
    const sport = it.data.sport;
    const league = it.data.league?.trim() || UNNAMED_LEAGUE;
    if (!bySport.has(sport)) bySport.set(sport, new Map());
    const leagues = bySport.get(sport)!;
    if (!leagues.has(league)) leagues.set(league, []);
    leagues.get(league)!.push(it);
  }
  const sports = Array.from(bySport.keys()).sort((a, b) => {
    const ia = SPORT_ORDER.indexOf(a), ib = SPORT_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  return sports.map((sport) => {
    const groups: LeagueGroup[] = Array.from(bySport.get(sport)!.entries()).map(([league, rows]) => {
      const sorted = [...rows].sort(byLiveThenKickoff);
      return {
        id: `${sport}:${league}`,
        sport,
        league,
        country: leagueCountry(sport, league === UNNAMED_LEAGUE ? null : league),
        circuit: sport === "tennis" && league !== UNNAMED_LEAGUE ? tennisCircuit(league) : null,
        tier: leagueTier(sport, league === UNNAMED_LEAGUE ? null : league),
        items: sorted,
        liveCount: sorted.filter((r) => r.data.isLive).length,
        firstStart: Math.min(...sorted.map(startMs)),
      };
    });
    groups.sort((a, b) => a.tier - b.tier || a.firstStart - b.firstStart || a.league.localeCompare(b.league));
    return { sport, groups, count: groups.reduce((n, g) => n + g.items.length, 0) };
  });
}

// ─── Fascia «in evidenza» ──────────────────────────────────────────────────

export const FEATURED_CAP = 10;

/** In evidenza = le partite in corso, poi i prossimi calci d'inizio, ma solo
 *  delle leghe top (tier 1). Se oggi il tier 1 non gioca, si scende al 2, poi
 *  a tutto: la fascia non resta vuota per un criterio troppo stretto, e non
 *  si riempie di Veikkausliiga quando gioca la Serie A. */
export function featuredItems(items: readonly LobbyItem[], now: number = Date.now(), cap: number = FEATURED_CAP): LobbyItem[] {
  const eligible = items.filter((it) => it.data.isLive || startMs(it) > now);
  for (const maxTier of [1, 2, Number.POSITIVE_INFINITY]) {
    const pool = eligible.filter((it) => leagueTier(it.data.sport, it.data.league) <= maxTier);
    if (pool.length >= Math.min(4, eligible.length)) return [...pool].sort(byLiveThenKickoff).slice(0, cap);
  }
  return [];
}

// ─── «Where our estimate differs most» ─────────────────────────────────────

/** Oltre questo scarto (pp) fra modello GREZZO e mercato la partita non entra
 *  nella fascia: è la soglia «no value» della review (lib/v3c fixdata
 *  GUARD_NO_VALUE_PP). Oltre non è un disaccordo da mostrare, è un modello
 *  che probabilmente sbaglia. */
export const DIFFERS_MAX_RAW_GAP_PP = 15;
export const DIFFERS_CAP = 6;

/** Il margine del book che si assume per togliere il vig dalla sola quota che
 *  la riga porta (la riga chiusa ha UN esito, non la tripla: non si può
 *  de-viggare davvero). Il controllo usa la stima PEGGIORE fra con e senza
 *  margine: in dubbio, fuori. */
const ASSUMED_OVERROUND = 0.05;

/** Lo scarto modello grezzo − mercato, STIMATO dai numeri che l'API serve.
 *
 *  Il calcio servito è 0,3·modello + 0,7·mercato (MARKET_BLEND_ALPHA in
 *  lib/poisson-model.ts, applicato in app/api/predictions/route.ts quando
 *  ci sono quote vere): lo scarto servito è quindi 0,3 volte quello del
 *  modello. Si inverte il blend: grezzo ≈ servito / 0,3. Il tennis servito
 *  non è un blend col mercato: lo scarto è quello che si vede.
 *
 *  null = non c'è un confronto (manca il mercato, o il numero È il mercato:
 *  `probabilitySource === "market"`). Una partita senza confronto non entra
 *  nella fascia: «differisce» da cosa? */
export function estimatedRawGapPp(it: LobbyItem): number | null {
  const d = it.data;
  if (d.modelPct == null || d.marketPct == null) return null;
  if (!Number.isFinite(d.modelPct) || !Number.isFinite(d.marketPct)) return null;
  if (d.probabilitySource === "market") return null;
  const implied = d.marketPct;
  const noVig = implied / (1 + ASSUMED_OVERROUND);
  const scale = d.sport === "football" ? MARKET_BLEND_ALPHA : 1;
  const a = Math.abs(d.modelPct - implied) / scale;
  const b = Math.abs(d.modelPct - noVig) / scale;
  return Math.round(Math.max(a, b) * 10) / 10;
}

/** Le partite NON iniziate con lo scarto servito più grande, fra quelle il
 *  cui scarto grezzo stimato resta entro 15 punti. Ordinate per |scarto
 *  servito| decrescente — è il numero che la scheda mostra, quindi l'ordine
 *  che l'utente può verificare a occhio. */
export function differsMostItems(items: readonly LobbyItem[], now: number = Date.now(), cap: number = DIFFERS_CAP): LobbyItem[] {
  return items
    // Solo calcio. Il «nostro» numero del tennis oggi è un Elo temperato, non
    // sigillato (REGOLE-CLASSIC: tennis «Market only» o «Elo-based, not
    // sealed», filone F gated): metterlo in vetrina come disaccordo col
    // mercato è proprio la promessa che la review toglie. Misurato l'8/10:
    // senza questo filtro la fascia era 6 su 6 tennis Elo.
    .filter((it) => it.data.sport === "football")
    .filter((it) => !it.data.isLive && startMs(it) > now)
    .filter((it) => it.data.edgePct != null && Number.isFinite(it.data.edgePct))
    .filter((it) => {
      const g = estimatedRawGapPp(it);
      return g != null && g <= DIFFERS_MAX_RAW_GAP_PP;
    })
    .sort((a, b) => Math.abs(b.data.edgePct ?? 0) - Math.abs(a.data.edgePct ?? 0) || startMs(a) - startMs(b))
    .slice(0, cap);
}

// ─── Tab, sport, ricerca ───────────────────────────────────────────────────

export type LobbyTab = "featured" | "inplay" | "soon" | "all";
export type SportFilter = "popular" | "football" | "tennis";

/** «Popular» = le leghe top (tier ≤ 2) di tutti gli sport. Se oggi non ce
 *  n'è nessuna, tutto: il filtro non deve svuotare la pagina. */
export function applySportFilter(items: readonly LobbyItem[], s: SportFilter): LobbyItem[] {
  if (s === "football" || s === "tennis") return items.filter((it) => it.data.sport === s);
  const top = items.filter((it) => leagueTier(it.data.sport, it.data.league) <= 2);
  return top.length > 0 ? top : [...items];
}

export function applyTab(items: readonly LobbyItem[], tab: LobbyTab, now: number = Date.now()): LobbyItem[] {
  if (tab === "inplay") return items.filter((it) => it.data.isLive);
  if (tab === "soon") return items.filter((it) => !it.data.isLive && startingSoonLabel(it.data.startsAt, now) != null);
  return [...items];
}

export function matchesQuery(it: LobbyItem, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return `${it.data.home} ${it.data.away} ${it.data.league ?? ""}`.toLowerCase().includes(needle);
}
