// /api/v3/board — one row per published football match, market / model /
// estimate / edge separated, plus real prices from the feed books only.
import { BOOKS, bookByKey } from "@/lib/betconstruct-books";
import type { BookBoard } from "@/lib/betconstruct-feed";
import { buildFortuneplayMatchUrl } from "@/lib/fortuneplay-url";
import { normName } from "@/lib/odds-api";
import { PARTNER_FEED_TOURNAMENT, probabilitySourceOf } from "@/lib/partner-market";
import { teamPairKey } from "@/lib/team-pair-key";
import { canonicalPlayerKey } from "@/lib/tennis-names";
import type { Outcome, Triple, V3BoardMatch, V3BoardOutcome, V3BoardTennisMatch, V3BoardTennisOutcome, V3BookPrice } from "./contracts";
import { MARKET_WEIGHT, MODEL_WEIGHT, OUTCOMES, edgePp, market1x2, roundP, topOutcome } from "./prob";

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
): { home: number | null; draw: number | null; away: number | null } | null {
  const oh = normName(ours.home);
  const oa = normName(ours.away);
  const ph = normName(row.home_name);
  const pa = normName(row.away_name);
  if (ph === oh || pa === oa) return { home: row.odds_home, draw: row.odds_draw, away: row.odds_away };
  if (ph === oa || pa === oh) return { home: row.odds_away, draw: row.odds_draw, away: row.odds_home };
  return null;
}

function validPrice(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x) && x > 1;
}

/** Book prices per outcome: feed books only, fresh only, oriented to our fixture. */
export function bookPricesFor(
  ours: { home: string; away: string },
  rows: PartnerPriceRow[],
  now: Date,
): Record<Outcome, V3BookPrice[]> {
  const out: Record<Outcome, V3BookPrice[]> = { home: [], draw: [], away: [] };
  const maxAgeMs = BOOK_PRICE_MAX_AGE_MIN * 60_000;
  for (const row of rows) {
    const book = bookByKey(row.bookmaker);
    if (!book) continue; // not a feed book → never a price
    if (now.getTime() - Date.parse(row.captured_at) > maxAgeMs) continue;
    const oriented = orientPartnerPrice(ours, row);
    if (!oriented) continue;
    for (const o of OUTCOMES) {
      const price = oriented[o];
      if (!validPrice(price)) continue;
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
  for (const o of OUTCOMES) out[o].sort((a, b) => b.price - a.price || a.bookmaker.localeCompare(b.bookmaker));
  return out;
}

export function buildBoardMatch(src: BoardSourceRow, partner: PartnerPriceRow[], now: Date): V3BoardMatch {
  const market = market1x2({ home: src.odds_home, draw: src.odds_draw, away: src.odds_away });
  const estimate: Triple = { home: src.p_home, draw: src.p_draw, away: src.p_away };
  const model: Triple | null =
    src.model_p_home != null && src.model_p_draw != null && src.model_p_away != null
      ? { home: src.model_p_home, draw: src.model_p_draw, away: src.model_p_away }
      : null;
  const prices = bookPricesFor(src, partner, now);
  const priceOf: Record<Outcome, number | null> = {
    home: src.odds_home, draw: src.odds_draw, away: src.odds_away,
  };

  const outcomes: V3BoardOutcome[] = OUTCOMES.map((o) => ({
    outcome: o,
    market_price: market ? priceOf[o] : null,
    market_p: market ? roundP(market.p[o]) : null,
    model_p: model ? roundP(model[o]) : null,
    estimate_p: roundP(estimate[o]),
    edge_pp: market ? edgePp(estimate[o], market.p[o]) : null,
    book_prices: prices[o],
    best_price: prices[o][0] ?? null,
  }));

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
    focus: topOutcome(estimate),
    outcomes,
  };
}

/**
 * Rows for `keys` from the live feed. Books whose live map came back empty
 * (feed down) are returned in `missingBooks`, for the history fallback.
 */
export function liveFeedRows(
  boards: BookBoard[],
  keys: Set<string>,
  now: Date,
): { rows: PartnerPriceRow[]; missingBooks: string[] } {
  const rows: PartnerPriceRow[] = [];
  const missingBooks: string[] = [];
  for (const { book, map } of boards) {
    if (map.size === 0) {
      missingBooks.push(book.key);
      continue;
    }
    for (const key of keys) {
      const fm = map.get(key);
      if (!fm) continue;
      rows.push({
        team_pair_key: key,
        bookmaker: book.key,
        home_name: fm.homeName,
        away_name: fm.awayName,
        odds_home: fm.oddsHome,
        odds_draw: fm.oddsDraw,
        odds_away: fm.oddsAway,
        captured_at: now.toISOString(),
        source: "live_feed",
        url:
          book.matchUrlBase && fm.slug && fm.id && fm.sport
            ? buildFortuneplayMatchUrl({ baseUrl: book.matchUrlBase, locale: "en", sport: fm.sport, slug: fm.slug, id: fm.id, code: book.stag })
            : book.landing,
      });
    }
  }
  return { rows, missingBooks };
}

/** Feed books, for the coverage block. */
export const FEED_BOOK_KEYS = BOOKS.map((b) => b.key);

// ─── Tennis (F3) ────────────────────────────────────────────────────────────
// A published tennis row of the window: the served p1/p2, the stored prices,
// the model version (partner-market-v1 = the probability is the market itself).

export type TennisSourceRow = {
  id: string;
  tournament: string | null;
  surface: string | null;
  scheduled: string;
  player1: string;
  player2: string;
  p1: number;
  p2: number;
  odds_p1: number | null;
  odds_p2: number | null;
  model_version: string | null;
  computed_at: string | null;
  sealed_at: string | null;
};

export function tennisPairKey(r: { player1: string; player2: string; scheduled: string }): string | null {
  const d = new Date(r.scheduled);
  if (Number.isNaN(d.getTime())) return null;
  return teamPairKey("tennis", r.player1, r.player2, d.toISOString());
}

/** Same as orientPartnerPrice, on player keys (the pair key is orientation-free). */
export function orientTennisPrice(
  ours: { player1: string; player2: string },
  row: PartnerPriceRow,
): { home: number | null; away: number | null } | null {
  const o1 = canonicalPlayerKey(ours.player1);
  const o2 = canonicalPlayerKey(ours.player2);
  const p1 = canonicalPlayerKey(row.home_name);
  const p2 = canonicalPlayerKey(row.away_name);
  if (!o1 || !o2 || !p1 || !p2) return null;
  if (p1 === o1 || p2 === o2) return { home: row.odds_home, away: row.odds_away };
  if (p1 === o2 || p2 === o1) return { home: row.odds_away, away: row.odds_home };
  return null;
}

function tennisBookPrices(src: TennisSourceRow, rows: PartnerPriceRow[], now: Date): Record<"home" | "away", V3BookPrice[]> {
  const out: Record<"home" | "away", V3BookPrice[]> = { home: [], away: [] };
  const maxAgeMs = BOOK_PRICE_MAX_AGE_MIN * 60_000;
  for (const row of rows) {
    const book = bookByKey(row.bookmaker);
    if (!book) continue;
    if (now.getTime() - Date.parse(row.captured_at) > maxAgeMs) continue;
    const oriented = orientTennisPrice(src, row);
    if (!oriented) continue;
    for (const o of ["home", "away"] as const) {
      const price = oriented[o];
      if (!validPrice(price)) continue;
      out[o].push({ bookmaker: book.key, name: book.name, price, captured_at: row.captured_at, source: row.source ?? "price_history", url: row.url ?? book.landing });
    }
  }
  for (const o of ["home", "away"] as const) out[o].sort((a, b) => b.price - a.price || a.bookmaker.localeCompare(b.bookmaker));
  return out;
}

export function buildTennisMatch(src: TennisSourceRow, partner: PartnerPriceRow[], now: Date): V3BoardTennisMatch {
  const prices = tennisBookPrices(src, partner, now);
  const tournament = (src.tournament ?? "").trim();
  const outcomes: V3BoardTennisOutcome[] = (["home", "away"] as const).map((o) => ({
    outcome: o,
    estimate_p: roundP(o === "home" ? src.p1 : src.p2),
    market_price: o === "home" ? src.odds_p1 : src.odds_p2,
    book_prices: prices[o],
    best_price: prices[o][0] ?? null,
  }));
  return {
    id: src.id,
    sport: "tennis",
    tournament: !tournament || tournament === PARTNER_FEED_TOURNAMENT ? null : tournament,
    surface: src.surface ? src.surface.toUpperCase() : null,
    kickoff: new Date(src.scheduled).toISOString(),
    home: src.player1,
    away: src.player2,
    market: "winner",
    estimate_source: probabilitySourceOf(src.model_version),
    model_version: src.model_version,
    estimate_as_of: src.computed_at ? new Date(src.computed_at).toISOString() : null,
    sealed_at: src.sealed_at ? new Date(src.sealed_at).toISOString() : null,
    focus: src.p1 >= src.p2 ? "home" : "away",
    outcomes,
  };
}
