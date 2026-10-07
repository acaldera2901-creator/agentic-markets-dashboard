// /api/v3/board — one row per published football match, market / model /
// estimate / edge separated, plus real prices from the feed books only.
import { enabledPriceBooks, priceBookByKey, type PriceBook } from "@/lib/price-books";
import { buildFortuneplayMatchUrl } from "@/lib/fortuneplay-url";
import { normName } from "@/lib/odds-api";
import { teamPairKey } from "@/lib/team-pair-key";
import type { FpMatch } from "@/lib/fortuneplay-live";
import { fuzzyFootballMatch, type OurFixture } from "./fixture-match";
import type { Outcome, Triple, V3BoardMatch, V3BoardOutcome, V3BookPrice } from "./contracts";
import { MARKET_WEIGHT, MODEL_WEIGHT, OUTCOMES, edgePp, market1x2, roundP, topOutcome } from "./prob";
import { feedMapAt } from "@/lib/feed-stamp";
import { applyGuard, hasStarted, modelGuard, relevanceTier, type ModelGuard } from "./fixdata";
import { bookImpliedMarket, fairFarFromBest, saneMarketSet, sanePrice, storedMarketTrusted } from "./fixdata2";

/** Latest prediction_log row of a published match (+ seal time from pick_ledger). */
export type BoardSourceRow = {
  id: string;
  league: string | null;
  competition: string | null;
  kickoff: string;
  home: string;
  away: string;
  computed_at: string;
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
  model_p_home: number | null;
  model_p_draw: number | null;
  model_p_away: number | null;
  /** served (blended) probabilities */
  p_home: number;
  p_draw: number;
  p_away: number;
  sealed_at: string | null;
};

/**
 * A feed-book price for a fixture: from the live BetConstruct feed
 * (lib/betconstruct-feed.ts) or, when a book's feed is down, the latest
 * partner_price_history capture.
 */
export type PartnerPriceRow = {
  team_pair_key: string;
  bookmaker: string;
  home_name: string;
  away_name: string;
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
  captured_at: string;
  source?: "live_feed" | "price_history";
  /** deep-link when the book has a known match page; else the affiliate landing is used */
  url?: string;
};

/**
 * A history price older than this is not shown as current. partner_price_history
 * is written every 120 min (measured 05/10: runs at :01 of every even hour), so
 * one run + 30 min of slack; anything older means the writer has stopped.
 */
export const BOOK_PRICE_MAX_AGE_MIN = 150;

export function footballPairKey(r: { home: string; away: string; kickoff: string }): string | null {
  return teamPairKey("soccer", r.home, r.away, new Date(r.kickoff).toISOString());
}

/**
 * Map a partner row onto OUR home/away. The pair key is orientation-free
 * (sorted names), so a book listing the fixture the other way round would
 * otherwise put its away price on our home outcome. null = names don't match.
 */
export function orientPartnerPrice(
  ours: { home: string; away: string },
  row: PartnerPriceRow,
  norm: (name: string) => string = normName,
): { home: number | null; draw: number | null; away: number | null } | null {
  const oh = norm(ours.home);
  const oa = norm(ours.away);
  const ph = norm(row.home_name);
  const pa = norm(row.away_name);
  if (ph === oh || pa === oa) return { home: row.odds_home, draw: row.odds_draw, away: row.odds_away };
  if (ph === oa || pa === oh) return { home: row.odds_away, draw: row.odds_draw, away: row.odds_home };
  return null;
}

function validPrice(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x) && x > 1;
}

/**
 * Max books listed per outcome in the comparison (sorted by price, best first).
 * Today at most 6 partners can carry a price (lib/price-books.ts).
 */
export const COMPARE_MAX_BOOKS = 6;

/** Book prices per outcome: enabled price books only, fresh only, oriented to our fixture. */
export function bookPricesFor(
  ours: { home: string; away: string },
  rows: PartnerPriceRow[],
  now: Date,
  norm: (name: string) => string = normName,
): Record<Outcome, V3BookPrice[]> {
  const out: Record<Outcome, V3BookPrice[]> = { home: [], draw: [], away: [] };
  const maxAgeMs = BOOK_PRICE_MAX_AGE_MIN * 60_000;
  for (const row of rows) {
    const book = priceBookByKey(row.bookmaker);
    if (!book) continue; // not an enabled price book (or no affiliate link) → never a price
    if (now.getTime() - Date.parse(row.captured_at) > maxAgeMs) continue;
    const oriented = orientPartnerPrice(ours, row, norm);
    if (!oriented) continue;
    // fixdata2 N10: a book whose own set of prices is impossible (overround < 0 or > 25%) gives no price here;
    // a single impossible price (implied outside 0.5–99%) is dropped, the match stays
    const legs = [oriented.home, oriented.draw, oriented.away].filter((x): x is number => x != null);
    if (legs.length >= 2 && legs.every(validPrice) && !saneMarketSet(legs)) continue;
    for (const o of OUTCOMES) {
      const price = oriented[o];
      if (!validPrice(price) || !sanePrice(price)) continue;
      out[o].push({
        bookmaker: book.key,
        name: book.name,
        price,
        captured_at: row.captured_at,
        source: row.source ?? "price_history",
        url: row.url ?? book.landing,
      });
    }
  }
  for (const o of OUTCOMES) {
    out[o].sort((a, b) => b.price - a.price || a.bookmaker.localeCompare(b.bookmaker));
    out[o] = out[o].slice(0, COMPARE_MAX_BOOKS);
  }
  return out;
}

export function buildBoardMatch(src: BoardSourceRow, partner: PartnerPriceRow[], now: Date): V3BoardMatch {
  // fixdata B1: once the match has started a pre-match price is not a price — no book, no best, no CTA
  const prices = hasStarted(src.kickoff, now) ? { home: [], draw: [], away: [] } : bookPricesFor(src, partner, now);
  const storedPrices = [src.odds_home, src.odds_draw, src.odds_away];
  const stored = market1x2({ home: src.odds_home, draw: src.odds_draw, away: src.odds_away });
  // fixdata2 N3/N10: the partner books' own market (real prices with a link), the reference when the stored
  // market is missing, impossible, or farther than 15 pp from it
  const books = bookImpliedMarket([prices.home, prices.draw, prices.away]);
  const trusted = storedMarketTrusted(storedPrices, stored ? [stored.p.home, stored.p.draw, stored.p.away] : null, books);
  const fromBooks = !trusted && books != null;
  const market: { p: Triple; margin: number } | null = trusted && stored
    ? stored
    : books
      ? { p: { home: books.p[0], draw: books.p[1], away: books.p[2] }, margin: books.margin }
      : null;
  const model: Triple | null =
    src.model_p_home != null && src.model_p_draw != null && src.model_p_away != null
      ? { home: src.model_p_home, draw: src.model_p_draw, away: src.model_p_away }
      : null;
  // Without a stored market the pipeline served the model alone (p = model): the raw model is that number.
  const rawModel: Triple | null = model ?? (stored ? null : { home: src.p_home, draw: src.p_draw, away: src.p_away });
  // The served blend when it was made with the market shown; with the books' market, the same declared blend on it.
  const estimate: Triple =
    trusted || !market
      ? { home: src.p_home, draw: src.p_draw, away: src.p_away }
      : rawModel
        ? {
            home: MODEL_WEIGHT * rawModel.home + MARKET_WEIGHT * market.p.home,
            draw: MODEL_WEIGHT * rawModel.draw + MARKET_WEIGHT * market.p.draw,
            away: MODEL_WEIGHT * rawModel.away + MARKET_WEIGHT * market.p.away,
          }
        : market.p;
  const priceOf: Record<Outcome, number | null> = fromBooks
    ? { home: prices.home[0]?.price ?? null, draw: prices.draw[0]?.price ?? null, away: prices.away[0]?.price ?? null }
    : { home: src.odds_home, draw: src.odds_draw, away: src.odds_away };

  const raw: V3BoardOutcome[] = OUTCOMES.map((o) => ({
    outcome: o,
    market_price: market ? priceOf[o] : null,
    market_p: market ? roundP(market.p[o]) : null,
    model_p: rawModel ? roundP(rawModel[o]) : null,
    estimate_p: roundP(estimate[o]),
    edge_pp: market ? edgePp(estimate[o], market.p[o]) : null,
    book_prices: prices[o],
    best_price: prices[o][0] ?? null,
  }));
  // fixdata B5: the raw model against the market; > 25 pp the estimate shown is the market
  let guard: ModelGuard = market ? modelGuard(raw) : { level: "no_market", delta_pp: null, reason: "no_market" };
  // fixdata2 N3: the estimate's fair price far from the best real price → the market only, no fair price
  // (read on the lead outcome — the widest gap, the one the page puts beside the book button — as the board does)
  const withGap = raw.filter((o) => o.edge_pp != null);
  const lead = withGap.length ? withGap.reduce((b, o) => (Math.abs(o.edge_pp as number) > Math.abs(b.edge_pp as number) ? o : b)) : raw[OUTCOMES.indexOf(topOutcome(estimate))];
  if (guard.level !== "market_only" && guard.level !== "no_market" && fairFarFromBest([lead])) guard = { level: "market_only", delta_pp: guard.delta_pp, reason: "price_far" };
  const outcomes = applyGuard(raw, guard);
  const shown: Triple = { home: outcomes[0].estimate_p, draw: outcomes[1].estimate_p, away: outcomes[2].estimate_p };

  return {
    id: src.id,
    sport: "football",
    league: src.league,
    competition: src.competition,
    kickoff: new Date(src.kickoff).toISOString(),
    home: src.home,
    away: src.away,
    market: "1X2",
    margin_removed: market ? roundP(market.margin) : null,
    blend: market ? { model: MODEL_WEIGHT, market: MARKET_WEIGHT } : null,
    estimate_as_of: new Date(src.computed_at).toISOString(),
    sealed_at: src.sealed_at ? new Date(src.sealed_at).toISOString() : null,
    focus: topOutcome(guard.level === "market_only" ? shown : estimate),
    outcomes,
    relevance: relevanceTier({ sport: "football", competition: src.competition, league: src.league }),
    model_guard: guard,
    market_from: market ? (fromBooks ? "books" : "stored") : null,
  };
}

/**
 * Rows for `keys` from the live feed. Books whose live map came back empty
 * (feed down) are returned in `missingBooks`, for the history fallback.
 * `fixtures` (football key → our fixture) enables the strict name-tolerant
 * join for Altenar books (lib/v3c/fixture-match.ts); a fuzzy hit carries OUR
 * names, oriented as the book lists them, so orientPartnerPrice still works.
 */
export function liveFeedRows(
  boards: { book: Pick<PriceBook, "key" | "landing" | "matchUrlBase" | "stag"> & { platform?: PriceBook["platform"] }; map: Map<string, FpMatch> }[],
  keys: Set<string>,
  now: Date,
  fixtures?: Map<string, OurFixture>,
): { rows: PartnerPriceRow[]; missingBooks: string[] } {
  const rows: PartnerPriceRow[] = [];
  const missingBooks: string[] = [];
  for (const { book, map } of boards) {
    // fixdata B2: the time the book's feed was read (a cached or last-good copy can be old), not now
    const readAt = new Date(feedMapAt(map) ?? now.getTime()).toISOString();
    if (map.size === 0) {
      missingBooks.push(book.key);
      continue;
    }
    for (const key of keys) {
      let fm = map.get(key);
      let names = fm ? { home: fm.homeName, away: fm.awayName } : null;
      const ours = fixtures?.get(key);
      if (!fm && ours && book.platform === "altenar") {
        const hit = fuzzyFootballMatch(map, ours);
        if (hit) {
          fm = hit.fm;
          names = hit.swapped ? { home: ours.away, away: ours.home } : { home: ours.home, away: ours.away };
        }
      }
      if (!fm || !names) continue;
      rows.push({
        team_pair_key: key,
        bookmaker: book.key,
        home_name: names.home,
        away_name: names.away,
        odds_home: fm.oddsHome,
        odds_draw: fm.oddsDraw,
        odds_away: fm.oddsAway,
        captured_at: readAt,
        source: "live_feed",
        url:
          book.matchUrlBase && fm.slug && fm.id && fm.sport
            ? buildFortuneplayMatchUrl({ baseUrl: book.matchUrlBase, locale: "en", sport: fm.sport, slug: fm.slug, id: fm.id, code: book.stag ?? "" })
            : book.landing,
      });
    }
  }
  return { rows, missingBooks };
}

/** Enabled price books, for the coverage block (read at call time: the gate is an env var). */
export function feedBookKeys(): string[] {
  return enabledPriceBooks().map((b) => b.key);
}
