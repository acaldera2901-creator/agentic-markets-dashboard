// #GROWTH-V5 — audit fixes: ratios never above 100%, the 30% no-country spike,
// internal referrers, Brier reference, the human daily series.
import { describe, expect, it } from "vitest";
import {
  BURST_MIN,
  HUMAN_FILTER_CRITERIA,
  INTERNAL_ENTRY_LABEL,
  NO_COUNTRY_SPIKE_SHARE,
  NO_SESSION_COUNTRIES,
  foldInternal,
  isInternalReferrer,
  noCountrySpike,
  splitEntries,
} from "./estimate";
import { BRIER_UNIFORM_3WAY, formatShare } from "./kpi";
import { coarsenRows } from "./privacy";
import { SERIES_METRICS } from "./series";
import { buildSeriesSql } from "./sql";

describe("ratios are never shown above 100%", () => {
  const why = "click > aperture: tracking incompleto";
  it("17 click on 15 opens → n/d with the reason, no percentage", () => {
    expect(formatShare(17, 15, why)).toBe(`n/d (${why})`);
    expect(formatShare(17, 15, why)).not.toMatch(/%/);
  });
  it("exactly 100% and below are shown", () => {
    expect(formatShare(15, 15, why)).toBe("100%");
    expect(formatShare(3, 15, why)).toBe("20%");
  });
  it("denominator 0 → n/d, never 0% or Infinity", () => {
    expect(formatShare(0, 0, why)).toBe("n/d");
    expect(formatShare(5, 0, why)).toBe("n/d");
  });
});

describe("no-country spike (> 30%)", () => {
  it("the threshold is 30% and strict", () => {
    expect(NO_COUNTRY_SPIKE_SHARE).toBe(0.3);
    expect(noCountrySpike(30, 100).spike).toBe(false);
    expect(noCountrySpike(31, 100).spike).toBe(true);
  });
  it("the audited day (649 of 702) is a spike", () => {
    const r = noCountrySpike(649, 702);
    expect(r.spike).toBe(true);
    expect(r.share).toBeCloseTo(0.9245, 3);
  });
  it("no page views → no share, no alert", () => {
    expect(noCountrySpike(0, 0)).toEqual({ share: null, spike: false });
  });
  it("the label no longer blames only local tests", () => {
    expect(HUMAN_FILTER_CRITERIA[0]).toMatch(/^senza paese: test locali, job sintetici o crawler \(causa non determinabile dai dati/);
  });
});

describe("internal referrers", () => {
  it("our studio previews on chatgpt.site and betredge* on vercel.app are internal", () => {
    expect(isInternalReferrer("betredge-studio-0922.mario-rossi-1.chatgpt.site")).toBe(true);
    expect(isInternalReferrer("BETREDGE-STUDIO-0922.x.chatgpt.site.")).toBe(true);
    expect(isInternalReferrer("betredge-growth-abc123-betredge.vercel.app")).toBe(true);
    expect(isInternalReferrer("betredge.vercel.app")).toBe(true);
  });
  it("other chatgpt.site / vercel.app hosts stay external acquisition", () => {
    expect(isInternalReferrer("someone-else.chatgpt.site")).toBe(false);
    expect(isInternalReferrer("chatgpt.com")).toBe(false);
    expect(isInternalReferrer("othersite.vercel.app")).toBe(false);
    expect(isInternalReferrer("betredge.vercel.app.evil.com")).toBe(false);
    expect(isInternalReferrer("www.google.com")).toBe(false);
  });
  it("only referrer labels are folded; utm/src keep their source", () => {
    expect(foldInternal("referrer:betredge-studio-0922.a-b-1.chatgpt.site")).toBe(INTERNAL_ENTRY_LABEL);
    expect(foldInternal("referrer:www.google.com")).toBe("referrer:www.google.com");
    expect(foldInternal("betredge-studio")).toBe("betredge-studio");
  });
  it("folded before coarsening: the personal subdomain never survives, other chatgpt.site entries stay as acquisition", () => {
    const rows = [
      { source: "referrer:betredge-studio-0922.mario-rossi-1.chatgpt.site", entries: 16 },
      { source: "referrer:other.chatgpt.site", entries: 2 },
      { source: "reddit", entries: 5 },
    ].map((r) => ({ ...r, source: foldInternal(r.source) }));
    const out = coarsenRows(rows, "source", "entries");
    expect(JSON.stringify(out)).not.toMatch(/mario|rossi|studio/);
    const { external, internal } = splitEntries(out);
    expect(internal).toBe(16);
    expect(external).toEqual([
      { source: "reddit", entries: 5 },
      { source: "referrer:chatgpt.site", entries: 2 },
    ]);
  });
});

describe("Brier reference", () => {
  it("1/3 to each outcome, summed over the 3 outcomes = 0.667", () => {
    const uniform = (2 / 3) ** 2 + 2 * (1 / 3) ** 2;
    expect(BRIER_UNIFORM_3WAY).toBeCloseTo(uniform, 12);
    expect(BRIER_UNIFORM_3WAY.toLocaleString("it-IT", { maximumFractionDigits: 3 })).toBe("0,667");
  });
});

describe("daily human series", () => {
  it("the human row comes first, the raw row stays next to it", () => {
    const keys = SERIES_METRICS.map((m) => m.key as string);
    expect(keys.slice(0, 3)).toEqual(["probably_human", "page_views", "page_views_no_country"]);
  });
  it("its SQL carries the same thresholds and list as the window estimate", () => {
    const q = buildSeriesSql().seriesHuman;
    expect(q).toContain(`>= ${BURST_MIN}`);
    for (const c of NO_SESSION_COUNTRIES) expect(q).toContain(`'${c}'`);
    expect(q).toContain("/ 600");
  });
});
