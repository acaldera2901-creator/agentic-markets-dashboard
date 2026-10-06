import { describe, expect, it } from "vitest";
import { addDays, anomalies, compare, dayList, normalizeSeries, romeDate, windowDays } from "./series";
import { SERIES_HISTORY_DAYS, buildChainSql, buildSeriesSql } from "./sql";

const ok = (data: Record<string, unknown>[]) => ({ ok: true as const, data });

describe("Rome days", () => {
  it("buckets by the Europe/Rome calendar day, not UTC", () => {
    expect(romeDate("2026-10-05T22:30:00Z")).toBe("2026-10-06"); // 00:30 CEST
    expect(romeDate("2026-12-31T23:30:00Z")).toBe("2027-01-01"); // 00:30 CET
    expect(romeDate("2026-10-05T21:59:59Z")).toBe("2026-10-05");
  });

  it("day arithmetic is calendar-only, across DST and month ends", () => {
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26"); // DST end
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-01-01", -60)).toBe("2025-11-02");
  });

  it("the window is N complete days ending yesterday (today is partial, excluded)", () => {
    const d = dayList("2026-10-05T22:05:53Z"); // 00:05 on 6 Oct in Rome
    expect(d).toHaveLength(SERIES_HISTORY_DAYS);
    expect(d[d.length - 1]).toBe("2026-10-05");
    expect(d[0]).toBe("2026-08-07");
    expect(new Set(d).size).toBe(d.length);
  });

  it("'today' shows the 7-day trend; 7d and 30d their own length", () => {
    expect(windowDays("today")).toBe(7);
    expect(windowDays("7d")).toBe(7);
    expect(windowDays("30d")).toBe(30);
  });
});

describe("days without data", () => {
  const asOf = "2026-10-05T10:00:00Z";

  it("a missing day is a real 0 when the query ran", () => {
    const s = normalizeSeries(
      {
        seriesEvents: ok([{ day: "2026-10-03", page_views: 12, sessions: 5, signup_started: 1, signup_completed: 0, partner_click: 0, client_error: 2 }]),
        seriesProfiles: ok([]),
        seriesOrders: ok([{ day: "2026-08-06", paid_orders: 1 }]),
        seriesHuman: ok([{ day: "2026-10-03", probably_human: 4, page_views_no_country: 6 }]),
      },
      asOf,
    );
    const pv = s.values.page_views!;
    expect(pv).toHaveLength(SERIES_HISTORY_DAYS);
    expect(pv[pv.length - 1]).toBe(0); // 4 Oct (yesterday for this asOf): no rows → 0
    expect(pv[pv.length - 2]).toBe(12);
    expect(s.values.new_profiles!.every((x) => x === 0)).toBe(true);
    expect(s.values.paid_orders![0]).toBe(1);
    expect(s.values.probably_human![pv.length - 2]).toBe(4);
    expect(s.values.page_views_no_country![pv.length - 2]).toBe(6);
  });

  it("a failed query leaves its metrics empty (null), never 0", () => {
    const s = normalizeSeries(
      { seriesEvents: { ok: false, error: "lettura fallita" }, seriesProfiles: ok([]), seriesOrders: ok([]), seriesHuman: ok([]) },
      asOf,
    );
    expect(s.values.page_views).toBeNull();
    expect(s.values.client_error).toBeNull();
    expect(s.errors.sessions).toBe("lettura fallita");
    expect(s.values.new_profiles).not.toBeNull();
  });

  it("a day outside the expected range fails the metric instead of being dropped", () => {
    const s = normalizeSeries({ seriesEvents: ok([]), seriesProfiles: ok([{ day: "2026-10-05", new_profiles: 3 }]), seriesOrders: ok([]), seriesHuman: ok([]) }, asOf);
    expect(s.values.new_profiles).toBeNull(); // 5 Oct is "today" for this asOf
    expect(s.errors.new_profiles).toMatch(/giorno inatteso/);
  });
});

describe("period comparison", () => {
  const flat = (n: number, v: number) => new Array(n).fill(v);

  it("same-length windows, absolute and relative delta when the base is ≥ 20", () => {
    const c = compare([...flat(53, 5), ...flat(7, 10)], 7); // prev 7×5=35, cur 70
    expect(c).toMatchObject({ current: 70, previous: 35, delta: 35, smallSample: false });
    expect(c.pct).toBeCloseTo(1);
  });

  it("a base under 20 gives only the absolute delta and the small-sample flag", () => {
    const c = compare([...flat(46, 1), ...flat(7, 2), ...flat(7, 9)], 7); // prev 14
    expect(c.previous).toBe(14);
    expect(c.delta).toBe(49);
    expect(c.pct).toBeNull();
    expect(c.smallSample).toBe(true);
    expect(compare([...flat(53, 0), ...flat(7, 3)], 7).pct).toBeNull(); // base 0: never +∞%
  });

  it("exactly 20 is not small", () => {
    const c = compare([...flat(46, 0), 20, ...flat(6, 0), ...flat(7, 1)], 7);
    expect(c.previous).toBe(20);
    expect(c.smallSample).toBe(false);
    expect(c.pct).toBeCloseTo(-0.65);
  });

  it("30d uses the 30 days before, and flags a previous period that predates the first record", () => {
    const v = [...flat(40, 0), ...flat(20, 4)];
    const c = compare(v, 30);
    expect(c.current).toBe(80);
    expect(c.previous).toBe(0);
    expect(c.partialHistory).toBe(true);
    expect(compare([...flat(60, 4)], 30).partialHistory).toBe(false);
  });
});

describe("anomalies", () => {
  const days = dayList("2026-10-05T10:00:00Z");
  const base14 = [10, 12, 9, 11, 10, 13, 8, 10, 11, 9, 12, 10, 11, 10]; // mean 10.43, sd ≈ 1.34

  it("flags a day more than 2 sd from the 14 days before it", () => {
    const v = [...new Array(45).fill(0), ...base14, 30];
    const a = anomalies(v, days, 7);
    expect(a).toHaveLength(1);
    expect(a[0].day).toBe("2026-10-04");
    expect(a[0].z).toBeGreaterThan(2);
  });

  it("does not flag a day inside 2 sd, and flags a drop as well as a spike", () => {
    expect(anomalies([...new Array(45).fill(0), ...base14, 12], days, 7)).toHaveLength(0);
    const drop = anomalies([...new Array(45).fill(0), ...base14, 1], days, 7);
    expect(drop[0].z).toBeLessThan(-2);
  });

  it("needs ≥ 14 days of history since the first record", () => {
    const v = [...new Array(50).fill(0), 10, 11, 9, 10, 12, 10, 11, 9, 10, 40]; // only 9 days of history
    expect(anomalies(v, days, 7)).toHaveLength(0);
    expect(anomalies(new Array(60).fill(0), days, 7)).toHaveLength(0);
  });

  it("a flat baseline (sd = 0) flags nothing", () => {
    expect(anomalies([...new Array(45).fill(3), ...new Array(14).fill(3), 4], days, 7)).toHaveLength(0);
  });

  it("only looks at the displayed window", () => {
    const v = [...new Array(20).fill(0), ...base14, 30, ...base14, ...base14.slice(0, 11)];
    expect(v).toHaveLength(60);
    expect(anomalies(v, days, 7)).toHaveLength(0); // the spike is 25 days ago
    expect(anomalies(v, days, 30).map((a) => a.index)).toContain(34);
  });
});

describe("new SQL", () => {
  it("is read-only, aggregate, with no personal columns", () => {
    for (const s of [...Object.values(buildSeriesSql()), buildChainSql("7d"), buildChainSql("30d"), buildChainSql("today")]) {
      expect(s).not.toMatch(/\b(insert|update|delete|drop|alter|create|truncate)\b/i);
      expect(s).not.toMatch(/\b(identifier|email|password_hash|name)\b/i);
      expect(s.trim().endsWith(";")).toBe(false);
    }
  });

  it("series stop at the start of today in Rome; the chain uses the selected window", () => {
    for (const s of Object.values(buildSeriesSql())) {
      expect(s).toContain("< (date_trunc('day', now() AT TIME ZONE 'Europe/Rome') AT TIME ZONE 'Europe/Rome')");
      expect(s).toContain(`interval '${SERIES_HISTORY_DAYS} days'`);
    }
    expect(buildChainSql("30d")).toContain("interval '30 days'");
    expect(buildChainSql("30d")).not.toContain("interval '7 days'");
  });
});
