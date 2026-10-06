// #V3C-PARTNERS (F7) — adapter generico per il widget pubblico Altenar.
// Normalizza verso lo stesso FpMatch del feed BetConstruct, quindi a valle
// (board, collector di partner_price_history) un book Altenar è indistinguibile
// da FortunePlay: stessa teamPairKey, stessi campi oddsHome/Draw/Away.
//
// Modello relazionale del payload (misurato 06/10/2026, fixture in
// tests/fixtures/partners/):
//   events[]{id, competitorIds:[home, away], startDate, sportId, marketIds, extId}
//   markets[]{id, typeId, oddIds}     odds[]{id, typeId, price, competitorId}
//   competitors[]{id, name}
// Calcio: market typeId 1 (1x2), odd typeId 1/2/3 = casa/pareggio/ospite.
// Tennis: market typeId 186 (Winner), odd typeId 1/3 = giocatore 1/2.
// Prezzi decimali (es. 3.3334): si tengono come arrivano, si arrotonda a video.
// Quota sospesa (oddStatus ≠ 0, prezzo 0): la partita salta, niente 1X2 a metà.
//
// Carico: 2 GET per book per giro (calcio + tennis, ~2,4 MB + ~0,5 MB),
// cache 5 minuti con stale-while-revalidate e al massimo una richiesta Altenar
// in volo, distanziata di MIN_GAP_MS dalla precedente. User-agent
// identificabile: chi gestisce il widget sa chi siamo e come contattarci.
import { normName } from "./odds-api";
import { canonicalPlayerKey } from "./tennis-names";
import { teamPairKey, type PairSport } from "./team-pair-key";
import type { FpMatch } from "./fortuneplay-live";
import { ALTENAR_BOOKS, type AltenarBook } from "./altenar-books";

export const ALTENAR_USER_AGENT =
  "BetRedgePriceBot/1.0 (+https://betredge.com; partner price comparison; read-only)";
const TTL_MS = 5 * 60_000;
const MIN_GAP_MS = 1_500;
const TIMEOUT_MS = 20_000;

const SPORT_IDS: Record<number, PairSport> = { 66: "soccer", 68: "tennis" };
const MARKET_1X2 = 1;
const MARKET_WINNER = 186;
const ODD_HOME = 1;
const ODD_DRAW = 2;
const ODD_AWAY = 3;

type RawEvent = { id?: unknown; competitorIds?: unknown[]; startDate?: string; sportId?: number; marketIds?: unknown[]; extId?: unknown };
type RawMarket = { id?: unknown; typeId?: number; oddIds?: unknown[] };
type RawOdd = { id?: unknown; typeId?: number; price?: unknown; competitorId?: unknown; oddStatus?: number };
type RawCompetitor = { id?: unknown; name?: string };
type RawPayload = { events?: RawEvent[]; markets?: RawMarket[]; odds?: RawOdd[]; competitors?: RawCompetitor[] };

function price(raw: unknown): number | null {
  const v = Number(raw);
  return Number.isFinite(v) && v > 1 ? v : null;
}

function sideKey(sport: PairSport, name: string): string {
  return sport === "tennis" || sport === "mma" ? canonicalPlayerKey(name) : normName(name);
}

/** Altenar GetEvents payload → FpMatch[] (match result only). Pure. */
export function parseAltenarEvents(payload: unknown): FpMatch[] {
  const p = (payload ?? {}) as RawPayload;
  const markets = new Map((p.markets ?? []).map((m) => [String(m.id), m]));
  const odds = new Map((p.odds ?? []).map((o) => [String(o.id), o]));
  const names = new Map((p.competitors ?? []).map((c) => [String(c.id), c.name ?? ""]));
  const out: FpMatch[] = [];
  for (const ev of p.events ?? []) {
    const sport = SPORT_IDS[Number(ev.sportId)];
    if (!sport) continue;
    const cids = ev.competitorIds ?? [];
    if (cids.length < 2) continue;
    const [homeId, awayId] = [String(cids[0]), String(cids[1])];
    const home = names.get(homeId) ?? "";
    const away = names.get(awayId) ?? "";
    if (!home || !away) continue;
    const want = sport === "soccer" ? MARKET_1X2 : MARKET_WINNER;
    const market = (ev.marketIds ?? []).map((id) => markets.get(String(id))).find((m) => m?.typeId === want);
    if (!market) continue;
    let oh: number | null = null;
    let od: number | null = null;
    let oa: number | null = null;
    for (const id of market.oddIds ?? []) {
      const o = odds.get(String(id));
      if (!o) continue;
      // oddStatus ≠ 0 = suspended/closed (seen: status 7 with price 0) → no price.
      if (o.oddStatus != null && o.oddStatus !== 0) continue;
      // typeId first; competitorId as a cross-check fallback for a feed that
      // omits the odd type.
      const cid = o.competitorId == null ? null : String(o.competitorId);
      if (o.typeId === ODD_HOME || (o.typeId == null && cid === homeId)) oh = price(o.price);
      else if (o.typeId === ODD_AWAY || (o.typeId == null && cid === awayId)) oa = price(o.price);
      else if (o.typeId === ODD_DRAW) od = price(o.price);
    }
    if (oh === null || oa === null) continue;
    if (sport === "soccer" && od === null) continue; // a 1X2 without X is not a 1X2
    const start = typeof ev.startDate === "string" ? ev.startDate : null;
    const key = teamPairKey(sport, home, away, start);
    if (!key) continue;
    out.push({
      teamPairKey: key,
      homeKey: sideKey(sport, home),
      awayKey: sideKey(sport, away),
      sport,
      slug: "",
      id: Number(ev.id),
      urnId: String(ev.extId ?? ""),
      oddsHome: oh,
      oddsDraw: sport === "soccer" ? od : null,
      oddsAway: oa,
      totalLine: null,
      totalOver: null,
      totalUnder: null,
      homeName: home,
      awayName: away,
      startTime: start,
    });
  }
  return out;
}

export function altenarEventsUrl(book: AltenarBook, sportId: number): string {
  const qs = new URLSearchParams({
    culture: "en-GB",
    timezoneOffset: "0",
    integration: book.integration,
    deviceType: "1",
    numFormat: "en-GB",
    countryCode: "DE",
    sportId: String(sportId),
    eventCount: "0",
  });
  return `${book.widgetBase}/api/widget/GetEvents?${qs.toString()}`;
}

type Fetcher = (url: string) => Promise<unknown>;

// One Altenar request at a time, MIN_GAP_MS apart (all books share the host).
let _queue: Promise<unknown> = Promise.resolve();
let _lastAt = 0;
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = _queue.then(async () => {
    const wait = _lastAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await fn();
    } finally {
      _lastAt = Date.now();
    }
  });
  _queue = run.catch(() => undefined);
  return run;
}

async function defaultFetcher(url: string): Promise<unknown> {
  return throttled(async () => {
    const resp = await fetch(url, {
      headers: { "User-Agent": ALTENAR_USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) throw new Error(`altenar HTTP ${resp.status}`);
    return resp.json();
  });
}
let _fetcher: Fetcher = defaultFetcher;
export function __setAltenarFetcherForTest(f: Fetcher | null) {
  _fetcher = f ?? defaultFetcher;
  _cache.clear();
  _refreshing.clear();
}

const _cache = new Map<string, { at: number; map: Map<string, FpMatch> }>();
const _refreshing = new Set<string>();

async function refresh(book: AltenarBook, now: number): Promise<Map<string, FpMatch>> {
  const map = new Map<string, FpMatch>();
  let ok = 0;
  for (const sportId of Object.keys(SPORT_IDS).map(Number)) {
    try {
      for (const m of parseAltenarEvents(await _fetcher(altenarEventsUrl(book, sportId)))) map.set(m.teamPairKey, m);
      ok += 1;
    } catch { /* best-effort per sport */ }
  }
  if (ok === 0) return _cache.get(book.key)?.map ?? map; // all down → last good copy
  _cache.set(book.key, { at: now, map });
  return map;
}

/** Same contract as fetchBookBoard: cached, stale-while-revalidate, never throws. */
export async function fetchAltenarBoard(book: AltenarBook, now = Date.now()): Promise<Map<string, FpMatch>> {
  const hit = _cache.get(book.key);
  if (hit && now - hit.at < TTL_MS) return hit.map;
  if (hit) {
    if (!_refreshing.has(book.key)) {
      _refreshing.add(book.key);
      void refresh(book, now).finally(() => _refreshing.delete(book.key));
    }
    return hit.map;
  }
  return refresh(book, now);
}

export function altenarBookByKey(key: string): AltenarBook | undefined {
  return ALTENAR_BOOKS.find((b) => b.key === key);
}
