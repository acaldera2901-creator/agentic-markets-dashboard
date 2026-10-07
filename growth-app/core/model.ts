// The contract between data sources and the UI. Pure: no DB, no fs, no auth.
//
// A source (snapshot, live SQL, a future CRM backend) produces RawResults —
// the rows each query in sql.ts returned, or the failure — and normalize()
// turns them into GrowthData. The UI only ever sees GrowthData + SourceMeta,
// so it cannot know (or care) where the numbers came from.

import { type ChainRow, normalizeChain } from "./channels";
import type { GrowthWindow, PlanRow } from "./kpi";
import { type DailySeries, MISSING_READ, type RawSeries, normalizeSeries } from "./series";
import { LIST_KEYS, type QueryKey, SCALAR_KEYS } from "./sql";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type Row = Record<string, unknown>;
/** What a source hands over: per query, the raw rows or the failure. */
export type RawResults = Record<QueryKey, Result<Row[]>>;

/**
 * The reads that are not per-window scalars/lists: the daily series (relative
 * to asOf) and the window's source chain. A source that did not read them
 * passes undefined, and normalize() turns that into ERRORE — never into zeros.
 */
export interface RawExtras {
  /** The instant "today" refers to (the DB's now() for the reads). */
  asOf: string;
  series: RawSeries | undefined;
  chain: Result<Row[]> | undefined;
}

export interface SourceMeta {
  kind: "snapshot" | "live";
  /** ISO timestamp the numbers refer to (snapshot time, or read time for live). */
  asOf: string;
  /** Human description of the origin, shown in the page. */
  origin: string;
  /** LIVE only: the same read is served for up to this many seconds (per window, per server instance). */
  cacheTtlS?: number;
}

export interface Freshness {
  odds_age_s: number | null;
  football_age_s: number | null;
  tennis_age_s: number | null;
}

/** One forecast per match: the last computed before kick-off (core/sql.ts calibration). */
export interface Calibration {
  /** Settled matches scored. */
  matches: number;
  brier: number | null;
  ece: number | null;
  /** Matches that also have the three market probabilities. */
  market_matches: number;
  /** Our Brier on exactly those matches, and the market's. */
  brier_same: number | null;
  brier_market: number | null;
}

export interface GrowthData {
  window: GrowthWindow;
  traffic: Result<Record<string, number>>;
  sources: Result<{ source: string; sessions: number }[]>;
  funnelEvents: Result<Record<string, number>>;
  newProfiles: Result<Record<string, number>>;
  channels: Result<{ channel: string; n: number }[]>;
  plans: Result<PlanRow[]>;
  revenue: Result<Record<string, number>>;
  shopify: Result<Record<string, number>>;
  partners: Result<{ partner_id: string; clicks: number }[]>;
  widget: Result<{ host: string; views: number; clicks: number }[]>;
  lapsed: Result<{ lapsed: number }>;
  freshness: Result<Freshness>;
  calibration: Result<Calibration>;
  /** Entry page views with a source, per source label (measured). */
  entries: Result<{ source: string; entries: number }[]>;
  /** Raw page views and the "probably human" ESTIMATE (core/estimate.ts). */
  humanTraffic: Result<Record<string, number>>;
  /** Daily series: per metric one value per day, or null + error (never a fake 0). */
  trends: DailySeries;
  /** The window's source chain. */
  chain: Result<ChainRow[]>;
}

const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/** Scalar query: exactly one row, or it is a failure — never a silent 0. */
function one(r: Result<Row[]>): Result<Row> {
  if (!r.ok) return r;
  if (r.data.length !== 1) return { ok: false, error: `lettura fallita (attesa 1 riga, ricevute ${r.data.length})` };
  return { ok: true, data: r.data[0] };
}

function toNums(r: Result<Row>): Result<Record<string, number>> {
  if (!r.ok) return r;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.data)) {
    const n = num(v);
    // A non-numeric value here means the source is broken: fail loud.
    if (!Number.isFinite(n)) return { ok: false, error: `valore non numerico in ${k}` };
    out[k] = n;
  }
  return { ok: true, data: out };
}

function mapRows<T>(r: Result<Row[]>, f: (row: Row) => T): Result<T[]> {
  return r.ok ? { ok: true, data: r.data.map(f) } : r;
}

/** An older snapshot (rows, not matches) has no `matches`: that is a failed read, never a 0. */
function toCalibration(r: Row): Result<Calibration> {
  if (r.matches === undefined || r.market_matches === undefined) return { ok: false, error: "calibrazione nel formato vecchio (righe, non partite)" };
  return {
    ok: true,
    data: {
      matches: num(r.matches),
      brier: numOrNull(r.brier),
      ece: numOrNull(r.ece),
      market_matches: num(r.market_matches),
      brier_same: numOrNull(r.brier_same),
      brier_market: numOrNull(r.brier_market),
    },
  };
}

export function normalize(w: GrowthWindow, raw: RawResults, extras: RawExtras): GrowthData {
  for (const k of [...SCALAR_KEYS, ...LIST_KEYS]) {
    if (!raw[k]) throw new Error(`RawResults senza la query ${k}`);
  }
  const freshness = one(raw.freshness);
  const calibration = one(raw.calibration);
  const lapsed = toNums(one(raw.lapsed));
  return {
    window: w,
    traffic: toNums(one(raw.traffic)),
    sources: mapRows(raw.sources, (r) => ({ source: String(r.source), sessions: num(r.sessions) })),
    funnelEvents: toNums(one(raw.funnelEvents)),
    newProfiles: toNums(one(raw.newProfiles)),
    channels: mapRows(raw.channels, (r) => ({ channel: String(r.channel), n: num(r.n) })),
    plans: mapRows(raw.plans, (r) => ({
      plan: r.plan === null || r.plan === undefined ? null : String(r.plan),
      plan_source: r.plan_source === null || r.plan_source === undefined ? null : String(r.plan_source),
      expired: Boolean(r.expired),
      internal: Boolean(r.internal),
      no_payment: Boolean(r.no_payment),
      n: num(r.n),
    })),
    revenue: toNums(one(raw.revenue)),
    shopify: toNums(one(raw.shopify)),
    partners: mapRows(raw.partners, (r) => ({ partner_id: String(r.partner_id), clicks: num(r.clicks) })),
    widget: mapRows(raw.widget, (r) => ({ host: String(r.host), views: num(r.views), clicks: num(r.clicks) })),
    entries: mapRows(raw.entries, (r) => ({ source: String(r.source), entries: num(r.entries) })),
    humanTraffic: toNums(one(raw.humanTraffic)),
    lapsed: lapsed.ok ? { ok: true, data: { lapsed: lapsed.data.lapsed } } : lapsed,
    freshness: freshness.ok
      ? {
          ok: true,
          data: {
            odds_age_s: numOrNull(freshness.data.odds_age_s),
            football_age_s: numOrNull(freshness.data.football_age_s),
            tennis_age_s: numOrNull(freshness.data.tennis_age_s),
          },
        }
      : freshness,
    calibration: calibration.ok ? toCalibration(calibration.data) : calibration,
    // An absent series makes every metric fail with MISSING_READ (see normalizeSeries).
    trends: normalizeSeries(extras.series ?? ({} as RawSeries), extras.asOf),
    chain: extras.chain ? normalizeChain(extras.chain) : { ok: false, error: MISSING_READ },
  };
}
