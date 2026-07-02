// #MULTIBOOK-1 — Feed board generalizzato per qualsiasi book BetConstruct.
// Riusa parseFortuneplayMatches (book-agnostico) su base+prefix per-book.
// TTL-cache per-book, best-effort: un book che fallisce ritorna mappa vuota
// e NON rompe gli altri (il live degrada al/ai book disponibili).
import { parseFortuneplayMatches, type FpMatch } from "./fortuneplay-live";
import { BOOKS, type BookConfig } from "./betconstruct-books";

const PAGE_LIMIT = 50;
const MAX_PAGES = 20; // cap anti-hammering
const TTL_MS = 30_000;

function headers(book: BookConfig) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    Accept: "application/json",
    Origin: book.base,
    Referer: `${book.base}/it/sports`,
  };
}

type Fetcher = (book: BookConfig, page: number) => Promise<unknown>;
async function defaultFetcher(book: BookConfig, page: number): Promise<unknown> {
  const qs = new URLSearchParams({
    bettable: "true", sport_type: "regular", sort_by: "bets_count:desc",
    limit: String(PAGE_LIMIT), page: String(page),
  });
  qs.append("match_status", "0");
  qs.append("match_status", "1");
  const resp = await fetch(`${book.base}${book.apiPrefix}/matches?${qs.toString()}`, { headers: headers(book) });
  if (!resp.ok) throw new Error(`${book.key} HTTP ${resp.status}`);
  return resp.json();
}
let _fetcher: Fetcher = defaultFetcher;
export function __setBookFetcherForTest(f: Fetcher) { _fetcher = f; }

const _cache = new Map<string, { at: number; map: Map<string, FpMatch> }>();
const _refreshing = new Set<string>();

async function _refreshBook(book: BookConfig, now: number): Promise<Map<string, FpMatch>> {
  const map = new Map<string, FpMatch>();
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const payload: any = await _fetcher(book, page);
      for (const fm of parseFortuneplayMatches(payload)) map.set(fm.teamPairKey, fm);
      const last = payload?.pagination?.last_page ?? page;
      if (page >= last) break;
    }
    _cache.set(book.key, { at: now, map });
    return map;
  } catch {
    const hit = _cache.get(book.key);
    return hit ? hit.map : map; // riusa l'ultima buona su errore
  }
}

export async function fetchBookBoard(book: BookConfig, now = Date.now()): Promise<Map<string, FpMatch>> {
  const hit = _cache.get(book.key);
  if (hit && now - hit.at < TTL_MS) return hit.map;
  // #PERF-ODDS-0702: serve-stale-while-revalidate. Se esiste una copia (anche
  // scaduta) la ritorniamo SUBITO e aggiorniamo in background (una sola rivalida
  // per book alla volta). Solo il primissimo caricamento a freddo attende.
  if (hit) {
    if (!_refreshing.has(book.key)) {
      _refreshing.add(book.key);
      void _refreshBook(book, now).finally(() => _refreshing.delete(book.key));
    }
    return hit.map;
  }
  return _refreshBook(book, now);
}

export type BookBoard = { book: BookConfig; map: Map<string, FpMatch> };

// Tutti i book in parallelo, best-effort (errore → mappa vuota, non propaga).
export async function fetchAllBooks(now = Date.now()): Promise<BookBoard[]> {
  return Promise.all(
    BOOKS.map(async (book) => ({ book, map: await fetchBookBoard(book, now).catch(() => new Map<string, FpMatch>()) })),
  );
}
