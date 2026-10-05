// The board, assembled: what GET /api/v3/board returns, callable from a Server
// Component too (the home and /predictions render the SAME payload server-side
// instead of fetching themselves over HTTP). One function, one payload.
import { fetchAllBooks } from "@/lib/betconstruct-feed";
import { PREDICTION_WINDOW_DAYS } from "@/lib/prediction-window";
import {
  BOOK_PRICE_MAX_AGE_MIN,
  FEED_BOOK_KEYS,
  buildBoardMatch,
  buildTennisMatch,
  footballPairKey,
  liveFeedRows,
  tennisPairKey,
  type PartnerPriceRow,
} from "./board";
import type { V3BoardResponse } from "./contracts";
import { fetchBoardExcluded, fetchBoardSources, fetchBoardTennisSources, fetchLatestPartnerPrices } from "./queries";

export async function buildBoardResponse(now: Date = new Date()): Promise<V3BoardResponse> {
  const [sources, tennisSources, excluded] = await Promise.all([fetchBoardSources(), fetchBoardTennisSources(), fetchBoardExcluded()]);
  const keyOf = new Map<string, string>();
  for (const s of sources) {
    const k = footballPairKey(s);
    if (k) keyOf.set(s.id, k);
  }
  for (const t of tennisSources) {
    const k = tennisPairKey(t);
    if (k) keyOf.set(t.id, k);
  }
  // Live BetConstruct feed first (same source and 30s cache as the current
  // board); a book whose feed is down falls back to its last stored capture.
  const keys = new Set(keyOf.values());
  const live = liveFeedRows(await fetchAllBooks(now.getTime()), keys, now);
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
  const rowsFor = (id: string) => byKey.get(keyOf.get(id) ?? "") ?? [];

  const matches = sources.map((s) => buildBoardMatch(s, rowsFor(s.id), now));
  const tennis = tennisSources.map((t) => buildTennisMatch(t, rowsFor(t.id), now));

  const withBook: Record<string, number> = Object.fromEntries(FEED_BOOK_KEYS.map((k) => [k, 0]));
  for (const m of matches) {
    const books = new Set(m.outcomes.flatMap((o) => o.book_prices.map((b) => b.bookmaker)));
    for (const b of books) withBook[b] = (withBook[b] ?? 0) + 1;
  }
  const tennisWithBook: Record<string, number> = Object.fromEntries(FEED_BOOK_KEYS.map((k) => [k, 0]));
  for (const m of tennis) {
    const books = new Set(m.outcomes.flatMap((o) => o.book_prices.map((b) => b.bookmaker)));
    for (const b of books) tennisWithBook[b] = (tennisWithBook[b] ?? 0) + 1;
  }

  return {
    contract: "v3.board.1",
    generated_at: now.toISOString(),
    window_days: PREDICTION_WINDOW_DAYS,
    matches,
    tennis,
    coverage: {
      tennis: {
        matches: tennis.length,
        with_book_price: tennisWithBook,
        from_model: tennis.filter((t) => t.estimate_source === "model").length,
        from_market: tennis.filter((t) => t.estimate_source === "market").length,
      },
      matches: matches.length,
      with_market: matches.filter((m) => m.margin_removed != null).length,
      sealed: matches.filter((m) => m.sealed_at).length,
      with_book_price: withBook,
      excluded: excluded.map((e) => ({
        ...e,
        reason:
          e.source_table === "tennis_predictions"
            ? "tennis: no model/market split stored per match yet — served in `tennis` with estimate and feed prices only, no gap"
            : "no prediction_log row for this source (no model/market split stored)",
      })),
      book_price_max_age_min: BOOK_PRICE_MAX_AGE_MIN,
      books_from_history: live.missingBooks,
    },
    notes: [
      "market_p excludes the bookmaker margin (proportional removal); margin_removed is the overround of the composite market price.",
      "Football estimate = 0.3 model + 0.7 de-vigged market (blend). Without a market, estimate = model and edge is null.",
      "edge_pp = estimate − market, in percentage points. It is a difference of probabilities, not an expected profit.",
      "Book prices come only from books with a live feed (FortunePlay, YBets). Other partner books never carry a price.",
      "sealed_at is when the match entered the sealed ledger (often days before kickoff); the numbers shown are the latest estimate (estimate_as_of) and can differ from the sealed ones.",
      "market_price / margin_removed refer to the composite market price stored with the estimate, not to the FortunePlay/YBets prices listed in book_prices.",
      "tennis rows carry estimate_p and feed prices only: no market_p, no edge (no model/market split is stored for tennis). estimate_source = market means the probability is the de-vigged book price, not a model.",
    ],
  };
}
