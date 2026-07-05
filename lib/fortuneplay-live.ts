// lib/fortuneplay-live.ts
// Sorgente quote live FortunePlay/BetConstruct (#FORTUNEPLAY-LIVE-ODDS-1).
// Parse PER POSIZIONE (il `name` è localizzato). Odds = intero ÷ 1000.
import { teamPairKey, type PairSport } from "./team-pair-key";
import { normName } from "./odds-api";
import { canonicalPlayerKey } from "./tennis-names";

// Chiave normalizzata di un singolo lato, coerente con teamPairKey (sport a
// squadre→normName, sport a persone: tennis/mma→canonicalPlayerKey). Serve al
// FE per mappare la pick sulla quota del lato giusto: home/away di FortunePlay
// non coincidono per forza con home/away nostro.
function sideKey(sport: PairSport, name: string): string {
  return sport === "tennis" || sport === "mma" ? canonicalPlayerKey(name) : normName(name);
}

export type FpMatch = {
  teamPairKey: string;
  homeKey: string;
  awayKey: string;
  sport: PairSport;
  slug: string;
  id: number;
  urnId: string;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  totalLine: number | null;
  totalOver: number | null;
  totalUnder: number | null;
};

// #NEWSPORTS: baseball/mma inclusi dopo la verifica live di Andrea (2026-07-05,
// feed FortunePlay: MLB 35 match/81 mercati, UFC 32 match) — il vecchio set era
// un filtro nostro, non un limite del book. Coverage-agnostic a valle: i match
// extra restano nella cache e vengono consumati solo da chi li cerca per chiave.
const SPORTS = new Set(["soccer", "tennis", "baseball", "mma"]);

function odds(raw: unknown): number | null {
  const v = Number(raw) / 1000;
  return Number.isFinite(v) && v > 1 ? v : null;
}

function parseMatchResult(market: any): [number | null, number | null, number | null] {
  const o = market?.outcomes ?? [];
  if (o.length >= 3) return [odds(o[0]?.odds), odds(o[1]?.odds), odds(o[2]?.odds)];
  if (o.length === 2) return [odds(o[0]?.odds), null, odds(o[1]?.odds)];
  return [null, null, null];
}

function parseTotals(market: any): [number | null, number | null, number | null] {
  const o = market?.outcomes ?? [];
  const spec: string = market?.specifier ?? "";
  if (o.length !== 2 || !spec.includes("hcp=")) return [null, null, null];
  let line: number | null = null;
  for (const part of spec.split("|")) {
    if (part.startsWith("hcp=")) {
      const n = Number(part.split("=")[1]);
      if (!Number.isFinite(n)) return [null, null, null];
      line = n;
      break;
    }
  }
  return [line, odds(o[0]?.odds), odds(o[1]?.odds)];
}

export function parseFortuneplayMatches(payload: unknown): FpMatch[] {
  const data: any[] = (payload as any)?.data ?? [];
  const out: FpMatch[] = [];
  for (const m of data) {
    const sport: string | undefined = m?.tournament?.sport?.key;
    if (!sport || !SPORTS.has(sport)) continue;
    const home: string = m?.competitors?.home?.name ?? "";
    const away: string = m?.competitors?.away?.name ?? "";
    if (!home || !away) continue;
    const [oh, od, oa] = parseMatchResult(m?.main_market);
    if (oh === null && oa === null) continue;
    const key = teamPairKey(sport as PairSport, home, away, m?.start_time ?? null);
    if (!key) continue;
    const [line, over, under] = parseTotals(m?.secondary_market);
    const sp = sport as PairSport;
    out.push({
      teamPairKey: key,
      homeKey: sideKey(sp, home),
      awayKey: sideKey(sp, away),
      sport: sp,
      slug: String(m?.slug ?? ""),
      id: Number(m?.id),
      urnId: String(m?.urn_id ?? ""),
      oddsHome: oh, oddsDraw: od, oddsAway: oa,
      totalLine: line, totalOver: over, totalUnder: under,
    });
  }
  return out;
}

export function fpEdge(pPick: number, oddsDecimal: number | null): number | null {
  if (!oddsDecimal || oddsDecimal <= 1) return null;
  // Round to 10 decimal places to avoid floating-point drift (0.6*2.0-1 → 0.2).
  return Math.round((pPick * oddsDecimal - 1) * 1e10) / 1e10;
}

// --- fetch + TTL cache (append in lib/fortuneplay-live.ts) ---
const BASE = "https://www.fortuneplay.com/_sb_api/api/v2/matches";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  Accept: "application/json",
  Origin: "https://www.fortuneplay.com",
  Referer: "https://www.fortuneplay.com/it/sports",
};
const PAGE_LIMIT = 50;
const MAX_PAGES = 20; // cap anti-hammering (come lo scraper Python)
const TTL_MS = 30_000;

type Fetcher = (page: number) => Promise<unknown>;

async function defaultFetcher(page: number): Promise<unknown> {
  const qs = new URLSearchParams({
    bettable: "true", sport_type: "regular", sort_by: "bets_count:desc",
    limit: String(PAGE_LIMIT), page: String(page),
  });
  qs.append("match_status", "0");
  qs.append("match_status", "1");
  const resp = await fetch(`${BASE}?${qs.toString()}`, { headers: HEADERS });
  if (!resp.ok) throw new Error(`fortuneplay HTTP ${resp.status}`);
  return resp.json();
}

let _fetcher: Fetcher = defaultFetcher;
export function __setFpFetcherForTest(f: Fetcher) { _fetcher = f; }

let _cache: { at: number; map: Map<string, FpMatch> } | null = null;

export async function fetchFortuneplayBoard(now = Date.now()): Promise<Map<string, FpMatch>> {
  if (_cache && now - _cache.at < TTL_MS) return _cache.map;
  const map = new Map<string, FpMatch>();
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const payload: any = await _fetcher(page);
      for (const fm of parseFortuneplayMatches(payload)) map.set(fm.teamPairKey, fm);
      const last = payload?.pagination?.last_page ?? page;
      if (page >= last) break;
    }
    _cache = { at: now, map };
  } catch {
    if (_cache) return _cache.map; // su errore, riusa l'ultima buona
  }
  return map;
}
