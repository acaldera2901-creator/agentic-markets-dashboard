// /api/v3/match/[id]/line-movement — opening → now, from the stored price
// history only. Every captured point is returned as-is: no interpolation, no
// smoothing, no synthetic opening. Two captures = two points.
import type { V3LinePoint1x2, V3LinePointAh, V3LineSeries, V3SeriesCoverage } from "./contracts";
import { orientPartnerPrice, type PartnerPriceRow } from "./board";
import { market1x2, roundP } from "./prob";
import { bookByKey } from "@/lib/betconstruct-books";
import { normName } from "@/lib/odds-api";

export type AhHistoryRow = {
  source: string;
  home_name: string;
  away_name: string;
  ah_line: number | null;
  ah_odds_home: number | null;
  ah_odds_away: number | null;
  captured_at: string;
};

export function seriesCoverage(times: string[]): V3SeriesCoverage {
  const ts = times.map((t) => Date.parse(t)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!ts.length) return { n_points: 0, first_at: null, last_at: null, median_interval_min: null, max_gap_min: null };
  const gaps: number[] = [];
  for (let i = 1; i < ts.length; i++) gaps.push((ts[i] - ts[i - 1]) / 60_000);
  gaps.sort((a, b) => a - b);
  const median = gaps.length
    ? gaps.length % 2
      ? gaps[(gaps.length - 1) / 2]
      : (gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2
    : null;
  return {
    n_points: ts.length,
    first_at: new Date(ts[0]).toISOString(),
    last_at: new Date(ts[ts.length - 1]).toISOString(),
    median_interval_min: median == null ? null : Math.round(median * 10) / 10,
    max_gap_min: gaps.length ? Math.round(gaps[gaps.length - 1] * 10) / 10 : null,
  };
}

const byTime = <T extends { captured_at: string }>(a: T, b: T) =>
  Date.parse(a.captured_at) - Date.parse(b.captured_at);

/** One 1X2 series per feed book, oriented to our fixture, every capture kept. */
export function partnerSeries(ours: { home: string; away: string }, rows: PartnerPriceRow[]): V3LineSeries[] {
  const byBook = new Map<string, PartnerPriceRow[]>();
  for (const r of rows) {
    if (!bookByKey(r.bookmaker)) continue;
    const list = byBook.get(r.bookmaker) ?? [];
    list.push(r);
    byBook.set(r.bookmaker, list);
  }
  const out: V3LineSeries[] = [];
  for (const [bookmaker, list] of [...byBook.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const points: V3LinePoint1x2[] = [];
    for (const r of [...list].sort(byTime)) {
      const o = orientPartnerPrice(ours, r);
      if (!o || o.home == null || o.away == null) continue;
      const m = market1x2(o);
      points.push({
        t: new Date(r.captured_at).toISOString(),
        price: { home: o.home, draw: o.draw, away: o.away },
        market_p: m ? { home: roundP(m.p.home), draw: roundP(m.p.draw), away: roundP(m.p.away) } : null,
        margin: m ? roundP(m.margin) : null,
      });
    }
    out.push({
      market: "1X2",
      source: "partner_price_history",
      bookmaker,
      points,
      coverage: seriesCoverage(points.map((p) => p.t)),
    });
  }
  return out;
}

/** Asian handicap series per source, line as quoted for OUR home side. */
export function ahSeries(ours: { home: string; away: string }, rows: AhHistoryRow[]): V3LineSeries[] {
  const bySource = new Map<string, AhHistoryRow[]>();
  for (const r of rows) {
    const list = bySource.get(r.source) ?? [];
    list.push(r);
    bySource.set(r.source, list);
  }
  const oh = normName(ours.home);
  const oa = normName(ours.away);
  const out: V3LineSeries[] = [];
  for (const [source, list] of [...bySource.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const points: V3LinePointAh[] = [];
    for (const r of [...list].sort(byTime)) {
      if (r.ah_line == null || r.ah_odds_home == null || r.ah_odds_away == null) continue;
      const same = normName(r.home_name) === oh || normName(r.away_name) === oa;
      const swapped = !same && (normName(r.home_name) === oa || normName(r.away_name) === oh);
      if (!same && !swapped) continue;
      points.push({
        t: new Date(r.captured_at).toISOString(),
        // the handicap of the away side is the opposite of the home one
        line: swapped ? -r.ah_line : r.ah_line,
        price: swapped
          ? { home: r.ah_odds_away, away: r.ah_odds_home }
          : { home: r.ah_odds_home, away: r.ah_odds_away },
      });
    }
    out.push({ market: "AH", source: "ah_odds_history", bookmaker: source, points, coverage: seriesCoverage(points.map((p) => p.t)) });
  }
  return out;
}
