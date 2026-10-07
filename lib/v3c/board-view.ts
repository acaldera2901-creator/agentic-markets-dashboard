// lib/v3c/board-view.ts (#REDESIGN-V3C F3)
// Il modello di vista della board, puro e testato: dall'oggetto dell'endpoint
// (contracts.ts) alle righe che si vedono. Qui si decide COSA è l'esito guida,
// come si raggruppa per giorno, cosa fa un filtro e quale stato vuoto tocca —
// la cascata: nessuna partita live → il gap più ampio di oggi → la prossima
// partita con il conto alla rovescia → la revisione di ieri.
import type { Outcome, V3BoardMatch, V3BoardOutcome, V3BoardTennisMatch, V3BoardTennisSide, V3BookPrice } from "./contracts";
import { FLAT_PP, formatSigned } from "./scale";
import { byRelevance, hasStarted } from "./fixdata";

export type SportFilter = "all" | "football" | "tennis";
export type DayFilter = "all" | "next" | string; // "all" | "next" (il primo giorno con righe, risolto dalla board) | YYYY-MM-DD (nel fuso scelto)

export type BoardFilters = { sport: SportFilter; day: DayFilter; league: string | null };

export const DEFAULT_FILTERS: BoardFilters = { sport: "all", day: "all", league: null };

/** La riga mostra l'esito con il gap assoluto più ampio; senza mercato, il focus (la probabilità più alta). */
export function leadOutcome(m: V3BoardMatch): V3BoardOutcome {
  const withGap = m.outcomes.filter((o) => o.edge_pp != null);
  if (withGap.length === 0) return m.outcomes.find((o) => o.outcome === m.focus) ?? m.outcomes[0];
  return withGap.reduce((best, o) => (Math.abs(o.edge_pp as number) > Math.abs(best.edge_pp as number) ? o : best));
}

export function outcomeLabel(m: { home: string; away: string }, o: Outcome, drawWord = "Draw"): string {
  return o === "home" ? m.home : o === "away" ? m.away : drawWord;
}

/** 0.5105 → "51" (la board scrive interi: la precisione è nel gap, a un decimale). */
export function pctInt(p: number | null | undefined): string {
  return p == null || !Number.isFinite(p) ? "—" : String(Math.round(p * 100));
}

/** Il gap in pp con il segno tipografico, un decimale; null → "—". */
export function gapText(pp: number | null | undefined): string {
  return pp == null || !Number.isFinite(pp) ? "—" : formatSigned(pp, 1);
}

export function isFlatGap(pp: number | null | undefined): boolean {
  return pp != null && Math.abs(pp) < FLAT_PP;
}

export function price2(x: number | null | undefined): string {
  return x == null || !Number.isFinite(x) ? "—" : x.toFixed(2);
}

/** YYYY-MM-DD di un istante nel fuso dato (undefined = UTC). */
export function dayKey(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function timeHM(iso: string, timeZone?: string, locale = "en-GB"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { timeZone: timeZone ?? "UTC", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** «Sun 5 Oct» — corto, per la riga. */
export function dayShort(iso: string, timeZone?: string, locale = "en-GB"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { timeZone: timeZone ?? "UTC", weekday: "short", day: "numeric", month: "short" }).format(d);
}

/** «Sunday 5 October» — la testa di fascia. */
export function dayLong(iso: string, timeZone?: string, locale = "en-GB"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { timeZone: timeZone ?? "UTC", weekday: "long", day: "numeric", month: "long" }).format(d);
}

/** «5 Oct, 20:02 UTC» — il momento del sigillo, sempre in UTC e detto. */
export function sealedStamp(iso: string, locale = "en-GB"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "short" }).format(d);
  return `${day}, ${timeHM(iso, "UTC", locale)} UTC`;
}

export type LiveState = { live: true; minutes: number } | { live: false };

/** Live = iniziata da meno di 150 minuti (la stessa finestra dell'endpoint). */
export function liveState(kickoffIso: string, now: Date): LiveState {
  const k = Date.parse(kickoffIso);
  if (Number.isNaN(k)) return { live: false };
  const min = Math.floor((now.getTime() - k) / 60_000);
  return min >= 0 && min < 150 ? { live: true, minutes: min } : { live: false };
}

export type BoardRowVM = {
  kind: "football";
  m: V3BoardMatch;
  lead: V3BoardOutcome;
  others: V3BoardOutcome[];
  best: V3BookPrice | null;
  day: string;
};

export type TennisRowVM = {
  kind: "tennis";
  m: V3BoardTennisMatch;
  /** ui3: il favorito del mercato (tennisLead); senza mercato, il focus del contratto */
  lead: V3BoardTennisSide;
  best: V3BookPrice | null;
  day: string;
};

/** I due nomi di una partita, calcio o tennis. */
export function sidesOf(m: V3BoardMatch | V3BoardTennisMatch): [string, string] {
  return m.sport === "tennis" ? [m.player1, m.player2] : [m.home, m.away];
}

export function matchTitle(m: V3BoardMatch | V3BoardTennisMatch): string {
  const [a, b] = sidesOf(m);
  return `${a} – ${b}`;
}

/** Il miglior prezzo: best_price se c'è, altrimenti il primo di book_prices (l'endpoint li ordina dal più alto; le pagine non spediscono il duplicato). */
export function bestOf(o: { best_price: V3BookPrice | null; book_prices: V3BookPrice[] }): V3BookPrice | null {
  return o.best_price ?? o.book_prices[0] ?? null;
}

/** polish: quanti book hanno il prezzo più alto (al centesimo). >1 = pari: nessun «best» unico. */
export function topShared(o: { best_price: V3BookPrice | null; book_prices: V3BookPrice[] }): V3BookPrice[] {
  const top = bestOf(o);
  if (!top) return [];
  const seen = new Set<string>();
  return o.book_prices.filter((b) => Math.round(b.price * 100) === Math.round(top.price * 100) && !seen.has(b.bookmaker) && seen.add(b.bookmaker));
}

/** fixdata B1: with `now`, a match that has started has no best price (the page may have been open since before the start). */
export function footballRows(matches: V3BoardMatch[], timeZone?: string, now?: Date): BoardRowVM[] {
  return matches.map((m) => {
    const lead = leadOutcome(m);
    const best = now && hasStarted(m.kickoff, now) ? null : bestOf(lead);
    return { kind: "football", m, lead, others: m.outcomes.filter((o) => o !== lead), best, day: dayKey(m.kickoff, timeZone) };
  });
}

/**
 * ui3 (Andrea, 07/10): nel tennis non diamo la nostra stima. Il giocatore in evidenza è quindi il
 * favorito del MERCATO (market_p più alta); senza le due probabilità di mercato resta il focus del contratto.
 */
export function tennisLead(m: V3BoardTennisMatch): V3BoardTennisSide {
  const [a, b] = m.sides;
  if (a && b && a.market_p != null && b.market_p != null && a.market_p !== b.market_p) return a.market_p > b.market_p ? a : b;
  return m.sides.find((x) => x.side === m.focus) ?? m.sides[0];
}

export function tennisRows(matches: V3BoardTennisMatch[], timeZone?: string, now?: Date): TennisRowVM[] {
  return matches.map((m) => {
    const lead = tennisLead(m);
    const best = now && hasStarted(m.kickoff, now) ? null : bestOf(lead);
    return { kind: "tennis", m, lead, best, day: dayKey(m.kickoff, timeZone) };
  });
}

/** fixdata B1: the board order — relevance tier (lib/v3c/fixdata.ts), then kick-off. */
export function sortByRelevance<T extends BoardRowVM | TennisRowVM>(rows: T[]): T[] {
  return [...rows].sort((a, b) => byRelevance(a.m, b.m));
}

/**
 * fixdata B1: the groups of the board, in order. A match that has started is never in a day group
 * (that is the pre-match list): «live» when the live feed has its score, «started» otherwise (no
 * price, no CTA). Days stay chronological; inside a day, relevance tier then kick-off.
 */
export function boardGroups<T extends BoardRowVM | TennisRowVM>(rows: T[], now: Date, hasLive: (id: string) => boolean): { day: string; rows: T[] }[] {
  const started = rows.filter((r) => hasStarted(r.m.kickoff, now));
  const live = started.filter((r) => hasLive(r.m.id));
  const rest = started.filter((r) => !hasLive(r.m.id));
  const days = groupByDay(rows.filter((r) => !hasStarted(r.m.kickoff, now))).map((g) => ({ day: g.day, rows: sortByRelevance(g.rows) }));
  return [
    ...(live.length ? [{ day: "live", rows: live }] : []),
    ...(rest.length ? [{ day: "started", rows: rest }] : []),
    ...days,
  ];
}

export function leagueOf(m: V3BoardMatch): string {
  return m.competition || m.league || "Football";
}

export function applyFilters<T extends BoardRowVM | TennisRowVM>(rows: T[], f: BoardFilters): T[] {
  return rows.filter((r) => {
    if (f.sport !== "all" && r.kind !== f.sport) return false;
    if (f.day !== "all" && r.day !== f.day) return false;
    if (f.league && (r.kind === "football" ? leagueOf(r.m) : r.m.tournament || "Tennis") !== f.league) return false;
    return true;
  });
}

/** I giorni presenti, ordinati, con il conteggio. */
export function daysOf(rows: (BoardRowVM | TennisRowVM)[]): { day: string; n: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.day, (map.get(r.day) ?? 0) + 1);
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, n]) => ({ day, n }));
}

/** Le leghe (o i tornei) presenti nello sport scelto, ordinate per numero di righe. */
export function leaguesOf(rows: (BoardRowVM | TennisRowVM)[]): { league: string; n: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = r.kind === "football" ? leagueOf(r.m) : r.m.tournament || "Tennis";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort(([a, na], [b, nb]) => nb - na || a.localeCompare(b)).map(([league, n]) => ({ league, n }));
}

export function groupByDay<T extends BoardRowVM | TennisRowVM>(rows: T[]): { day: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const list = map.get(r.day);
    if (list) list.push(r);
    else map.set(r.day, [r]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, rows]) => ({ day, rows }));
}

// ─── Lo stato vuoto a cascata ───────────────────────────────────────────────

export type EmptyCascade = {
  /** nessuna riga live in questo momento (sempre vero quando la cascata si mostra) */
  noLive: boolean;
  /** il gap assoluto più ampio fra le partite di oggi (fuso scelto) */
  biggestGap: BoardRowVM | null;
  /** la prossima partita a iniziare, con i millisecondi che mancano */
  next: { row: BoardRowVM | TennisRowVM; inMs: number } | null;
};

/**
 * Cosa mostrare quando il filtro corrente non ha righe. Si calcola su TUTTE le
 * righe (non su quelle filtrate): la cascata serve a portare altrove, non a
 * ripetere che qui non c'è niente.
 */
export function emptyCascade(all: (BoardRowVM | TennisRowVM)[], now: Date, timeZone?: string): EmptyCascade {
  const today = dayKey(now.toISOString(), timeZone);
  const live = all.some((r) => liveState(r.m.kickoff, now).live);
  const todays = all.filter((r): r is BoardRowVM => r.kind === "football" && r.day === today && r.lead.edge_pp != null);
  const biggestGap = todays.length ? todays.reduce((b, r) => (Math.abs(r.lead.edge_pp as number) > Math.abs(b.lead.edge_pp as number) ? r : b)) : null;
  const upcoming = all
    .map((row) => ({ row, inMs: Date.parse(row.m.kickoff) - now.getTime() }))
    .filter((x) => x.inMs > 0)
    .sort((a, b) => a.inMs - b.inMs);
  return { noLive: !live, biggestGap, next: upcoming[0] ?? null };
}

/** «2 h 14 min» / «38 min» / «3 d 5 h». */
export function countdown(ms: number, t: { hours: (h: number, m: number) => string; minutes: (m: number) => string; days: (d: number, h: number) => string }): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return t.days(d, h);
  if (h > 0) return t.hours(h, m);
  return t.minutes(m);
}

/** La partita d'esempio del banco: la prima di oggi con mercato e prezzo del feed; altrimenti la prima con mercato. */
export function benchMatch(matches: V3BoardMatch[], now: Date, timeZone?: string): V3BoardMatch | null {
  const today = dayKey(now.toISOString(), timeZone);
  const withMarket = matches.filter((m) => m.margin_removed != null && Date.parse(m.kickoff) > now.getTime());
  return withMarket.find((m) => dayKey(m.kickoff, timeZone) === today && bestOf(leadOutcome(m))) ?? withMarket.find((m) => bestOf(leadOutcome(m))) ?? withMarket[0] ?? null;
}
