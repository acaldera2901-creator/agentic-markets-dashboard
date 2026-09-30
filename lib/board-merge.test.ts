import { describe, expect, it } from "vitest";
import { splitUnifiedFallback } from "./board-merge";

const r = (league: string) => ({ league });

describe("splitUnifiedFallback (#NATIONS-BOARD-0929, #FRIENDLY-BOARD-0930)", () => {
  const fallback = [r("WC"), r("UNL"), r("CNL"), r("FRIENDLY"), r("UNL"), r("EL1")];

  it("serves UNL/CNL/FRIENDLY even when match_predictions has club rows", () => {
    const out = splitUnifiedFallback([r("EL1"), r("BRA")], fallback);
    expect(out.usingFallback).toBe(false);
    expect(out.fallbackNations.map((p) => p.league)).toEqual(["UNL", "CNL", "FRIENDLY", "UNL"]);
    expect(out.fallbackWc.map((p) => p.league)).toEqual(["WC"]);
    expect(out.fallbackNonWc).toEqual([]); // club rows in unified keep the off-season contract
  });

  it("off-season: everything served once, no national row counted twice", () => {
    const out = splitUnifiedFallback([], fallback);
    expect(out.usingFallback).toBe(true);
    expect(out.fallbackNonWc.map((p) => p.league)).toEqual(["EL1"]);
    const total =
      out.fallbackWc.length + out.fallbackNations.length + out.fallbackNonWc.length;
    expect(total).toBe(fallback.length);
  });
});
