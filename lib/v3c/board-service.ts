// The board, assembled: what GET /api/v3/board returns, callable from a Server
// Component too (the home and /predictions render the SAME payload server-side
// instead of fetching themselves over HTTP). One function, one payload.
// Tennis (v3.board.2) comes from lib/v3c/tennis.ts (branch betredge/v3c-tennis).
import { bookStatusFor, fetchAllPriceBooks, partnerDirectory } from "@/lib/price-books";
import { PREDICTION_WINDOW_DAYS } from "@/lib/prediction-window";
import { BOOK_PRICE_MAX_AGE_MIN, buildBoardMatch, feedBookKeys, footballPairKey, liveFeedRows, type PartnerPriceRow } from "./board";
import type { TennisProbabilityKind, V3BoardResponse, V3BookPrice } from "./contracts";
import { fetchBoardExcluded, fetchBoardSources, fetchLatestPartnerPrices, fetchPartnerHistoryByKeys, fetchTennisBoardSources } from "./queries";
import { buildTennisBoardMatch, isOurModel, ledgerTennisKind, preStartOdds, tennisPairKey } from "./tennis";
import { PARTNER_MARKET_MODEL } from "@/lib/partner-market";
import { dedupePartnerRelistings, resolveAlias } from "./fixdata2";
import { dedupeTennisRows, splitTennisCategories, tennisEstimate } from "./tennis-estimate";
import { market2way } from "./prob";
import { dedupeFootballBoard, hasStarted, relevanceTier } from "./fixdata";
import { orientPartnerPrice } from "./board";
import { canonicalPlayerKey } from "@/lib/tennis-names";
import type { TennisBoardSourceRow } from "./tennis";

/** A row stays on the board until this long after its kick-off (same window as the SQL, on the row's own kick-off). */
const OPEN_AFTER_KICKOFF_MS = 150 * 60_000;

/** fixdata B8/M6: a sealed row of OUR tennis model (tempered Elo, no price at seal) — the only tennis gap there is. */
function ourSealedTennis(t: TennisBoardSourceRow): boolean {
  return t.sealed_at != null && t.sealed_p1 != null && t.sealed_p2 != null && isOurModel(ledgerTennisKind({ model_version: t.model_version, odds: t.sealed_odds, signal_type: t.sealed_signal_type }));
}


export async function buildBoardResponse(now: Date = new Date()): Promise<V3BoardResponse> {
  const [sourcesAll, tennisWindow, excluded] = await Promise.all([
    fetchBoardSources(),
    fetchTennisBoardSources(),
    fetchBoardExcluded(),
  ]);
  // fixdata M6: the window on each row's OWN kick-off (the SQL filters on unified_predictions.starts_at,
  // which can differ): what the API carries is what the board can show, so the counts agree.
  const open = (k: string) => Date.parse(k) > now.getTime() - OPEN_AFTER_KICKOFF_MS;
  // fixdata B6: a rescheduled match listed twice (same teams within ±48 h) is shown once
  const fbDedupe = dedupeFootballBoard(sourcesAll.filter((s) => open(s.kickoff)));
  const sources = fbDedupe.kept;
  const tennisAll = tennisWindow.filter((t) => open(t.kickoff));
  // tennis2: padel and doubles are not on the tennis board (no Elo, the «/» pairs read as one
  // player); a match served twice (partner feed + Elo agent) is shown once — lib/v3c/tennis-estimate.ts.
  const { singles: singlesAll, removed: catRemoved } = splitTennisCategories(tennisAll);
  // fixdata2 B6: a partner listing re-dated (same players within 36 h) is shown once — the later listing
  const relist = dedupePartnerRelistings(singlesAll, PARTNER_MARKET_MODEL);
  const singles = relist.kept;
  // fixdata B8/M6: the Elo row is kept over its partner twin also when it is a sealed row of our model
  // (before, a tempered-Elo row without a price lost to the partner row and its sealed gap never reached the board)
  // fixdata2 N2: the choice reads the same market the row will show — after the start, the pre-start price,
  // never the in-play one the Elo agent writes into tennis_predictions (it made the kept row flip mid-match)
  const pairOf = (t: TennisBoardSourceRow) => {
    if (hasStarted(t.kickoff, now) && t.model_version !== PARTNER_MARKET_MODEL) {
      const pre = preStartOdds(t);
      return market2way(pre?.p1, pre?.p2);
    }
    return market2way(t.odds_p1, t.odds_p2);
  };
  const dedupe = dedupeTennisRows(singles, (t) =>
    ourSealedTennis(t) ||
    tennisEstimate({ ...t, market_p1: pairOf(t)?.p1 ?? null, market_p2: pairOf(t)?.p2 ?? null }, now).estimate_kind === "elo_blend_unsealed",
  );
  // …and, when it has no price of its own, it shows the market of the twin it replaced (oriented by name)
  const byId = new Map(singles.map((t) => [t.id, t]));
  const borrowed = new Map<string, NonNullable<TennisBoardSourceRow["borrowed_market"]>>();
  for (const [droppedId, keptId] of dedupe.dropped) {
    const kept = byId.get(keptId);
    const twin = byId.get(droppedId);
    if (!kept || !twin || pairOf(kept) || !market2way(twin.odds_p1, twin.odds_p2)) continue;
    const o = orientPartnerPrice(
      { home: kept.player1, away: kept.player2 },
      { team_pair_key: "", bookmaker: "", home_name: twin.player1, away_name: twin.player2, odds_home: twin.odds_p1, odds_draw: null, odds_away: twin.odds_p2, captured_at: twin.computed_at },
      canonicalPlayerKey,
    );
    if (o && o.home != null && o.away != null) borrowed.set(keptId, { odds_p1: o.home, odds_p2: o.away, bookmaker: twin.odds_bookmaker, as_of: twin.computed_at });
  }
  const tennisSources = dedupe.kept.map((t) => (borrowed.has(t.id) ? { ...t, borrowed_market: borrowed.get(t.id) } : t));
  // Match ids of the two sports never collide (tennis ids start with "tennis:").
  const keyOf = new Map<string, string>();
  for (const s of sources) {
    const k = footballPairKey(s);
    if (k) keyOf.set(s.id, k);
  }
  for (const t of tennisAll) {
    const k = tennisPairKey(t);
    if (k) keyOf.set(t.id, k);
  }
  // the kept row of a duplicate also reads the book prices keyed on the dropped row
  const altKeys = new Map<string, string[]>();
  for (const [droppedId, keptId] of [...relist.dropped, ...dedupe.dropped]) {
    const k = keyOf.get(droppedId);
    if (k && k !== keyOf.get(keptId)) altKeys.set(keptId, [...(altKeys.get(keptId) ?? []), k]);
  }
  // Live feeds first (BetConstruct: same 30s cache as the current board;
  // Altenar: 5 min); a book whose feed is down falls back to its last stored
  // capture. Gated partner feeds are read only when switched on (lib/price-books.ts).
  // the kept row of a rescheduled pair also reads the book prices keyed on the dropped date
  const fbAlt = new Map<string, string[]>();
  for (const [droppedId, keptId] of fbDedupe.dropped) {
    const d = sourcesAll.find((x) => x.id === droppedId);
    const k = d ? footballPairKey(d) : null;
    if (k) fbAlt.set(keptId, [...(fbAlt.get(keptId) ?? []), k]);
  }
  const keys = new Set([...[...fbAlt.values()].flat(), ...tennisSources.map((t) => keyOf.get(t.id)), ...sources.map((s) => keyOf.get(s.id)), ...[...altKeys.values()].flat()].filter((k): k is string => k != null));
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
    const own = byKey.get(keyOf.get(s.id) ?? "") ?? [];
    const m = buildBoardMatch(s, own.length ? own : (fbAlt.get(s.id) ?? []).flatMap((k) => byKey.get(k) ?? []), now);
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
    const own = byKey.get(k) ?? [];
    const prices = own.length ? own : (altKeys.get(t.id) ?? []).flatMap((a) => byKey.get(a) ?? []);
    const m = buildTennisBoardMatch(t, prices, now, tennisHistory.get(k) ?? []);
    return { ...m, books: statusOf(m.sides.map((s) => s.book_prices)), relevance: relevanceTier({ sport: "tennis", tournament: t.tournament, partner_tournament: t.partner_tournament }) };
  });
  const tennisWithBook: Record<string, number> = Object.fromEntries(FEED_BOOK_KEYS.map((k) => [k, 0]));
  const byKind: Record<TennisProbabilityKind, number> = { model: 0, model_tempered: 0, market_tempered: 0 };
  for (const t of tennis) {
    byKind[t.probability_kind] += 1;
    const books = new Set(t.sides.flatMap((s) => s.book_prices.map((b) => b.bookmaker)));
    for (const b of books) tennisWithBook[b] = (tennisWithBook[b] ?? 0) + 1;
  }

  // fixdata2 N2: every dropped twin points at the row the board shows (resolved transitively)
  const aliasRaw: Record<string, string> = Object.fromEntries([...fbDedupe.dropped, ...relist.dropped, ...dedupe.dropped]);
  const aliases: Record<string, string> = Object.fromEntries(Object.keys(aliasRaw).map((k) => [k, resolveAlias(aliasRaw, k)]));

  const body: V3BoardResponse = {
    contract: "v3.board.2",
    generated_at: now.toISOString(),
    window_days: PREDICTION_WINDOW_DAYS,
    matches,
    tennis,
    aliases,
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
        with_estimate: tennis.filter((t) => t.estimate_kind === "elo_blend_unsealed").length,
        removed: { duplicate: dedupe.dropped.size + relist.dropped.size, ...catRemoved },
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
      "Tennis estimate (tennis2): estimate_kind 'elo_blend_unsealed' = 0.1·raw Elo + 0.9·de-vigged market (the row's market_p), only with an Elo snapshot ≤ 6 h old before the start, ATP/WTA main tour; labelled «Elo-based, not sealed», never tempered. Everything else is 'market_only' (no estimate, no gap). Expected on ≈ 16% of tennis rows. match-level gap_pp = estimate − market (informative, never a value signal); gap_visible = false when |Elo − market| > 25 pp.",
      "Tennis board (tennis2): padel and doubles rows are excluded; a match served by both the partner feed and the Elo agent appears once (the Elo row when it has an estimate, else the partner row). coverage.tennis.removed counts them.",
      "Tennis market_price is the pair stored on tennis_predictions (market_source.as_of); partner-market rows keep the price of their first capture. Current FortunePlay/YBets prices are in book_prices.",
      "fixdata: a match whose kick-off has passed carries no book_prices and no best_price (a pre-match price is not a price once play has started). Rows stay until 150 min after their own kick-off.",
      "fixdata: book_prices[].captured_at is when the price was read — the time the book's feed was fetched (a cached or last-good copy keeps its own time) or the partner_price_history capture — never the request time.",
      "fixdata: model_guard compares the RAW model with the de-vigged market at the widest outcome. > 15 pp: no EV, Kelly, stake or edge badge on any page. > 25 pp: estimate_p = market_p and edge_pp = 0 («Market only»); model_p keeps the raw number. The sealed record is untouched.",
      "fixdata: a football match listed twice (same home and away, kick-offs within 48 h — a rescheduled match under its old date) is shown once: the row the pipeline still refreshes, on a tie the later kick-off. A tennis Elo row sealed by our model is kept over its partner twin and shows the twin's market.",
      "fixdata2: market_from says where market_p comes from. Football without a stored market (or with an impossible one, or one > 15 pp from the partner books) reads the books' real prices, de-vigged per book and averaged: market_price is then the best real price and the estimate the same declared 0.3/0.7 blend on that market. No market at all → model_guard.level «no_market»: no estimate, fair price, EV or Kelly is shown. A book price with an implied probability outside 0.5–99%, or a book whose own set has an overround < 0 or > 25%, is dropped (the match stays).",
      "fixdata2: when the estimate's fair price (1/estimate, outcomes ≥ 10%) is > 25% from the best real price, model_guard becomes «market_only» with reason «price_far»: the market only, no estimate and no fair price.",
      "fixdata2: a started tennis Elo row reads its market from the last pre-start prediction_log snapshot (market_from «pre_start»): tennis_predictions.odds_* receive in-play prices after the start. Started tennis rows carry no book_prices, like football.",
      "fixdata2: sealed_guard puts the sealed Elo of our tennis model under the football thresholds (15 / 25 pp) against the market at seal, else the row's market. aliases maps every dropped twin id to the row shown (one source per match).",
      "fixdata: relevance = 0 top-league football (top five + UEFA cups) · 1 ATP/WTA main tour · 2 other football · 3 other tennis. The board orders each day by relevance, then kick-off.",
    ],
  };
  return body;
}
