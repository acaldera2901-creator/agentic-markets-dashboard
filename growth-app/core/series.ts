// Daily series, period-over-period comparison and anomaly flags. Pure: no I/O.
//
// Days are complete calendar days in Europe/Rome; today (partial) is excluded.
// A day with no rows is a REAL 0 only when its query succeeded; when the query
// failed the whole series is null (rendered empty), never 0.

import type { GrowthWindow } from "./kpi";
import type { Result, Row } from "./model";
import { SERIES_HISTORY_DAYS, type SeriesQueryKey } from "./sql";

export type RawSeries = Record<SeriesQueryKey, Result<Row[]>>;

/** Error for a read the source never performed (distinct from a failed one). */
export const MISSING_READ = "lettura mancante in questa sorgente";

export const SERIES_METRICS = [
  { key: "page_views", label: "Page view", query: "seriesEvents" },
  { key: "sessions", label: "Sessioni con consenso", query: "seriesEvents" },
  { key: "signup_started", label: "Signup avviati", query: "seriesEvents" },
  { key: "signup_completed", label: "Signup completati", query: "seriesEvents" },
  { key: "new_profiles", label: "Nuovi profili", query: "seriesProfiles" },
  { key: "partner_click", label: "Click partner", query: "seriesEvents" },
  { key: "client_error", label: "Errori client", query: "seriesEvents" },
  { key: "paid_orders", label: "Ordini pagati", query: "seriesOrders" },
] as const satisfies readonly { key: string; label: string; query: SeriesQueryKey }[];

export type SeriesMetric = (typeof SERIES_METRICS)[number]["key"];

export interface DailySeries {
  /** YYYY-MM-DD, oldest first, SERIES_HISTORY_DAYS complete Rome days ending yesterday. */
  days: string[];
  /** Per metric one value per day, or null when its query failed (never a fake 0). */
  values: Record<SeriesMetric, number[] | null>;
  /** Per metric the failure message, when values is null. */
  errors: Partial<Record<SeriesMetric, string>>;
}

/** Below this previous-period base a percentage is not shown (only the absolute delta). */
export const SMALL_SAMPLE_BASE = 20;
/** Days of baseline before a day can be flagged, and the threshold in standard deviations. */
export const ANOMALY_BASELINE_DAYS = 14;
export const ANOMALY_SIGMA = 2;

const ROME_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });

/** Calendar date in Europe/Rome of an instant, as YYYY-MM-DD. */
export function romeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`data non valida: ${iso}`);
  return ROME_DATE.format(d);
}

/** Pure calendar arithmetic on YYYY-MM-DD (no time zone involved). */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The `n` complete Rome days before the Rome day of `asOf`, oldest first. */
export function dayList(asOf: string, n = SERIES_HISTORY_DAYS): string[] {
  const today = romeDate(asOf);
  return Array.from({ length: n }, (_, i) => addDays(today, i - n));
}

export function windowDays(w: GrowthWindow): number {
  return w === "30d" ? 30 : 7; // "today" shows the 7-day trend
}

function fill(r: Result<Row[]>, days: string[], col: string): Result<number[]> {
  if (!r.ok) return r;
  const idx = new Map(days.map((d, i) => [d, i]));
  const out = new Array<number>(days.length).fill(0);
  for (const row of r.data) {
    const i = idx.get(String(row.day));
    // A day outside the expected range means the source and the page disagree on "today": fail loud.
    if (i === undefined) return { ok: false, error: `giorno inatteso ${String(row.day)}` };
    const v = Number(row[col]);
    if (!Number.isFinite(v)) return { ok: false, error: `valore non numerico in ${col}` };
    out[i] = v;
  }
  return { ok: true, data: out };
}

export function normalizeSeries(raw: RawSeries, asOf: string): DailySeries {
  const days = dayList(asOf);
  const values = {} as DailySeries["values"];
  const errors: DailySeries["errors"] = {};
  for (const m of SERIES_METRICS) {
    const r = raw[m.query] ? fill(raw[m.query], days, m.key) : ({ ok: false, error: `${MISSING_READ} (${m.query})` } as const);
    values[m.key] = r.ok ? r.data : null;
    if (!r.ok) errors[m.key] = r.error;
  }
  return { days, values, errors };
}

/** Index of the first day with a value > 0, or -1. Leading zeros may predate the tracking. */
export function firstNonZero(v: number[]): number {
  return v.findIndex((x) => x > 0);
}

export interface Comparison {
  current: number;
  previous: number;
  delta: number;
  /** Relative change; null when the base is a small sample (or 0). */
  pct: number | null;
  /** previous < SMALL_SAMPLE_BASE: show only the absolute delta + caveat. */
  smallSample: boolean;
  /** The first recorded value falls inside the previous period: its zeros may be "not tracked yet". */
  partialHistory: boolean;
}

/** Last `n` days vs the `n` days before them (same length). */
export function compare(v: number[], n: number): Comparison {
  if (v.length < 2 * n) throw new Error(`servono ${2 * n} giorni, ricevuti ${v.length}`);
  const cur = v.slice(v.length - n);
  const prev = v.slice(v.length - 2 * n, v.length - n);
  const current = cur.reduce((a, b) => a + b, 0);
  const previous = prev.reduce((a, b) => a + b, 0);
  const smallSample = previous < SMALL_SAMPLE_BASE;
  const first = firstNonZero(v);
  return {
    current,
    previous,
    delta: current - previous,
    pct: smallSample ? null : (current - previous) / previous,
    smallSample,
    partialHistory: first > v.length - 2 * n,
  };
}

export interface Anomaly {
  index: number;
  day: string;
  value: number;
  mean: number;
  sd: number;
  /** (value - mean) / sd */
  z: number;
}

/**
 * Days among the last `n` whose value is more than ANOMALY_SIGMA sample
 * standard deviations from the mean of the ANOMALY_BASELINE_DAYS days before.
 * A day is eligible only with ≥14 days of history since the first recorded
 * value; a flat baseline (sd = 0) flags nothing.
 */
export function anomalies(v: number[], days: string[], n: number): Anomaly[] {
  const first = firstNonZero(v);
  if (first < 0) return [];
  const out: Anomaly[] = [];
  for (let i = Math.max(v.length - n, first + ANOMALY_BASELINE_DAYS); i < v.length; i++) {
    const base = v.slice(i - ANOMALY_BASELINE_DAYS, i);
    const mean = base.reduce((a, b) => a + b, 0) / base.length;
    const sd = Math.sqrt(base.reduce((a, b) => a + (b - mean) ** 2, 0) / (base.length - 1));
    if (sd === 0) continue;
    const z = (v[i] - mean) / sd;
    if (Math.abs(z) > ANOMALY_SIGMA) out.push({ index: i, day: days[i], value: v[i], mean, sd, z });
  }
  return out;
}
