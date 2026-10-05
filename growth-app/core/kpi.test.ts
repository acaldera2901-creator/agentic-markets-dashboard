import { describe, expect, it } from "vitest";
import { MISSING_KPIS, PAID_CHANNELS, formatAge, formatPct, funnelLinks, parseWindow, ratio, splitPaying, windowStartSql } from "./kpi";
import { buildSql } from "./sql";

describe("windows", () => {
  it("accepts only the three known windows, defaults to 7d", () => {
    expect(parseWindow("today")).toBe("today");
    expect(parseWindow("30d")).toBe("30d");
    expect(parseWindow(["7d", "30d"])).toBe("7d");
    expect(parseWindow(undefined)).toBe("7d");
    expect(parseWindow("1; DROP TABLE events")).toBe("7d");
  });

  it("'today' is the calendar day in Europe/Rome, not the last 24h", () => {
    expect(windowStartSql("today")).toContain("date_trunc('day', now() AT TIME ZONE 'Europe/Rome') AT TIME ZONE 'Europe/Rome'");
    expect(windowStartSql("7d")).toBe("(now() - interval '7 days')");
    expect(windowStartSql("30d")).toBe("(now() - interval '30 days')");
  });

  it("every windowed query uses the selected window start", () => {
    const sql = buildSql("30d");
    for (const k of ["traffic", "sources", "funnelEvents", "newProfiles", "channels", "revenue", "shopify", "partners", "widget", "lapsed"] as const) {
      expect(sql[k], k).toContain("interval '30 days'");
      expect(sql[k], k).not.toContain("interval '7 days'");
    }
  });

  it("queries are read-only and never select personal columns", () => {
    for (const s of Object.values(buildSql("7d"))) {
      expect(s).not.toMatch(/\b(insert|update|delete|drop|alter|create|truncate)\b/i);
      expect(s).not.toMatch(/\b(identifier|email|password_hash|name)\b/i);
      expect(s.trim().endsWith(";")).toBe(false); // exec_sql wraps the query in a subquery
    }
  });
});

describe("splitPaying — comp exclusion", () => {
  const rows = [
    { plan: "premium", plan_source: "paygate", expired: false, n: 3 },
    { plan: "base", plan_source: "paygate", expired: false, n: 1 },
    { plan: "premium", plan_source: "shopify", expired: true, n: 2 },
    { plan: "premium", plan_source: "manual", expired: false, n: 4 },
    { plan: "premium", plan_source: null, expired: false, n: 2 },
    { plan: "base", plan_source: "referral", expired: false, n: 1 },
    { plan: "admin_full", plan_source: null, expired: false, n: 2 },
    { plan: "free", plan_source: null, expired: false, n: 36 },
    { plan: "free", plan_source: "shopify", expired: true, n: 1 },
    { plan: "pending_payment", plan_source: null, expired: false, n: 5 },
  ];

  it("counts only paid-channel, non-expired base/premium as verified", () => {
    const s = splitPaying(rows);
    expect(s.verified).toBe(4);
    expect(s.expiredNotSwept).toBe(2);
    expect(s.comp).toBe(7); // manual + NULL + referral
    expect(s.inclComp).toBe(13);
    expect(s.verified + s.comp + s.expiredNotSwept).toBe(s.inclComp);
  });

  it("never counts team accounts or free as paying", () => {
    const s = splitPaying(rows);
    expect(s.team).toBe(2);
    expect(s.free).toBe(37);
  });

  it("paid channels match the subscriptions cron", () => {
    expect([...PAID_CHANNELS].sort()).toEqual(["paygate", "paypal", "shopify", "shopify_oneoff", "stripe"]);
  });
});

describe("funnel ratios", () => {
  it("returns null, not 0, when the previous step is empty", () => {
    expect(ratio(5, 0)).toBeNull();
    expect(ratio(0, 10)).toBe(0);
    expect(formatPct(null)).toBeNull();
    const links = funnelLinks([
      { label: "a", value: 200, unit: "" },
      { label: "b", value: 10, unit: "" },
      { label: "c", value: 0, unit: "" },
      { label: "d", value: 0, unit: "" },
    ]);
    expect(links.map((l) => l.rate)).toEqual([0.05, 0, null]);
  });

  it("formats ages like the torre", () => {
    expect(formatAge(null)).toBeNull();
    expect(formatAge(125)).toBe("2m");
    expect(formatAge(3 * 3600 + 5 * 60)).toBe("3h 05m");
    expect(formatAge(2 * 86400 + 3600)).toBe("2g 1h");
  });
});

describe("missing KPIs", () => {
  it("every MANCA tile says why, what unblocks it and who", () => {
    expect(MISSING_KPIS.length).toBeGreaterThanOrEqual(15);
    for (const m of MISSING_KPIS) {
      expect(m.why.length).toBeGreaterThan(5);
      expect(m.needs.length).toBeGreaterThan(5);
      expect(m.owner).toMatch(/^(Calde|Tommy|Andrea)$/);
    }
  });
});
