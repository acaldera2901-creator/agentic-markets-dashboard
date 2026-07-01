// #FORTUNEPLAY-LIVE-ODDS-2 — "tutte le quote": mercati completi di una partita.
// Fetch dell'endpoint dettaglio /matches/{id}/markets SOLO all'apertura della
// scheda (non per-card), con TTL-cache per match → rispetta l'anti-hammering.
// Parse generico: {name, line, outcomes[{label, odds÷1000}]}. Odds intero÷1000.

export type FpFullMarket = {
  name: string;
  line: number | null;
  outcomes: Array<{ label: string; odds: number }>;
};

function odds(raw: unknown): number | null {
  const v = Number(raw) / 1000;
  return Number.isFinite(v) && v > 1 ? v : null;
}

function lineFromSpecifier(spec: string): number | null {
  for (const part of String(spec || "").split("|")) {
    if (part.startsWith("hcp=")) {
      const n = Number(part.split("=")[1]);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

export function parseFortuneplayMarkets(payload: unknown): FpFullMarket[] {
  const data: any[] = (payload as any)?.data ?? [];
  const out: FpFullMarket[] = [];
  for (const m of data) {
    if (m?.status !== 1) continue; // solo mercati attivi
    const name = String(m?.name ?? "").trim();
    if (!name) continue;
    const outcomes = (m?.outcomes ?? [])
      .map((o: any) => ({ label: String(o?.name ?? "").trim(), odds: odds(o?.odds) }))
      .filter((o: any): o is { label: string; odds: number } => o.label.length > 0 && o.odds != null);
    if (outcomes.length < 2) continue; // scarta mercati senza quote reali
    out.push({ name, line: lineFromSpecifier(m?.specifier ?? ""), outcomes });
  }
  return out;
}

// Cura un sottoinsieme ad alto valore dai 298 mercati grezzi (mostrarli tutti =
// UX pessima). Ordine = priorità di visualizzazione nella scheda. Nomi dal feed FP.
export function curateMarkets(markets: FpFullMarket[]): FpFullMarket[] {
  const norm = (s: string) => s.toLowerCase().trim();
  const first = (pred: (m: FpFullMarket) => boolean) => markets.find(pred);
  const out: FpFullMarket[] = [];
  const add = (m?: FpFullMarket) => { if (m && !out.includes(m)) out.push(m); };

  add(first((m) => norm(m.name) === "double chance"));
  add(first((m) => norm(m.name) === "draw no bet"));
  add(first((m) => norm(m.name) === "both teams to score"));
  // linee gol chiave (evita di listarle tutte)
  for (const line of [1.5, 2.5, 3.5]) add(first((m) => norm(m.name) === "total goals" && m.line === line));
  add(first((m) => norm(m.name) === "total goals odd/even"));
  add(first((m) => norm(m.name) === "1st half result"));
  // SOFT con quote FortunePlay reali (corner/cartellini)
  add(first((m) => /^corners: total$/i.test(m.name) && m.line != null));
  add(first((m) => /total.*(cards|red cards|yellow)/i.test(m.name) && m.line != null));
  return out;
}

// ---- fetch + TTL cache per match ----
const BASE = "https://www.fortuneplay.com/_sb_api/api/v2/matches";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  Accept: "application/json",
  Origin: "https://www.fortuneplay.com",
  Referer: "https://www.fortuneplay.com/it/sports",
};
const MAX_PAGES = 6;
const TTL_MS = 60_000;

type Fetcher = (id: number, page: number) => Promise<unknown>;
async function defaultFetcher(id: number, page: number): Promise<unknown> {
  const resp = await fetch(`${BASE}/${id}/markets?limit=50&page=${page}`, { headers: HEADERS });
  if (!resp.ok) throw new Error(`fortuneplay match HTTP ${resp.status}`);
  return resp.json();
}
let _fetcher: Fetcher = defaultFetcher;
export function __setFpMatchFetcherForTest(f: Fetcher) { _fetcher = f; }

const _cache = new Map<number, { at: number; markets: FpFullMarket[] }>();

export async function fetchFortuneplayMatchMarkets(id: number, now = Date.now()): Promise<FpFullMarket[]> {
  const hit = _cache.get(id);
  if (hit && now - hit.at < TTL_MS) return hit.markets;
  const markets: FpFullMarket[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const payload: any = await _fetcher(id, page);
      markets.push(...parseFortuneplayMarkets(payload));
      const last = payload?.pagination?.last_page ?? page;
      if (page >= last) break;
    }
    _cache.set(id, { at: now, markets });
  } catch {
    if (hit) return hit.markets;
  }
  return markets;
}
