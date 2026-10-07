// Reference implementations of the two v7 quality rules, in TypeScript (#GROWTH-V7).
// The page computes them in SQL (core/sql.ts); scripts/verify.ts reads the raw
// rows and checks the SQL against these functions — two independent formulations
// of the same definition. Pure: no I/O.

import { CLIENT_ERROR_DEDUP_SECONDS } from "./sql";

export interface ErrorEvent {
  id: number;
  /** epoch ms */
  t: number;
  session: string | null;
  message: string | null;
  digest: string | null;
  path: string | null;
}

/**
 * Identical errors (same session — null with null —, message, digest, path) at most
 * `seconds` after the previous identical one are duplicates. Returns the kept ones.
 */
export function dedupErrors(events: ErrorEvent[], seconds = CLIENT_ERROR_DEDUP_SECONDS): ErrorEvent[] {
  const sorted = [...events].sort((a, b) => a.t - b.t || a.id - b.id);
  const last = new Map<string, number>();
  const kept: ErrorEvent[] = [];
  for (const e of sorted) {
    const k = JSON.stringify([e.session, e.message, e.digest, e.path]);
    const prev = last.get(k);
    if (prev === undefined || e.t - prev > seconds * 1000) kept.push(e);
    last.set(k, e.t);
  }
  return kept;
}

export type Outcome = "home" | "draw" | "away";

export interface ForecastRow {
  id: number;
  match_id: string;
  /** epoch ms */
  computed_at: number;
  kickoff: number;
  p: [number, number, number];
  market: [number, number, number] | null;
  result: Outcome;
}

/** Per match, the last forecast computed strictly before kick-off (ties: highest id). */
export function lastBeforeKickoff(rows: ForecastRow[]): ForecastRow[] {
  const best = new Map<string, ForecastRow>();
  for (const r of rows) {
    if (!(r.computed_at < r.kickoff)) continue;
    const b = best.get(r.match_id);
    if (!b || r.computed_at > b.computed_at || (r.computed_at === b.computed_at && r.id > b.id)) best.set(r.match_id, r);
  }
  return [...best.values()];
}

const IDX: Record<Outcome, number> = { home: 0, draw: 1, away: 2 };

/** Brier summed over the 3 outcomes (scale 0–2). */
export function brier3(p: readonly number[], result: Outcome): number {
  return p.reduce((s, x, k) => s + (x - (IDX[result] === k ? 1 : 0)) ** 2, 0);
}

export interface CalibrationRef {
  matches: number;
  brier: number | null;
  ece: number | null;
  market_matches: number;
  brier_same: number | null;
  brier_market: number | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Brier, ECE (10 bins, mean over the 3 outcomes) and the market on the same matches. */
export function calibrationOf(perMatch: ForecastRow[]): CalibrationRef {
  const n = perMatch.length;
  let eceSum = 0;
  for (let k = 0; k < 3; k++) {
    const bins = new Map<number, { n: number; p: number; y: number }>();
    for (const r of perMatch) {
      const p = r.p[k];
      const bin = Math.min(9, Math.floor(p * 10));
      const b = bins.get(bin) ?? { n: 0, p: 0, y: 0 };
      b.n += 1;
      b.p += p;
      b.y += IDX[r.result] === k ? 1 : 0;
      bins.set(bin, b);
    }
    for (const b of bins.values()) eceSum += b.n * Math.abs(b.p / b.n - b.y / b.n);
  }
  const withMarket = perMatch.filter((r) => r.market !== null);
  return {
    matches: n,
    brier: mean(perMatch.map((r) => brier3(r.p, r.result))),
    ece: n ? eceSum / n / 3 : null,
    market_matches: withMarket.length,
    brier_same: mean(withMarket.map((r) => brier3(r.p, r.result))),
    brier_market: mean(withMarket.map((r) => brier3(r.market!, r.result))),
  };
}
