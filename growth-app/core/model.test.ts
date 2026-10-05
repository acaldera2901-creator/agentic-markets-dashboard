import { describe, expect, it } from "vitest";
import { type RawResults, type Row, normalize } from "./model";
import { LIST_KEYS, SCALAR_KEYS } from "./sql";

const ok = (data: Row[]) => ({ ok: true as const, data });

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
    const d = normalize("7d", raw({ funnelEvents: ok([]) }));
    expect(d.funnelEvents.ok).toBe(false);
  });

  it("a failed read stays a failure", () => {
    const d = normalize("7d", raw({ revenue: { ok: false, error: "lettura fallita" } }));
    expect(d.revenue).toEqual({ ok: false, error: "lettura fallita" });
  });

  it("a non-numeric value fails loud instead of becoming NaN or 0", () => {
    const d = normalize("7d", raw({ traffic: ok([{ page_views: "abc" }]) }));
    expect(d.traffic.ok).toBe(false);
  });

  it("null ages and null Brier stay null (rendered n/d), real zeros stay zeros", () => {
    const d = normalize("7d", raw());
    expect(d.freshness.ok && d.freshness.data.odds_age_s).toBeNull();
    expect(d.calibration.ok && d.calibration.data.brier).toBeNull();
    expect(d.lapsed.ok && d.lapsed.data.lapsed).toBe(0);
    expect(d.traffic.ok && d.traffic.data.sessions).toBe(4);
  });

  it("an empty list is a genuine 'nothing', not a failure", () => {
    const d = normalize("30d", raw());
    expect(d.partners).toEqual({ ok: true, data: [] });
    expect(d.window).toBe("30d");
  });

  it("refuses a source that forgot a query", () => {
    const r = raw();
    delete (r as Partial<RawResults>).widget;
    expect(() => normalize("7d", r)).toThrow(/widget/);
  });
});
