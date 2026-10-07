import { describe, expect, it } from "vitest";
import { resolveTennisProbability } from "./tennis-probability";
import { applyTennisTemperature } from "./tennis-calibration";

const base = { p1: .8, p2: .2, odds_p1: 1.3, odds_p2: 4.2, edge: null };
const provenance = (source: string, raw_p1 = .8, raw_p2 = .2) => ({ probability: {
  version: "tennis-probability-v1", source, raw_p1, raw_p2,
} });

describe("explicit tennis probability contract", () => {
  it("calibrates both market sides exactly once and honors P2 even with edge zero", () => {
    const input = { ...base, edge: 0, best_selection: "P2", feature_snapshot: provenance("market") };
    const r = resolveTennisProbability(input);
    expect(r).toMatchObject({ source: "market", calibrationVersion: "tennis-temperature-1.68-v1", selection: "P2", raw: { p1: .8, p2: .2 }, selectedRawProbability: .2, selectedOdds: 4.2 });
    expect(r.published!.p1).toBe(applyTennisTemperature(.8));
    expect(r.published!.p2).toBe(applyTennisTemperature(.2));
    expect(r.confidence).toBe(Math.round(r.published!.p2 * 100));
    // Calling again with a published pair cannot compound the transform: the
    // provenance must match its raw input or be treated as unknown identity.
    const again = resolveTennisProbability({ ...input, ...r.published });
    expect(again.published).toEqual(r.published);
    expect(again.source).toBe("unknown");
  });
  it.each([undefined, {}, provenance("nonsense"), { probability: { ...provenance("market").probability, version: "future" } }, provenance("market", .7, .3)])("uses identity for unknown/malformed/mismatched metadata %j", feature_snapshot => {
    expect(resolveTennisProbability({ ...base, feature_snapshot })).toMatchObject({ source: "unknown", published: { p1: .8, p2: .2 }, calibrationVersion: "identity-v1" });
  });
  it("model stays identity whether edge is null or zero", () => {
    for (const edge of [null, 0]) expect(resolveTennisProbability({ ...base, edge, feature_snapshot: provenance("model") }).published).toEqual({ p1: .8, p2: .2 });
  });
  it("normalizes rounded market pairs symmetrically while retaining the exact raw pair", () => {
    const r = resolveTennisProbability({ ...base, p1: .7, p2: .3001, feature_snapshot: provenance("market", .7, .3001) });
    expect(r.raw).toEqual({ p1: .7, p2: .3001 });
    expect(r.published!.p1 + r.published!.p2).toBeCloseTo(1, 14);
    expect(r.published!.p1).toBe(applyTennisTemperature(.7 / 1.0001));
  });
  it.each([null, 0, 1, -2, NaN, Infinity])("invalid market odds %s prevent calibration", odds_p2 => {
    expect(resolveTennisProbability({ ...base, odds_p2, feature_snapshot: provenance("market") })).toMatchObject({ source: "unknown", published: { p1: .8, p2: .2 } });
  });
  it.each([[NaN,.2], [Infinity,.2], [-.1,1.1], [1.1,-.1], [.8,.8], [null,.2]])("rejects invalid pair %s/%s without direction", (p1,p2) => {
    expect(resolveTennisProbability({ ...base, p1, p2 })).toMatchObject({ raw: null, published: null, selection: null, confidence: null, selectedOdds: null });
  });
  it("has a deterministic favourite fallback, ties P1, and preserves extremes", () => {
    expect(resolveTennisProbability({ p1: .2, p2: .8, best_selection: "invalid" }).selection).toBe("P2");
    expect(resolveTennisProbability({ p1: .5, p2: .5 }).selection).toBe("P1");
    expect(resolveTennisProbability({ ...base, p1: 1, p2: 0, feature_snapshot: provenance("market",1,0) }).published).toEqual({ p1: 1, p2: 0 });
  });
});

describe("#TENNIS-PROB-PARTNER-1006 partner feed provenance", () => {
  const base = { p1: 0.7, p2: 0.3, odds_p1: 1.4, odds_p2: 3.1, edge: null, best_selection: null };
  it("partner-market-v1 rows without metadata are market and get the temperature", () => {
    const r = resolveTennisProbability({ ...base, model_version: "partner-market-v1" });
    expect(r.source).toBe("market");
    expect(r.published!.p1).toBeCloseTo(applyTennisTemperature(0.7, 1.68), 10);
  });
  it("partner rows without a valid price stay unknown", () => {
    expect(resolveTennisProbability({ ...base, odds_p2: null, model_version: "partner-market-v1" }).source).toBe("unknown");
  });
  it("other untagged rows stay unknown (no inference from odds/edge)", () => {
    expect(resolveTennisProbability({ ...base, model_version: "elo_surface_v4_features_odds" }).source).toBe("unknown");
  });
});
