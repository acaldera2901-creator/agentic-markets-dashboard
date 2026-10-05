import { describe, expect, it } from "vitest";
import { BURST_MIN, NO_SESSION_COUNTRIES, type PvBucket, classifyBuckets, entryLabel } from "./estimate";
import { WINDOWS, windowStartSql } from "./kpi";
import { buildSql } from "./sql";

const b = (country: string | null, slot: number, noSession: number, withSession = 0): PvBucket => ({ country, slot, noSession, withSession });

describe("probably-human filter (STIMATO)", () => {
  it("no country is excluded entirely, with or without session", () => {
    const r = classifyBuckets([b(null, 1, 3, 2), b("", 2, 1, 1)]);
    expect(r).toEqual({ page_views: 7, excl_no_country: 7, excl_country: 0, excl_burst: 0, probably_human: 0 });
  });

  it("listed countries lose only their page views without session", () => {
    const r = classifyBuckets([b("US", 1, 4, 1), b("RU", 9, 1, 0)]);
    expect(r.excl_country).toBe(5);
    expect(r.probably_human).toBe(1);
  });

  it("a burst needs BURST_MIN no-session page views in the same country and slot", () => {
    const below = classifyBuckets([b("DE", 1, BURST_MIN - 1, 10)]);
    expect(below.excl_burst).toBe(0);
    expect(below.probably_human).toBe(BURST_MIN - 1 + 10);
    const at = classifyBuckets([b("DE", 1, BURST_MIN, 10)]);
    expect(at.excl_burst).toBe(BURST_MIN);
    expect(at.probably_human).toBe(10); // consented page views in the same slot stay
  });

  it("the burst does not spill over another slot or another country", () => {
    const r = classifyBuckets([b("DE", 1, BURST_MIN), b("DE", 2, 3), b("ES", 1, 3)]);
    expect(r.excl_burst).toBe(BURST_MIN);
    expect(r.probably_human).toBe(6);
  });

  it("rows of the same country and slot add up into one burst", () => {
    const r = classifyBuckets([b("IT", 5, BURST_MIN - 3), b("IT", 5, 3)]);
    expect(r.excl_burst).toBe(BURST_MIN);
  });

  it("classes are exclusive and always sum back to the raw count", () => {
    const rows = [b(null, 1, 5, 1), b("US", 1, 20, 0), b("NO", 1, 2, 30), b("DE", 3, 12, 1), b("ES", 3, 2)];
    const r = classifyBuckets(rows);
    expect(r.excl_no_country + r.excl_country + r.excl_burst + r.probably_human).toBe(r.page_views);
    expect(r).toEqual({ page_views: 73, excl_no_country: 6, excl_country: 20, excl_burst: 12, probably_human: 35 });
  });

  it("a listed country is counted as listed, not as a burst", () => {
    expect(classifyBuckets([b("SG", 1, 50)])).toMatchObject({ excl_country: 50, excl_burst: 0 });
  });

  it("the SQL carries the same thresholds and list", () => {
    const q = buildSql("30d").humanTraffic;
    expect(q).toContain(`>= ${BURST_MIN}`);
    for (const c of NO_SESSION_COUNTRIES) expect(q).toContain(`'${c}'`);
    expect(q).toContain("/ 600");
  });
});

describe("entry sources", () => {
  it("follows utm_source → src → crm → ref → referrer", () => {
    expect(entryLabel({ utm_source: "reddit", src: "tg", ref_host: "x.com" })).toBe("reddit");
    expect(entryLabel({ utm_source: "", src: "tg-free", ref_host: "x.com" })).toBe("src:tg-free");
    expect(entryLabel({ crm: "d3", ref_host: "x.com" })).toBe("crm:d3");
    expect(entryLabel({ ref: "abc", ref_host: "x.com" })).toBe("ref:abc");
    expect(entryLabel({ ref_host: "www.google.com" })).toBe("referrer:www.google.com");
  });

  it("no source key → not an entry with source", () => {
    expect(entryLabel({})).toBeNull();
    expect(entryLabel({ utm_source: "", ref_host: null })).toBeNull();
  });
});

describe("windows of the new queries", () => {
  it("each window's entries and humanTraffic use that window's start", () => {
    for (const { key } of WINDOWS) {
      const q = buildSql(key);
      expect(q.entries).toContain(`created_at >= ${windowStartSql(key)}`);
      expect(q.humanTraffic).toContain(`created_at >= ${windowStartSql(key)}`);
    }
  });
});
