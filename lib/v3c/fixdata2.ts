// lib/v3c/fixdata2.ts (#REDESIGN-V3C fixdata2) — the data/logic fixes of QA-REPORT-2 (v3c-final5),
// pure functions, no I/O, one place each:
//   N3  a match without a stored market: a reference market from the partner books' real prices
//       (de-vigged per book, averaged); without any reference, no estimate, no fair price, no EV/Kelly;
//       and a sanity rule between the estimate's fair price and the best real price;
//   N10 absurd stored prices: a price pair/triple outside the possible range is not a market,
//       and a stored market far from the books' own prices is replaced by the books' one;
//   N9  the sealed Elo of our tennis model under the same 15 / 25 pp guard as football;
//   N2  one row per match: an id dropped as a twin resolves to the row the board kept.
import { bookmakerMargin, noVigProbabilities } from "@/lib/betting-math";
import { tennisPairId } from "./fixdata3";
import type { V3BookPrice } from "./contracts";
import type { V3LiveItem } from "./live-contract";
import { scoreOf } from "./live-view";
import { GUARD_MARKET_ONLY_PP, GUARD_NO_VALUE_PP, type ModelGuard } from "./fixdata";

// ─── N10: what a market price can be ─────────────────────────────────────────

/** A decimal price whose implied probability is inside [0.5%, 99%] (1.0101 … 200). */
export const IMPLIED_MIN = 0.005;
export const IMPLIED_MAX = 0.99;
/** A book's overround on one market: never below 0 (a single book never pays an arbitrage), never above 25%. */
export const MARGIN_MIN = 0;
export const MARGIN_MAX = 0.25;

export function sanePrice(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x) && x > 1 && 1 / x >= IMPLIED_MIN && 1 / x <= IMPLIED_MAX;
}

/**
 * A full set of prices of ONE source (the 3 legs of a 1X2 or the 2 of a moneyline) that can be a market:
 * every leg sane and the overround in [0, 25%]. Measured 07/10: Ann Li 45.71 / Svitolina 1.02 on
 * tennis_predictions is a sane pair by itself (2.2% / 98%, margin 0.2%) — it is caught by the
 * cross-check against the books (`storedMarketTrusted`), not here.
 */
export function saneMarketSet(prices: readonly (number | null | undefined)[]): prices is number[] {
  if (prices.length < 2 || !prices.every(sanePrice)) return false;
  const m = bookmakerMargin(prices as number[]);
  return m != null && m >= MARGIN_MIN && m <= MARGIN_MAX;
}

// ─── N3: the reference market from the partner books ─────────────────────────

export type BookMarket = {
  /** de-vigged probability per leg (average over the books with a complete, sane set) */
  p: number[];
  /** average overround of those books */
  margin: number;
  /** the books used */
  books: string[];
};

/**
 * The market implied by the partner books' REAL prices (the ones with an affiliate link, already filtered
 * by lib/price-books): each book with a price on every leg is de-vigged on its own (proportional), the
 * probabilities are averaged. A book with an impossible set (N10) is left out. null = no book has a full set.
 */
export function bookImpliedMarket(legs: readonly (readonly V3BookPrice[])[]): BookMarket | null {
  if (legs.length < 2) return null;
  const books = new Set(legs.flatMap((l) => l.map((b) => b.bookmaker)));
  const sets: { key: string; p: number[]; margin: number }[] = [];
  for (const key of [...books].sort()) {
    const prices = legs.map((l) => l.find((b) => b.bookmaker === key)?.price ?? null);
    if (!saneMarketSet(prices)) continue;
    const p = noVigProbabilities(prices);
    const margin = bookmakerMargin(prices);
    if (p && margin != null) sets.push({ key, p, margin });
  }
  if (!sets.length) return null;
  const p = legs.map((_, i) => sets.reduce((a, s) => a + s.p[i], 0) / sets.length);
  return { p, margin: sets.reduce((a, s) => a + s.margin, 0) / sets.length, books: sets.map((s) => s.key) };
}

/** A stored market farther than this (pp, any leg) from the books' own prices is not shown as the market. */
export const STORED_VS_BOOKS_MAX_PP = 15;

/** The largest |a − b| over the legs, in pp. */
export function maxDiffPp(a: readonly number[], b: readonly number[]): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) d = Math.max(d, Math.abs(a[i] - b[i]) * 100);
  return d;
}

/**
 * N10: the stored market is used only when its prices are a possible market AND, when the books have a
 * price, it agrees with them within STORED_VS_BOOKS_MAX_PP. Otherwise the books' market is the reference.
 */
export function storedMarketTrusted(storedPrices: readonly (number | null | undefined)[], storedP: readonly number[] | null, books: BookMarket | null): boolean {
  if (!storedP || !saneMarketSet(storedPrices)) return false;
  return books == null || maxDiffPp(storedP, books.p) <= STORED_VS_BOOKS_MAX_PP;
}

// ─── N3: the fair price against the best real price ─────────────────────────

/** The estimate's fair price (1/p) farther than this from the best real price → no estimate, no fair price. */
export const FAIR_VS_BEST_MAX = 0.25;
/** The rule reads outcomes from this estimate up (fair price ≤ 10). */
export const FAIR_CHECK_MIN_P = 0.1;

/**
 * True when, on some outcome given (estimate ≥ 10%) with a real best price, 1/estimate is more than 25% away from it.
 * The board passes the LEAD outcome only (the one beside the book button): on the other legs a 25% distance in
 * price is a few pp of probability on an underdog (Lecce 20% vs 25% implied), not a contradiction. Example:
 * Palace–Forest 07/10, estimate 59% (fair 1.70) beside FortunePlay 2.64 — 36% away.
 */
export function fairFarFromBest(outs: readonly { estimate_p: number | null; best_price: { price: number } | null }[]): boolean {
  return outs.some((o) => {
    // long shots (< 10%) are left out: a heavy longshot margin puts a fair 20 beside a real 14 on honest books
    if (o.estimate_p == null || !(o.estimate_p >= FAIR_CHECK_MIN_P && o.estimate_p < 1) || !o.best_price || !(o.best_price.price > 1)) return false;
    return Math.abs(1 / o.estimate_p - o.best_price.price) / o.best_price.price > FAIR_VS_BEST_MAX;
  });
}

/** Is an estimate (and its fair price) shown at all? Not without a market, not when it is far from the best price. */
export function estimateShown(m: { model_guard?: ModelGuard }): boolean {
  const g = m.model_guard;
  return !g || (g.level !== "no_market" && g.reason !== "price_far");
}

// ─── N9: the sealed Elo of our tennis model ─────────────────────────────────

/**
 * The guard of a SEALED tennis number of our model (tempered Elo) against the market it is read next to:
 * the market at seal when the gap has one, else the row's market. Same thresholds as football:
 * > 15 pp no gap and no value signal, > 25 pp the sealed number is not shown (the row reads «Market only»).
 * No market at all → «no_market» (the sealed number alone beside a book button is not shown either).
 */
export function sealedTennisGuard(sealedP: number | null, marketAtSeal: number | null, market: number | null): ModelGuard {
  if (sealedP == null) return { level: "ok", delta_pp: null };
  const ref = marketAtSeal ?? market;
  if (ref == null) return { level: "no_market", delta_pp: null, reason: "no_market" };
  const d = Math.abs(sealedP - ref) * 100;
  const delta_pp = Math.round(d * 10) / 10;
  return { level: d > GUARD_MARKET_ONLY_PP ? "market_only" : d > GUARD_NO_VALUE_PP ? "no_value" : "ok", delta_pp, reason: d > GUARD_NO_VALUE_PP ? "model_far" : undefined };
}

/** The record (tennis receipts): a sealed gap wider than 25 pp is not printed as a gap. */
export function recordGapShown(gapPp: number | null): boolean {
  return gapPp == null || Math.abs(gapPp) <= GUARD_MARKET_ONLY_PP;
}

// ─── N2: one row per match ──────────────────────────────────────────────────

/** dropped id → kept id, resolved transitively (a → b → c gives a → c). */
export function resolveAlias(aliases: Readonly<Record<string, string>> | undefined, id: string): string {
  let cur = id;
  for (let i = 0; i < 8 && aliases && aliases[cur] && aliases[cur] !== cur; i++) cur = aliases[cur];
  return cur;
}

// ─── B6: the same tennis match twice from the partner feed (rescheduled) ─────

type PartnerRow = { id: string; player1: string; player2: string; kickoff: string; computed_at: string; model_version: string };

/** Same two players within this window = one partner listing re-dated (Cook–Sekulic 7/10 14:57 and 8/10 05:30). */
export const PARTNER_TWIN_WINDOW_H = 36;

/**
 * Two partner-feed rows with the same players within 36 h are one match re-listed under a new date: the
 * later listing (computed_at; partner rows keep their first capture) is the live one; on a tie the later
 * start. Measured 07/10: Cook–Sekulic (7/10 computed 10:00, 8/10 computed 12:00) and Djakouris–Dinev
 * (7/10 computed 06/10 12:01, 8/10 computed 07/10 02:00), identical prices. Elo rows are left alone
 * (dedupeTennisRows pairs them with their partner twin).
 */
export function dedupePartnerRelistings<T extends PartnerRow>(rows: T[], partnerModel: string): { kept: T[]; dropped: Map<string, string> } {
  const dropped = new Map<string, string>();
  // fixdata3 R2: players and name tokens without order
  const pair = (r: T) => tennisPairId(r.player1, r.player2);
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    if (r.model_version !== partnerModel) continue;
    groups.set(pair(r), [...(groups.get(pair(r)) ?? []), r]);
  }
  const windowMs = PARTNER_TWIN_WINDOW_H * 3_600_000;
  const later = (a: T, b: T) =>
    Date.parse(a.computed_at) !== Date.parse(b.computed_at)
      ? Date.parse(a.computed_at) > Date.parse(b.computed_at) ? a : b
      : Date.parse(a.kickoff) !== Date.parse(b.kickoff)
        ? Date.parse(a.kickoff) > Date.parse(b.kickoff) ? a : b
        : a.id <= b.id ? a : b;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
    let best = list[0];
    for (const r of list.slice(1)) {
      if (Math.abs(Date.parse(r.kickoff) - Date.parse(best.kickoff)) > windowMs) {
        best = r;
        continue;
      }
      const keep = later(best, r);
      const lose = keep === best ? r : best;
      dropped.set(lose.id, keep.id);
      for (const [d, k] of dropped) if (k === lose.id) dropped.set(d, keep.id);
      best = keep;
    }
  }
  return { kept: dropped.size ? rows.filter((r) => !dropped.has(r.id)) : rows, dropped };
}

/**
 * B6/A3: «Live now» lists one row per match — a tennis pair already listed (another id, same players) is skipped.
 * `hasScore` puts first the twin the live feed has a score for (stable otherwise), so the match never drops out.
 */
export function oneRowPerMatch<T extends { id: string; sport: "football" | "tennis"; home: string; away: string }>(rows: readonly T[], hasScore: (id: string) => boolean = () => false): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  const ordered = rows.map((r, i) => ({ r, i, s: hasScore(r.id) ? 0 : 1 })).sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.r);
  const keep = new Set<T>();
  for (const r of ordered) {
    const k = r.sport === "tennis" ? `t|${tennisPairId(r.home, r.away)}` : `id|${r.id}`;
    if (seen.has(k) || seen.has(`id|${r.id}`)) continue;
    seen.add(k);
    seen.add(`id|${r.id}`);
    keep.add(r);
  }
  for (const r of rows) if (keep.has(r)) out.push(r);
  return out;
}

// ─── N4: the price check opens on a price a book really offers ───────────────

/**
 * The starting prices of the price check: per outcome the best price a partner book really offers (with its
 * link), else an empty field — never the composite «market» price no book pays (QA-2: 5.00 beside a best 4.50).
 */
export function pcStartPrices(outcomes: readonly { book_prices: readonly { price: number; url?: string | null }[] }[]): string[] {
  return outcomes.map((o) => {
    const best = o.book_prices.filter((b) => !!b.url && Number.isFinite(b.price) && b.price > 1).reduce<number | null>((a, b) => (a == null || b.price > a ? b.price : a), null);
    return best == null ? "" : best.toFixed(2);
  });
}

// ─── N11: the started note of the match page reads the live score ────────────

/** «live» when /api/v3/live has a score for the match (live, break or final), else «none» (the old «no live score yet»). */
export function startedNoteKind(item: V3LiveItem | undefined): "live" | "none" {
  if (!item || item.state === "pre" || item.state === "off") return "none";
  return scoreOf(item) ? "live" : "none";
}
