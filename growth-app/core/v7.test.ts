// #GROWTH-V7 — the truth-audit fixes: internal accounts, deduplicated errors,
// Brier per match, one fold for internal/test sources, dead sources as MANCA.
import { describe, expect, it } from "vitest";
import internalJson from "@/content/internal-accounts.json";
import { INTERNAL_ENTRY_LABEL, foldInternal, isInternalSource } from "./estimate";
import { EMPTY_INTERNAL, countByReason, sqlIdArray, validateInternal } from "./internal";
import { MISSING_KPIS } from "./kpi";
import { type ErrorEvent, type ForecastRow, brier3, calibrationOf, dedupErrors, lastBeforeKickoff } from "./quality";
import { KNOWN_NOISE, knownNoise } from "./series";
import { CLIENT_ERROR_DEDUP_SECONDS, buildChainSql, buildSeriesSql, buildSql } from "./sql";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const file = (over: object = {}) => ({ schema: 1, generatedAt: "2026-10-07T08:00:00Z", rules: [], accounts: [], orders: [], paidPlanNoPayment: [], ...over });

describe("internal accounts list", () => {
  it("the committed file is valid and carries ids and reason codes only", () => {
    const l = validateInternal(internalJson);
    expect(l.accounts.length).toBeGreaterThan(0);
    const text = JSON.stringify(internalJson);
    expect(text).not.toMatch(/@/);
    // nothing but the documented keys: no identifier, name or email field
    for (const a of internalJson.accounts) expect(Object.keys(a).sort()).toEqual(["id", "reason"]);
    for (const o of internalJson.orders) expect(Object.keys(o).sort()).toEqual(["id", "reason", "table"]);
  });

  it("rejects e-mails, malformed ids and unknown reasons before any SQL is built", () => {
    expect(() => validateInternal(file({ accounts: [{ id: U1, reason: "team-plan" }], rules: ["a@b.c"] }))).toThrow(/@/);
    expect(() => validateInternal(file({ accounts: [{ id: "1'; DROP TABLE x;--", reason: "team-plan" }] }))).toThrow(/id profilo/);
    expect(() => validateInternal(file({ accounts: [{ id: U1, reason: "amico" }] }))).toThrow(/motivo/);
    expect(() => validateInternal(file({ orders: [{ table: "profiles", id: U1, reason: "internal-account" }] }))).toThrow(/tabella/);
    expect(() => validateInternal(file({ orders: [{ table: "shopify_events", id: "1 OR 1=1", reason: "internal-account" }] }))).toThrow(/ordine/);
    expect(() => validateInternal(file({ accounts: [{ id: U1, reason: "team-plan" }], paidPlanNoPayment: [{ id: U1, reason: "no-paid-order" }] }))).toThrow(/sia interno/);
    expect(() => validateInternal({})).toThrow(/schema/);
  });

  it("id arrays are typed literals; an empty list matches nothing", () => {
    expect(sqlIdArray([U1, U2], "uuid")).toBe(`ARRAY['${U1}','${U2}']::uuid[]`);
    expect(sqlIdArray([], "uuid")).toBe("ARRAY[]::uuid[]");
    expect(() => sqlIdArray(["x'"], "text")).toThrow();
  });

  it("counts per reason, never ids", () => {
    const c = countByReason(file({ accounts: [{ id: U1, reason: "team-plan" }, { id: U2, reason: "maven-domain" }], orders: [{ table: "paygate_orders", id: U1, reason: "internal-account" }] }) as never);
    expect(c).toEqual({ "account:team-plan": 1, "account:maven-domain": 1, "ordine:paygate_orders:internal-account": 1 });
    expect(JSON.stringify(c)).not.toContain(U1);
  });

  it("paying and revenue SQL exclude the lists by id and read no personal column", () => {
    const l = { ...EMPTY_INTERNAL, accounts: [U1], paidPlanNoPayment: [U2], orders: { paygate_orders: [U1], paypal_orders: [], shopify_events: ["123"] } };
    const q = buildSql("7d", l);
    expect(q.plans).toContain(`id = ANY(ARRAY['${U1}']::uuid[]) AS internal`);
    expect(q.plans).toContain(`id = ANY(ARRAY['${U2}']::uuid[]) AS no_payment`);
    expect(q.revenue).toContain(`id = ANY(ARRAY['${U1}']::uuid[]) AS internal`);
    expect(q.revenue).toMatch(/FILTER \(WHERE NOT internal\)::int AS orders_all/);
    expect(q.shopify).toContain("NOT event_id = ANY(ARRAY['123']::text[])");
    expect(q.lapsed).toContain(`NOT id = ANY(ARRAY['${U1}']::uuid[])`);
    expect(buildChainSql("30d", l)).toContain(`NOT id = ANY(ARRAY['${U2}']::uuid[])`);
    expect(buildSeriesSql(l).seriesOrders).toContain(`NOT id = ANY(ARRAY['${U1}']::uuid[])`);
    // profiles: only the columns v6 already read, plus id
    const profileCols = /\b(identifier|email|password_hash|reset_token_hash|name|stripe_\w+|tx_hash)\b/;
    for (const s of [...Object.values(q), buildChainSql("30d", l), ...Object.values(buildSeriesSql(l))]) expect(s).not.toMatch(profileCols);
  });
});

describe("client errors — identical within 5 s count once", () => {
  const e = (id: number, s: number, over: Partial<ErrorEvent> = {}): ErrorEvent => ({ id, t: s * 1000, session: null, message: "boom", digest: "d1", path: "/", ...over });

  it("the rule is 5 seconds and the SQL says so", () => {
    expect(CLIENT_ERROR_DEDUP_SECONDS).toBe(5);
    const f = buildSql("7d").funnelEvents;
    expect(f).toContain("PARTITION BY session_id, meta->>'message', meta->>'digest', meta->>'path'");
    expect(f).toContain("gap > interval '5 seconds'");
    expect(buildSeriesSql().seriesEvents).toContain("gap > interval '5 seconds'");
  });

  it("double-fired errors collapse; a different message, path or session does not", () => {
    expect(dedupErrors([e(1, 0), e(2, 1)])).toHaveLength(1);
    expect(dedupErrors([e(1, 0), e(2, 5)])).toHaveLength(1); // exactly 5 s: duplicate
    expect(dedupErrors([e(1, 0), e(2, 5.001)])).toHaveLength(2);
    expect(dedupErrors([e(1, 0), e(2, 1, { message: "other" })])).toHaveLength(2);
    expect(dedupErrors([e(1, 0), e(2, 1, { path: "/x" })])).toHaveLength(2);
    expect(dedupErrors([e(1, 0, { session: "a" }), e(2, 1, { session: "b" })])).toHaveLength(2);
  });

  it("the window is gap-based: a chain 3 s apart is one error", () => {
    expect(dedupErrors([e(1, 0), e(2, 3), e(3, 6), e(4, 9)])).toHaveLength(1);
    expect(dedupErrors([e(1, 0), e(2, 3), e(3, 20)])).toHaveLength(2);
  });
});

describe("Brier per match — the last forecast before kick-off", () => {
  const KO = Date.UTC(2026, 9, 1, 18);
  const f = (id: number, match: string, minsBefore: number, p: [number, number, number], result: ForecastRow["result"], market: ForecastRow["market"] = null): ForecastRow => ({
    id,
    match_id: match,
    computed_at: KO - minsBefore * 60_000,
    kickoff: KO,
    p,
    market,
    result,
  });

  it("keeps one row per match: latest before kick-off, never after", () => {
    const rows = [
      f(1, "m1", 600, [0.2, 0.3, 0.5], "home"),
      f(2, "m1", 10, [0.6, 0.2, 0.2], "home"),
      f(3, "m1", -5, [0.9, 0.05, 0.05], "home"), // after kick-off: ignored
      f(4, "m2", 30, [0.3, 0.3, 0.4], "away"),
    ];
    const last = lastBeforeKickoff(rows);
    expect(last.map((r) => r.id).sort()).toEqual([2, 4]);
  });

  it("70 snapshots of one match weigh as one match", () => {
    const many = Array.from({ length: 70 }, (_, i) => f(100 + i, "busy", 700 - i, [0.1, 0.1, 0.8], "home"));
    const c = calibrationOf(lastBeforeKickoff([...many, f(1, "quiet", 10, [0.8, 0.1, 0.1], "home")]));
    expect(c.matches).toBe(2);
    expect(c.brier).toBeCloseTo((brier3([0.1, 0.1, 0.8], "home") + brier3([0.8, 0.1, 0.1], "home")) / 2, 12);
  });

  it("the market is scored on the same matches only", () => {
    const c = calibrationOf([f(1, "a", 1, [0.5, 0.3, 0.2], "home", [0.6, 0.25, 0.15]), f(2, "b", 1, [0.2, 0.3, 0.5], "draw")]);
    expect(c.market_matches).toBe(1);
    expect(c.brier_same).toBeCloseTo(brier3([0.5, 0.3, 0.2], "home"), 12);
    expect(c.brier_market).toBeCloseTo(brier3([0.6, 0.25, 0.15], "home"), 12);
  });

  it("the SQL picks one forecast per match before kick-off and scores the market on the same rows", () => {
    const q = buildSql("7d").calibration;
    expect(q).toContain("DISTINCT ON (match_id)");
    expect(q).toContain("computed_at < kickoff");
    expect(q).toContain("ORDER BY match_id, computed_at DESC, id DESC");
    expect(q).toContain("AS brier_market");
    expect(q).not.toMatch(/LIMIT 20000/);
  });
});

describe("internal/test sources — one rule, never the country", () => {
  it("folds the explicit test sources of the audit", () => {
    for (const l of ["src:pr-check", "test123", "qa", "QA", "3Dcoldmail", "referrer:localhost", "referrer:localhost:3000", "referrer:127.0.0.1", "referrer:betredge-studio-0922.a-b-1.chatgpt.site", "referrer:betredge-preview-x.vercel.app"]) {
      expect(isInternalSource(l), l).toBe(true);
      expect(foldInternal(l), l).toBe(INTERNAL_ENTRY_LABEL);
    }
  });
  it("keeps real acquisition sources, the attribution holes and referral codes", () => {
    for (const l of ["coldmail", "ig", "chatgpt.com", "referrer:www.google.com", "referrer:someone.chatgpt.site", "(nessuna fonte)", "(diretto / nessuna fonte)", "(non registrata)", "ref:qa", "quality"]) {
      expect(isInternalSource(l), l).toBe(false);
    }
  });
  it("no source query filters on country", () => {
    const q = buildSql("30d");
    for (const k of ["sources", "entries", "channels"] as const) expect(q[k]).not.toMatch(/country/);
    expect(buildChainSql("30d")).not.toMatch(/country/);
  });
  it("sessions per source are not cut before the fold (no LIMIT in SQL)", () => {
    expect(buildSql("30d").sources).not.toMatch(/LIMIT/);
  });
});

describe("dead sources and missing KPIs", () => {
  it("error_patterns_log is no longer read: it is MANCA with what it needs", () => {
    expect(buildSql("7d").freshness).not.toContain("error_patterns_log");
    const m = MISSING_KPIS.find((x) => x.label === "Pattern di errore server");
    expect(m?.why).toMatch(/non alimentata/);
    expect(m?.needs).toBeTruthy();
  });
  it("Free → paid is listed as not measured, with what it needs and an owner", () => {
    const m = MISSING_KPIS.find((x) => x.label === "Free → paid");
    expect(m?.family).toBe("revenue");
    expect(m?.needs).toMatch(/cliente esterno pagante/);
    expect(m?.needs).toMatch(/G01/);
    expect(m?.owner).toBe("Calde");
  });
});

describe("known synthetic / own days (audit 07/10)", () => {
  it("annotates the audited days, nothing else", () => {
    expect(knownNoise("signup_started", "2026-10-06")).toMatch(/04:09/);
    expect(knownNoise("sessions", "2026-09-24")).toMatch(/sintetiche/);
    expect(knownNoise("signup_started", "2026-10-05")).toBeNull();
    expect(knownNoise("new_profiles", "2026-10-06")).toBeNull();
    for (const k of KNOWN_NOISE) expect(k.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
