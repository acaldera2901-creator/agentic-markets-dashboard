// Tennis in the v3 endpoints — board rows, moneyline line movement, sealed
// record groups. Read-only, from what is stored today (docs/v3c-data-api.md §5).
//
// The facts that shape everything here (measured on prod 05/10, SELECT only):
// pick_ledger seals the SERVED tennis probability, and that is
//   * the de-vigged market with temperature 1.68 for every partner-market-v1 row
//     AND for every Elo v4 row that had a price (77/77 sealed rows checked);
//   * the Elo v4 with temperature 1.68 when there was no price (297/307 checked).
// The raw Elo lives only in prediction_log (shadow log, client clock): not sealed.
//
// So the only honest tennis gap is: a SEALED Elo row (no price on our side when
// sealed) against the feed-book price that partner_price_history captured before
// that seal. Both rows are append-only with a database timestamp, and the two
// numbers are independent (our Elo vs the book). Everything else → gap null,
// with the reason. docs/v3c-tennis-proposal.md is what would widen it.
import { PARTNER_MARKET_MODEL, displayTournament } from "@/lib/partner-market";
import { TENNIS_ANCHORED_TAU, probabilitaMostrata } from "@/lib/tennis-calibration";
import { canonicalPlayerKey } from "@/lib/tennis-names";
import { marketAgeMin, marketFresh, playerKey } from "./fixdata3";
import { teamPairKey } from "@/lib/team-pair-key";
import { wilson95 } from "@/lib/wilson";
import { bookByKey } from "@/lib/betconstruct-books";
import { BOOK_PRICE_MAX_AGE_MIN, bookPricesFor, orientPartnerPrice, type PartnerPriceRow } from "./board";
import {
  LIMITED_SAMPLE_N,
  type TennisProbabilityKind,
  type TennisSide,
  type V3BoardTennisMatch,
  type V3BoardTennisSide,
  type V3LinePointMl,
  type V3LineSeries,
  type V3TennisRecordGroup,
} from "./contracts";
import { seriesCoverage } from "./line-movement";
import { tennisEstimate } from "./tennis-estimate";
import { GUARD_NO_VALUE_PP, hasStarted } from "./fixdata";
import { bookImpliedMarket, sealedTennisGuard, storedMarketTrusted } from "./fixdata2";
import { market2way, roundP } from "./prob";
import { mean, pairedDifference } from "./scoring";

/** unified_predictions / pick_ledger source_table of tennis rows (lib/tennis-adapter.ts). */
export const TENNIS_LEDGER_SOURCE_TABLE = "tennis_predictions";

export const TENNIS_KIND_LABELS: Record<TennisProbabilityKind, string> = {
  model: "Elo v4 (our model)",
  model_tempered: "Elo v4, temperature 1.68 (our model, no market at serve time)",
  market_tempered: "Market price without margin, temperature 1.68 (not a model)",
};

export const isOurModel = (k: TennisProbabilityKind) => k !== "market_tempered";

/** Kind of the probability SERVED by a tennis_predictions row (mirror of lib/tennis-adapter.ts). */
export function servedTennisKind(r: {
  model_version: string;
  edge: number | null;
  odds_p1: number | null;
  odds_p2: number | null;
}): TennisProbabilityKind {
  if (r.model_version === PARTNER_MARKET_MODEL) return "market_tempered";
  // tennis-adapter: an edge exists only when the Elo was served against a market
  if (r.edge != null) return "model";
  // tennis_model_agent (#TENNIS-MARKET-ANCHOR-0821): both prices → p IS the market
  return (r.odds_p1 ?? 0) > 1 && (r.odds_p2 ?? 0) > 1 ? "market_tempered" : "model_tempered";
}

/**
 * Kind of a SEALED tennis probability, from the ledger row alone. The ledger
 * stores only the picked side's price; a price there means the row was
 * market-anchored when sealed (verified 77/77), none means tempered Elo (297/307,
 * the other 10 are shadow-log lag, not a different kind). signal_type 'signal'
 * would be an Elo served with a real edge (0 rows today).
 */
export function ledgerTennisKind(r: {
  model_version: string;
  odds: number | null;
  signal_type: string | null;
}): TennisProbabilityKind {
  if (r.model_version === PARTNER_MARKET_MODEL) return "market_tempered";
  if (r.signal_type === "signal") return "model";
  return (r.odds ?? 0) > 1 ? "market_tempered" : "model_tempered";
}

// fixdata3 R2: a book listing «Zhuoxuan Bai» is oriented onto our «Bai Zhuoxuan» (name tokens without order)
const tennisNorm = (n: string) => playerKey(n);

/**
 * Pair key of a tennis match. Partner rows carry it in the id
 * («tennis:partner:YYYY-MM-DD_a|b», `:` replaced by `_`); the others are keyed
 * like the feed (teamPairKey, canonical player names, UTC day).
 */
export function tennisPairKey(r: { id: string; player1: string; player2: string; kickoff: string }): string | null {
  const PREFIX = "tennis:partner:";
  if (r.id.startsWith(PREFIX)) {
    const rest = r.id.slice(PREFIX.length);
    if (/^\d{4}-\d{2}-\d{2}_/.test(rest)) return `${rest.slice(0, 10)}:${rest.slice(11)}`;
  }
  const t = Date.parse(r.kickoff);
  return Number.isFinite(t) ? teamPairKey("tennis", r.player1, r.player2, new Date(t).toISOString()) : null;
}

export type MarketAtSeal = { p1: number; p2: number; bookmaker: string; captured_at: string };

/**
 * The market when a row was sealed: the LAST feed-book capture at or before
 * `sealedAt`, no older than BOOK_PRICE_MAX_AGE_MIN, oriented to our p1/p2 and
 * de-vigged. Ties on time resolve by bookmaker key. null = none.
 */
export function marketAtSeal(
  ours: { player1: string; player2: string },
  sealedAt: string,
  rows: PartnerPriceRow[],
): MarketAtSeal | null {
  const seal = Date.parse(sealedAt);
  if (!Number.isFinite(seal)) return null;
  const minT = seal - BOOK_PRICE_MAX_AGE_MIN * 60_000;
  let best: { t: number; row: PartnerPriceRow; m: { p1: number; p2: number } } | null = null;
  for (const row of rows) {
    if (!bookByKey(row.bookmaker)) continue;
    const t = Date.parse(row.captured_at);
    if (!(t <= seal && t >= minT)) continue;
    const o = orientPartnerPrice({ home: ours.player1, away: ours.player2 }, row, tennisNorm);
    const m = o ? market2way(o.home, o.away) : null;
    if (!m) continue;
    if (!best || t > best.t || (t === best.t && row.bookmaker < best.row.bookmaker)) best = { t, row, m };
  }
  return best
    ? { p1: best.m.p1, p2: best.m.p2, bookmaker: best.row.bookmaker, captured_at: new Date(best.t).toISOString() }
    : null;
}

/**
 * Why a tennis row has (or has not) a publishable gap. Gap = sealed probability
 * of OUR model − independent market at seal time; anything else is null.
 */
export function tennisGapReason(input: {
  /** kind of the SEALED number (ledgerTennisKind) or, unsealed, of the served one */
  kind: TennisProbabilityKind;
  sealed: boolean;
  hasRawModel: boolean;
  market: MarketAtSeal | null;
}): string | null {
  if (!isOurModel(input.kind))
    return input.hasRawModel
      ? "the sealed probability is the market price itself (Elo anchored to the price); the raw Elo exists only in prediction_log, which is not sealed. See docs/v3c-tennis-proposal.md"
      : "no model of ours for this match: the probability is the market price without margin; a gap against itself is 0 by construction";
  if (!input.sealed) return "not sealed yet";
  if (!input.market) return `no FortunePlay/YBets price captured in the ${BOOK_PRICE_MAX_AGE_MIN} min before the seal`;
  return null;
}

/** Latest tennis_predictions row of a published tennis match + raw Elo + seal. */
export type TennisBoardSourceRow = {
  id: string;
  tournament: string | null;
  kickoff: string;
  player1: string;
  player2: string;
  p1: number;
  p2: number;
  odds_p1: number | null;
  odds_p2: number | null;
  edge: number | null;
  model_version: string;
  computed_at: string;
  odds_bookmaker: string | null;
  /** unified_predictions.pick (player name) or null */
  surfaced_pick: string | null;
  /** raw Elo from the latest prediction_log snapshot */
  model_p1: number | null;
  model_p2: number | null;
  model_as_of: string | null;
  sealed_at: string | null;
  sealed_p1: number | null;
  sealed_p2: number | null;
  /** pick_ledger.odds / signal_type — what the sealed number is */
  sealed_odds: number | null;
  sealed_signal_type: string | null;
  /** tennis2: feature_snapshot.partner.tournament (the real name behind «Partner feed») */
  partner_tournament?: string | null;
  /** tennis2: last prediction_log snapshot BEFORE the start with both raw Elo and market */
  elo_p1?: number | null;
  elo_p2?: number | null;
  elo_as_of?: string | null;
  elo_home?: string | null;
  /**
   * fixdata B8: the market of the partner twin this row replaced (board-service), when the row has no
   * price of its own — shown as the market, never used to say what the served probability IS.
   */
  borrowed_market?: { odds_p1: number; odds_p2: number; bookmaker: string | null; as_of: string };
  /**
   * fixdata2 N2: the prices of that same pre-start prediction_log snapshot (elo_as_of, oriented with elo_home).
   * After the start the Elo agent rewrites tennis_predictions.odds_* with in-play prices (Altmaier–Rune 07/10:
   * 6.41/1.16 at 14:34, back to 2.20/1.77 at 15:00): a started Elo row reads its market from here.
   */
  pre_odds_p1?: number | null;
  pre_odds_p2?: number | null;
};

/** fixdata2 N2: the pre-start snapshot prices oriented to player1/player2 (null when the snapshot is another pairing). */
export function preStartOdds(r: Pick<TennisBoardSourceRow, "player1" | "player2" | "elo_home" | "pre_odds_p1" | "pre_odds_p2">): { p1: number; p2: number } | null {
  if (r.pre_odds_p1 == null || r.pre_odds_p2 == null) return null;
  if (!r.elo_home) return { p1: r.pre_odds_p1, p2: r.pre_odds_p2 };
  const h = canonicalPlayerKey(r.elo_home);
  if (h === canonicalPlayerKey(r.player1)) return { p1: r.pre_odds_p1, p2: r.pre_odds_p2 };
  if (h === canonicalPlayerKey(r.player2)) return { p1: r.pre_odds_p2, p2: r.pre_odds_p1 };
  return null;
}

/**
 * @param partner     current feed-book prices (live feed / last capture) → book_prices
 * @param history     partner_price_history captures of this match → market at seal
 */
export function buildTennisBoardMatch(
  src: TennisBoardSourceRow,
  partner: PartnerPriceRow[],
  now: Date,
  history: PartnerPriceRow[] = [],
): V3BoardTennisMatch {
  const kind = servedTennisKind(src);
  // fixdata B1 (now in the API too): once play has started a pre-match book price is not a price
  const started = hasStarted(src.kickoff, now);
  const prices = started ? { home: [], draw: [], away: [] } : bookPricesFor({ home: src.player1, away: src.player2 }, partner, now, tennisNorm);
  const books = bookImpliedMarket([prices.home, prices.away]);
  // fixdata2 N2: a started Elo row reads the last pre-start price (tennis_predictions gets in-play prices)
  const pre = started && src.model_version !== PARTNER_MARKET_MODEL ? preStartOdds(src) : null;
  const ownPair: [number | null, number | null] = started && src.model_version !== PARTNER_MARKET_MODEL ? [pre?.p1 ?? null, pre?.p2 ?? null] : [src.odds_p1, src.odds_p2];
  const lentPair: [number | null, number | null] = [src.borrowed_market?.odds_p1 ?? null, src.borrowed_market?.odds_p2 ?? null];
  // fixdata2 N10: a pair is the market only when it is possible and agrees with the books (≤ 15 pp)
  const usable = (pair: [number | null, number | null]) => {
    const m = market2way(pair[0], pair[1]);
    return m && storedMarketTrusted(pair, [m.p1, m.p2], books) ? m : null;
  };
  // fixdata3 R3: a stored pair is the market only while it is ≤ 6 h old (at the reading, or at the start once started)
  const ownAsOf = pre ? (src.elo_as_of ?? null) : src.computed_at;
  const ownRaw = usable(ownPair);
  const ownM = ownRaw && marketFresh(ownAsOf, src.kickoff, now) ? ownRaw : null;
  const lentRaw = ownM ? null : usable(lentPair);
  const lentM = lentRaw && marketFresh(src.borrowed_market?.as_of, src.kickoff, now) ? lentRaw : null;
  const lent = lentM ? (src.borrowed_market ?? null) : null;
  const fromBooks = !ownM && !lentM && books != null;
  // nothing fresh and no book: the old stored price, declared «may be outdated» — never an estimate or gap on it
  const stale =
    ownM || lentM || fromBooks
      ? null
      : ownRaw
        ? { m: ownRaw, pair: ownPair, as_of: ownAsOf, bookmaker: src.odds_bookmaker }
        : lentRaw
          ? { m: lentRaw, pair: lentPair, as_of: src.borrowed_market?.as_of ?? null, bookmaker: src.borrowed_market?.bookmaker ?? null }
          : null;
  const market = ownM ?? lentM ?? (books ? { p1: books.p[0], p2: books.p[1], margin: books.margin } : null) ?? stale?.m ?? null;
  const odds1 = ownM ? ownPair[0] : lentM ? lentPair[0] : fromBooks ? (prices.home[0]?.price ?? null) : (stale?.pair[0] ?? null);
  const odds2 = ownM ? ownPair[1] : lentM ? lentPair[1] : fromBooks ? (prices.away[0]?.price ?? null) : (stale?.pair[1] ?? null);
  const marketFrom: V3BoardTennisMatch["market_from"] = ownM ? (pre ? "pre_start" : "stored") : lentM ? "twin" : fromBooks ? "books" : stale ? "stale" : null;
  const hasModel = src.model_p1 != null && src.model_p2 != null;
  // Served probability, exactly as lib/tennis-adapter computes it (same function).
  const est = (p: number) => probabilitaMostrata(p, src.edge != null);
  const estimate = { p1: est(src.p1), p2: est(src.p2) };

  const sealed = src.sealed_at != null && src.sealed_p1 != null && src.sealed_p2 != null;
  const sealedKind = sealed
    ? ledgerTennisKind({ model_version: src.model_version, odds: src.sealed_odds, signal_type: src.sealed_signal_type })
    : kind;
  const atSeal = sealed && isOurModel(sealedKind) ? marketAtSeal(src, src.sealed_at as string, history) : null;
  const reason = tennisGapReason({ kind: sealedKind, sealed, hasRawModel: hasModel, market: atSeal });

  // fixdata2 N9: the sealed Elo of our model under the 15 / 25 pp guard, against the market at seal (else the row's)
  const leadSide: TennisSide = (src.sealed_p1 ?? 0) >= (src.sealed_p2 ?? 0) ? "p1" : "p2";
  const sealedGuard =
    sealed && isOurModel(sealedKind)
      ? sealedTennisGuard(leadSide === "p1" ? src.sealed_p1 : src.sealed_p2, reason == null && atSeal ? atSeal[leadSide] : null, market && !stale ? market[leadSide] : null)
      : undefined;
  const gapOk = !sealedGuard || sealedGuard.level === "ok";
  const side = (s: TennisSide): V3BoardTennisSide => {
    const books = s === "p1" ? prices.home : prices.away;
    const sp = s === "p1" ? src.sealed_p1 : src.sealed_p2;
    const mAt = reason == null && atSeal ? atSeal[s] : null;
    const gap = gapOk && mAt != null && sp != null ? Math.round((sp - mAt) * 10_000) / 100 : null;
    return {
      side: s,
      player: s === "p1" ? src.player1 : src.player2,
      market_price: market ? (s === "p1" ? odds1 : odds2) : null,
      market_p: market ? roundP(market[s]) : null,
      model_p: hasModel ? roundP((s === "p1" ? src.model_p1 : src.model_p2) as number) : null,
      estimate_p: roundP(estimate[s]),
      sealed_p: sp,
      market_p_at_seal: mAt == null ? null : roundP(mAt),
      gap_pp: gap,
      book_prices: books,
      best_price: books[0] ?? null,
    };
  };

  const pick = src.surfaced_pick;
  // tennis2: the displayed estimate (0.1·Elo + 0.9·market, or market only) — lib/v3c/tennis-estimate.ts
  const te0 = tennisEstimate({ ...src, market_p1: market?.p1 ?? null, market_p2: market?.p2 ?? null }, now);
  // fixdata3 R3: no estimate and no gap on a price that may be outdated
  const te = stale ? { ...te0, estimate_kind: "market_only" as const, estimate_p: null, gap_pp: null, gap_visible: false } : te0;
  const booksAsOf = () => new Date(Math.max(...[...prices.home, ...prices.away].map((b) => Date.parse(b.captured_at)).filter(Number.isFinite))).toISOString();
  const marketAsOf = !market ? null : lent ? lent.as_of : fromBooks ? booksAsOf() : stale ? stale.as_of : ownAsOf;
  return {
    id: src.id,
    sport: "tennis",
    tournament: displayTournament(src.tournament),
    kickoff: new Date(src.kickoff).toISOString(),
    player1: src.player1,
    player2: src.player2,
    market: "ML",
    model_version: src.model_version,
    probability_kind: kind,
    is_our_model: isOurModel(kind),
    temperature: src.edge != null ? null : TENNIS_ANCHORED_TAU,
    margin_removed: market ? roundP(market.margin) : null,
    market_source: market
      ? lent
        ? { bookmaker: lent.bookmaker, as_of: new Date(lent.as_of).toISOString() }
        : fromBooks
          ? { bookmaker: books?.books.join(",") ?? null, as_of: booksAsOf() }
          : stale
            ? { bookmaker: stale.bookmaker, as_of: new Date(stale.as_of ?? src.computed_at).toISOString() }
            : pre && src.elo_as_of
            ? { bookmaker: src.odds_bookmaker, as_of: new Date(src.elo_as_of).toISOString() }
            : { bookmaker: src.odds_bookmaker, as_of: new Date(src.computed_at).toISOString() }
      : null,
    // fixdata3 R3: how old the market shown is, at the reading (or at the start once play has started)
    market_age_min: market ? marketAgeMin(marketAsOf, src.kickoff, now) : null,
    model_as_of: src.model_as_of ? new Date(src.model_as_of).toISOString() : null,
    estimate_as_of: new Date(src.computed_at).toISOString(),
    sealed_at: src.sealed_at ? new Date(src.sealed_at).toISOString() : null,
    focus: estimate.p1 >= estimate.p2 ? "p1" : "p2",
    surfaced_pick: pick === src.player1 ? "p1" : pick === src.player2 ? "p2" : null,
    gap_market: reason == null && atSeal && gapOk ? { bookmaker: atSeal.bookmaker, captured_at: atSeal.captured_at } : null,
    gap_null_reason: reason ?? (gapOk ? null : `the sealed Elo is ${sealedGuard?.delta_pp} pp from the market: more than ${GUARD_NO_VALUE_PP} pp, no gap is shown`),
    sides: [side("p1"), side("p2")],
    ...te,
    market_from: marketFrom,
    ...(sealedGuard ? { sealed_guard: sealedGuard } : {}),
  };
}

/** One moneyline series per feed book, oriented to our player1/player2, every capture kept. */
export function tennisMlSeries(ours: { home: string; away: string }, rows: PartnerPriceRow[]): V3LineSeries[] {
  const byBook = new Map<string, PartnerPriceRow[]>();
  for (const r of rows) {
    if (!bookByKey(r.bookmaker)) continue;
    const list = byBook.get(r.bookmaker) ?? [];
    list.push(r);
    byBook.set(r.bookmaker, list);
  }
  const out: V3LineSeries[] = [];
  for (const [bookmaker, list] of [...byBook.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const points: V3LinePointMl[] = [];
    for (const r of [...list].sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at))) {
      const o = orientPartnerPrice(ours, r, tennisNorm);
      if (!o || o.home == null || o.away == null) continue;
      const m = market2way(o.home, o.away);
      points.push({
        t: new Date(r.captured_at).toISOString(),
        price: { p1: o.home, p2: o.away },
        market_p: m ? { p1: roundP(m.p1), p2: roundP(m.p2) } : null,
        margin: m ? roundP(m.margin) : null,
      });
    }
    out.push({ market: "ML", source: "partner_price_history", bookmaker, points, coverage: seriesCoverage(points.map((p) => p.t)) });
  }
  return out;
}

/** A sealed tennis row (non-backfill) with its current settlement, if any. */
export type SealedTennisRow = {
  source_id: string;
  model_version: string;
  home_team: string;
  away_team: string;
  pick: string;
  /** sealed probability of the picked player (pick_ledger.confidence) */
  p: number;
  /** null = no row in pick_settlement_current */
  result: string | null;
  /** picked side's price stored with the seal (null = none) */
  odds: number | null;
  signal_type: string | null;
  captured_at: string;
  commence_time: string;
};

/** Pair key of a sealed row (same key partner_price_history uses). */
export function sealedTennisKey(r: SealedTennisRow): string | null {
  return tennisPairKey({ id: r.source_id, player1: r.home_team, player2: r.away_team, kickoff: r.commence_time });
}

export type TennisGroupKey = { model_version: string; kind: TennisProbabilityKind };

export function groupSealedTennis(rows: SealedTennisRow[]): Map<string, { key: TennisGroupKey; rows: SealedTennisRow[] }> {
  const groups = new Map<string, { key: TennisGroupKey; rows: SealedTennisRow[] }>();
  for (const r of rows) {
    const kind = ledgerTennisKind(r);
    const id = `${r.model_version}|${kind}`;
    const g = groups.get(id) ?? { key: { model_version: r.model_version, kind }, rows: [] };
    g.rows.push(r);
    groups.set(id, g);
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export const isScoredTennis = (r: SealedTennisRow) =>
  (r.result === "won" || r.result === "lost") && Number.isFinite(r.p) && r.p >= 0 && r.p <= 1;

/** Market probability of the PICKED player at seal time, or null. */
export function pickedMarketAtSeal(r: SealedTennisRow, history: PartnerPriceRow[]): number | null {
  const m = marketAtSeal({ player1: r.home_team, player2: r.away_team }, r.captured_at, history);
  if (!m) return null;
  if (r.pick === r.home_team) return m.p1;
  if (r.pick === r.away_team) return m.p2;
  return null;
}

/**
 * @param historyByKey partner_price_history captures by pair key (only our model
 *                     groups are paired: a market group against the market is itself)
 */
export function tennisRecordGroups(
  rows: SealedTennisRow[],
  historyByKey: Map<string, PartnerPriceRow[]> = new Map(),
): V3TennisRecordGroup[] {
  return [...groupSealedTennis(rows).values()].map(({ key, rows: list }) => {
    const ours = isOurModel(key.kind);
    const scored = list.filter(isScoredTennis);
    const won = scored.filter((r) => r.result === "won").length;
    const y = (r: SealedTennisRow) => (r.result === "won" ? 1 : 0);
    const w = wilson95(won, scored.length);
    const brier = mean(scored.map((r) => (r.p - y(r)) ** 2));
    const paired = ours
      ? scored.flatMap((r) => {
          const m = pickedMarketAtSeal(r, historyByKey.get(sealedTennisKey(r) ?? "") ?? []);
          return m == null ? [] : [{ r, m }];
        })
      : [];
    const bp = mean(paired.map(({ r }) => (r.p - y(r)) ** 2));
    const bm = mean(paired.map(({ r, m }) => (m - y(r)) ** 2));
    const diff = pairedDifference(paired.map(({ r, m }) => (r.p - y(r)) ** 2 - (m - y(r)) ** 2));
    const since = list.reduce<string | null>(
      (min, r) => (min == null || Date.parse(r.captured_at) < Date.parse(min) ? r.captured_at : min),
      null,
    );
    return {
      model_version: key.model_version,
      kind: key.kind,
      label: TENNIS_KIND_LABELS[key.kind],
      is_our_model: ours,
      since: since ? new Date(since).toISOString() : null,
      sealed: list.length,
      scored: scored.length,
      settled_other: list.filter((r) => r.result != null && !isScoredTennis(r)).length,
      unsettled: list.filter((r) => r.result == null).length,
      expected_wins: scored.length ? Math.round(scored.reduce((a, r) => a + r.p, 0) * 100) / 100 : null,
      observed_wins: won,
      observed_ci95: w ? { low: roundP(w.low), high: roundP(w.high) } : null,
      brier: brier == null ? null : roundP(brier),
      n_paired: paired.length,
      brier_paired: bp == null ? null : roundP(bp),
      brier_market: bm == null ? null : roundP(bm),
      difference: diff ? roundP(diff.mean) : null,
      difference_ci95: diff ? { low: roundP(diff.ci95.low), high: roundP(diff.ci95.high) } : null,
      brier_market_null_reason: !ours
        ? "the sealed probability IS the market (tempered): comparing it with the market would compare it with itself"
        : paired.length === 0
          ? `no scored row has a FortunePlay/YBets price captured in the ${BOOK_PRICE_MAX_AGE_MIN} min before its seal`
          : null,
      quantization_pp: 0.5,
      limited_sample: scored.length < LIMITED_SAMPLE_N || (ours && paired.length < LIMITED_SAMPLE_N),
    };
  });
}
