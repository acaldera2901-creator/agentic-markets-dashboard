import { describe, expect, it } from "vitest";
import { splitUnifiedFallback } from "./board-merge";

const r = (league: string) => ({ league });

describe("splitUnifiedFallback (#NATIONS-BOARD-0929)", () => {
  const fallback = [r("WC"), r("UNL"), r("CNL"), r("FRIENDLY"), r("UNL")];

  it("serves UNL/CNL even when match_predictions has club rows", () => {
    const out = splitUnifiedFallback([r("EL1"), r("BRA")], fallback);
    expect(out.usingFallback).toBe(false);
    expect(out.fallbackNations.map((p) => p.league)).toEqual(["UNL", "CNL", "UNL"]);
    expect(out.fallbackWc.map((p) => p.league)).toEqual(["WC"]);
    expect(out.fallbackNonWc).toEqual([]); // FRIENDLY keeps the off-season contract
  });

  it("off-season: everything served once, no Nations row counted twice", () => {
    const out = splitUnifiedFallback([], fallback);
    expect(out.usingFallback).toBe(true);
    expect(out.fallbackNonWc.map((p) => p.league)).toEqual(["FRIENDLY"]);
    const total =
      out.fallbackWc.length + out.fallbackNations.length + out.fallbackNonWc.length;
    expect(total).toBe(fallback.length);
  });
});
