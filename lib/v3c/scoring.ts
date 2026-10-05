// Scoring primitives for the sealed record and calibration: Brier, reliability
// buckets with Wilson intervals, paired difference CI, week bucketing.
import { wilson95 } from "@/lib/wilson";
import { LIMITED_SAMPLE_N, type Outcome, type Triple, type V3Interval, type V3ReliabilityBucket } from "./contracts";
import { OUTCOMES, roundP } from "./prob";

/** 3-outcome Brier score: Σ_k (p_k − y_k)², in [0, 2]. */
export function brier3(p: Triple, happened: Outcome): number {
  let s = 0;
  for (const o of OUTCOMES) {
    const y = o === happened ? 1 : 0;
    s += (p[o] - y) ** 2;
  }
  return s;
}

export function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Mean of paired differences with a 95% normal interval (mean ± 1.96·sd/√n).
 * null with fewer than 2 pairs (no variance estimate).
 */
export function pairedDifference(diffs: number[]): { mean: number; ci95: V3Interval } | null {
  const n = diffs.length;
  if (n < 2) return null;
  const m = diffs.reduce((a, b) => a + b, 0) / n;
  const variance = diffs.reduce((a, d) => a + (d - m) ** 2, 0) / (n - 1);
  const half = 1.959964 * Math.sqrt(variance / n);
  return { mean: m, ci95: { low: m - half, high: m + half } };
}

export const BUCKET_WIDTH = 0.1;

/** Index of the 10pp bucket of p; p = 1 falls in the last bucket. */
export function bucketIndex(p: number): number {
  const i = Math.floor(p / BUCKET_WIDTH + 1e-9);
  return Math.min(Math.max(i, 0), Math.round(1 / BUCKET_WIDTH) - 1);
}

/**
 * Reliability table: for each 10pp bucket of predicted probability, how often
 * the event actually happened, with a Wilson 95% interval. Empty buckets are
 * kept (n = 0) so the chart axis is stable.
 */
export function reliability(pairs: { p: number; hit: boolean }[]): V3ReliabilityBucket[] {
  const k = Math.round(1 / BUCKET_WIDTH);
  const acc = Array.from({ length: k }, () => ({ n: 0, sumP: 0, hits: 0 }));
  for (const { p, hit } of pairs) {
    if (!Number.isFinite(p) || p < 0 || p > 1) continue;
    const b = acc[bucketIndex(p)];
    b.n += 1;
    b.sumP += p;
    if (hit) b.hits += 1;
  }
  return acc.map((b, i) => {
    const w = wilson95(b.hits, b.n);
    return {
      from: roundP(i * BUCKET_WIDTH),
      to: roundP((i + 1) * BUCKET_WIDTH),
      n: b.n,
      mean_predicted: b.n ? roundP(b.sumP / b.n) : null,
      observed: w ? roundP(w.p) : null,
      ci95: w ? { low: roundP(w.low), high: roundP(w.high) } : null,
      limited_sample: b.n < LIMITED_SAMPLE_N,
    };
  });
}

/** Expand a 1X2 triple into the three (p, happened) pairs used for reliability. */
export function triplePairs(p: Triple, happened: Outcome): { p: number; hit: boolean }[] {
  return OUTCOMES.map((o) => ({ p: p[o], hit: o === happened }));
}

/** ISO date (YYYY-MM-DD) of the UTC Monday starting the week of `iso`. */
export function weekStartUtc(iso: string): string {
  const d = new Date(iso);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow));
  return monday.toISOString().slice(0, 10);
}
