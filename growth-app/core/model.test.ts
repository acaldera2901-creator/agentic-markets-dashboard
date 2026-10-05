import { describe, expect, it } from "vitest";
import { type RawExtras, type RawResults, type Row, normalize } from "./model";
import { MISSING_READ, type RawSeries, SERIES_METRICS } from "./series";
import { LIST_KEYS, SCALAR_KEYS, SERIES_KEYS } from "./sql";

const ok = (data: Row[]) => ({ ok: true as const, data });

const AS_OF = "2026-10-05T22:10:32.438Z"; // 06/10 00:10 in Rome → last full day 05/10
const SERIES = Object.fromEntries(SERIES_KEYS.map((k) => [k, ok([])])) as RawSeries;
const EXTRAS: RawExtras = { asOf: AS_OF, series: SERIES, chain: ok([]) };

function raw(over: Partial<RawResults> = {}): RawResults {
  const base = Object.fromEntries([...SCALAR_KEYS, ...LIST_KEYS].map((k) => [k, ok([])])) as RawResults;
  return {
    ...base,
    traffic: ok([{ page_views: 10, page_views_no_session: 2, sessions: 4, tools_sessions: 1, predictions_sessions: 0 }]),
    lapsed: ok([{ lapsed: 0 }]),
    freshness: ok([{ odds_age_s: null, football_age_s: 60, tennis_age_s: 120, error_patterns_24h: 0 }]),
    calibration: ok([{ n: 0, brier: null, ece: null }]),
    ...over,
  };
}

describe("normalize — absence is never a 0", () => {
  it("a scalar query with zero rows becomes a failure, not zeros", () => {
    const d = normalize("7d", raw({ funnelEvents: ok([]) }), EXTRAS);
    expect(d.funnelEvents.ok).toBe(false);
  });

  it("a failed read stays a failure", () => {
    const d = normalize("7d", raw({ revenue: { ok: false, error: "lettura fallita" } }), EXTRAS);
    expect(d.revenue).toEqual({ ok: false, error: "lettura fallita" });
  });

  it("a non-numeric value fails loud instead of becoming NaN or 0", () => {
    const d = normalize("7d", raw({ traffic: ok([{ page_views: "abc" }]) }), EXTRAS);
    expect(d.traffic.ok).toBe(false);
  });

  it("null ages and null Brier stay null (rendered n/d), real zeros stay zeros", () => {
    const d = normalize("7d", raw(), EXTRAS);
    expect(d.freshness.ok && d.freshness.data.odds_age_s).toBeNull();
    expect(d.calibration.ok && d.calibration.data.brier).toBeNull();
    expect(d.lapsed.ok && d.lapsed.data.lapsed).toBe(0);
    expect(d.traffic.ok && d.traffic.data.sessions).toBe(4);
  });

  it("an empty list is a genuine 'nothing', not a failure", () => {
    const d = normalize("30d", raw(), EXTRAS);
    expect(d.partners).toEqual({ ok: true, data: [] });
    expect(d.window).toBe("30d");
  });

  it("refuses a source that forgot a query", () => {
    const r = raw();
    delete (r as Partial<RawResults>).widget;
    expect(() => normalize("7d", r, EXTRAS)).toThrow(/widget/);
  });
});

describe("normalize — series and chain live in GrowthData, absence is ERRORE", () => {
  it("successful reads: real zeros for empty days, empty chain is a genuine nothing", () => {
    const d = normalize("7d", raw(), EXTRAS);
    expect(d.trends.days).toHaveLength(60);
    expect(d.trends.days.at(-1)).toBe("2026-10-05");
    expect(d.trends.errors).toEqual({});
    expect(d.trends.values.page_views?.every((x) => x === 0)).toBe(true);
    expect(d.chain).toEqual({ ok: true, data: [] });
  });

  it("a source that never read the series: every metric null with an error, never 0", () => {
    const d = normalize("7d", raw(), { ...EXTRAS, series: undefined });
    for (const m of SERIES_METRICS) {
      expect(d.trends.values[m.key], m.key).toBeNull();
      expect(d.trends.errors[m.key], m.key).toContain(MISSING_READ);
    }
  });

  it("one failed series query nulls only its metrics", () => {
    const d = normalize("7d", raw(), { ...EXTRAS, series: { ...SERIES, seriesProfiles: { ok: false, error: "lettura fallita" } } });
    expect(d.trends.values.new_profiles).toBeNull();
    expect(d.trends.errors.new_profiles).toBe("lettura fallita");
    expect(d.trends.values.page_views).not.toBeNull();
  });

  it("a missing or failed chain is a failure, not an empty list", () => {
    expect(normalize("7d", raw(), { ...EXTRAS, chain: undefined }).chain).toEqual({ ok: false, error: MISSING_READ });
    expect(normalize("7d", raw(), { ...EXTRAS, chain: { ok: false, error: "lettura fallita" } }).chain).toEqual({ ok: false, error: "lettura fallita" });
  });
});
