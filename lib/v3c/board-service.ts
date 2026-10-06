// The board, assembled: what GET /api/v3/board returns, callable from a Server
// Component too (the home and /predictions render the SAME payload server-side
// instead of fetching themselves over HTTP). One function, one payload.
// Tennis (v3.board.2) comes from lib/v3c/tennis.ts (branch betredge/v3c-tennis).
import { bookStatusFor, fetchAllPriceBooks, partnerDirectory } from "@/lib/price-books";
import { PREDICTION_WINDOW_DAYS } from "@/lib/prediction-window";
import { BOOK_PRICE_MAX_AGE_MIN, buildBoardMatch, feedBookKeys, footballPairKey, liveFeedRows, type PartnerPriceRow } from "./board";
import type { TennisProbabilityKind, V3BoardResponse, V3BookPrice } from "./contracts";
import { fetchBoardExcluded, fetchBoardSources, fetchLatestPartnerPrices, fetchPartnerHistoryByKeys, fetchTennisBoardSources } from "./queries";
import { buildTennisBoardMatch, isOurModel, ledgerTennisKind, tennisPairKey } from "./tennis";

export async function buildBoardResponse(now: Date = new Date()): Promise<V3BoardResponse> {
  const [sources, tennisSources, excluded] = await Promise.all([
    fetchBoardSources(),
    fetchTennisBoardSources(),
    fetchBoardExcluded(),
  ]);
  // Match ids of the two sports never collide (tennis ids start with "tennis:").
  const keyOf = new Map<string, string>();
  for (const s of sources) {
    const k = footballPairKey(s);
    if (k) keyOf.set(s.id, k);
  }
  for (const t of tennisSources) {
    const k = tennisPairKey(t);
    if (k) keyOf.set(t.id, k);
  }
  // Live feeds first (BetConstruct: same 30s cache as the current board;
  // Altenar: 5 min); a book whose feed is down falls back to its last stored
  // capture. Gated partner feeds are read only when switched on (lib/price-books.ts).
  const keys = new Set(keyOf.values());
  const fixtures = new Map(sources.map((s) => [keyOf.get(s.id) ?? "", { home: s.home, away: s.away, kickoff: s.kickoff }]));
  fixtures.delete("");
  const live = liveFeedRows(await fetchAllPriceBooks(now.getTime()), keys, now, fixtures);
  const history = live.missingBooks.length
    ? (await fetchLatestPartnerPrices([...keys], BOOK_PRICE_MAX_AGE_MIN))
        .filter((r) => live.missingBooks.includes(r.bookmaker))
        .map((r) => ({ ...r, source: "price_history" as const }))
    : [];
  const partner = [...live.rows, ...history];
  const byKey = new Map<string, PartnerPriceRow[]>();
  for (const p of partner) {
    const list = byKey.get(p.team_pair_key) ?? [];
    list.push(p);
    byKey.set(p.team_pair_key, list);
  }

  // Feed down AND nothing recent in history → «feed_down» for that book.
  const historyBooks = new Set(history.map((r) => r.bookmaker));
  const down = new Set(live.missingBooks.filter((b) => !historyBooks.has(b)));
  const statusOf = (lists: V3BookPrice[][]) => {
    const priced = new Map<string, "live_feed" | "price_history">();
    for (const p of lists.flat()) if (!priced.has(p.bookmaker)) priced.set(p.bookmaker, p.source);
    return bookStatusFor(priced, down);
  };

  const matches = sources.map((s) => {
    const m = buildBoardMatch(s, byKey.get(keyOf.get(s.id) ?? "") ?? [], now);
    return { ...m, books: statusOf(m.outcomes.map((o) => o.book_prices)) };
  });
  const FEED_BOOK_KEYS = feedBookKeys();
  const withBook: Record<string, number> = Object.fromEntries(FEED_BOOK_KEYS.map((k) => [k, 0]));
  for (const m of matches) {
    const books = new Set(m.outcomes.flatMap((o) => o.book_prices.map((b) => b.bookmaker)));
    for (const b of books) withBook[b] = (withBook[b] ?? 0) + 1;
  }

  // Market at seal time, for the sealed rows of our model only (the gap).
  const gapKeys = tennisSources
    .filter((t) => t.sealed_at && isOurModel(ledgerTennisKind({ model_version: t.model_version, odds: t.sealed_odds, signal_type: t.sealed_signal_type })))
    .map((t) => keyOf.get(t.id))
    .filter((k): k is string => k != null);
  const tennisHistory = await fetchPartnerHistoryByKeys(gapKeys);
  const tennis = tennisSources.map((t) => {
    const k = keyOf.get(t.id) ?? "";
    const m = buildTennisBoardMatch(t, byKey.get(k) ?? [], now, tennisHistory.get(k) ?? []);
    return { ...m, books: statusOf(m.sides.map((s) => s.book_prices)) };
  });
  const tennisWithBook: Record<string, number> = Object.fromEntries(FEED_BOOK_KEYS.map((k) => [k, 0]));
  const byKind: Record<TennisProbabilityKind, number> = { model: 0, model_tempered: 0, market_tempered: 0 };
  for (const t of tennis) {
    byKind[t.probability_kind] += 1;
    const books = new Set(t.sides.flatMap((s) => s.book_prices.map((b) => b.bookmaker)));
    for (const b of books) tennisWithBook[b] = (tennisWithBook[b] ?? 0) + 1;
  }

  const body: V3BoardResponse = {
    contract: "v3.board.2",
    generated_at: now.toISOString(),
    window_days: PREDICTION_WINDOW_DAYS,
    matches,
    tennis,
    partners: partnerDirectory(),
    coverage: {
      matches: matches.length,
      with_market: matches.filter((m) => m.margin_removed != null).length,
      sealed: matches.filter((m) => m.sealed_at).length,
      with_book_price: withBook,
      excluded: excluded.map((e) => ({
        ...e,
        reason: "no prediction_log row for this source (no model/market split stored)",
      })),
      book_price_max_age_min: BOOK_PRICE_MAX_AGE_MIN,
      books_from_history: live.missingBooks,
      tennis: {
        matches: tennis.length,
        by_kind: byKind,
        with_market: tennis.filter((t) => t.margin_removed != null).length,
        with_model_p: tennis.filter((t) => t.sides[0].model_p != null).length,
        sealed: tennis.filter((t) => t.sealed_at).length,
        with_gap: tennis.filter((t) => t.sides[0].gap_pp != null).length,
        with_book_price: tennisWithBook,
      },
    },
    notes: [
      "market_p excludes the bookmaker margin (proportional removal); margin_removed is the overround of the composite market price.",
      "Football estimate = 0.3 model + 0.7 de-vigged market (blend). Without a market, estimate = model and edge is null.",
      "edge_pp = estimate − market, in percentage points. It is a difference of probabilities, not an expected profit.",
      "Book prices come only from partner books with a real feed and an affiliate link (lib/price-books.ts: FortunePlay, YBets, plus RollXO/N1 Bet/Wildz/Beazt once switched on after APPROVE). book_prices is sorted best first, at most 6 books.",
      "books lists EVERY partner per fixture with oddsAvailable and reason (live_feed, price_history, not_listed, feed_down, pending_approval, awaiting_partner_feed, region_restricted, no_sportsbook). A partner without a price is shown with its button, never hidden.",
      "sealed_at is when the match entered the sealed ledger (often days before kickoff); the numbers shown are the latest estimate (estimate_as_of) and can differ from the sealed ones.",
      "market_price / margin_removed refer to the composite market price stored with the estimate, not to the FortunePlay/YBets prices listed in book_prices.",
      "Tennis: probability_kind says what the served % IS. market_tempered = the market price without margin, temperature 1.68 — not a model of ours (all partner-market-v1 rows, and Elo v4 rows that had a price). model_p is the raw Elo v4 from prediction_log (not sealed); do not subtract it from market_p.",
      "Tennis gap_pp = sealed probability of our Elo (tempered, whole %) − the de-vigged FortunePlay/YBets price captured in the 150 min before the seal (gap_market). It exists only for sealed rows of our model; gap_null_reason says why it is null elsewhere. It is a difference of probabilities, not an expected profit.",
      "Tennis market_price is the pair stored on tennis_predictions (market_source.as_of); partner-market rows keep the price of their first capture. Current FortunePlay/YBets prices are in book_prices.",
    ],
  };
  return body;
}
