import { describe, expect, it } from "vitest";
import { TOOL_SLUGS } from "@/lib/tools/registry";
import { SAMPLE_BOOKS, SAMPLE_MATCH, SAMPLE_TOOLS, benchExample, bestBook, leadOutcome, sampleToolsCoverRegistry } from "./sample";

describe("v3c dati d'esempio (SAMPLE)", () => {
  it("copre esattamente gli 11 slug del registry", () => {
    expect(sampleToolsCoverRegistry()).toBe(true);
    expect(SAMPLE_TOOLS.map((t) => t.slug).sort()).toEqual([...TOOL_SLUGS].sort());
  });

  it("l'esito guida di Genoa — Fiorentina è Genoa, +4 pp", () => {
    const lead = leadOutcome(SAMPLE_MATCH.outcomes);
    expect(lead.label).toBe("Genoa");
    expect(lead.estimate - lead.market).toBe(4);
  });

  it("il best price arriva solo da un book con feed", () => {
    const b = bestBook(SAMPLE_MATCH.outcomes[0]);
    expect(b.code).toBe("NB");
    expect(b.feed).toBe(true);
    expect(SAMPLE_BOOKS.filter((x) => !x.feed).every((x) => SAMPLE_MATCH.outcomes[0].prices[x.code] == null)).toBe(true);
  });

  it("gli esempi del banco sono gli stessi numeri del prototipo", () => {
    expect(benchExample("ev-calculator")).toEqual({ input: "2.15 at 48%", output: "+3.2%", flat: false });
    expect(benchExample("margin-calculator").output).toBe("6.3%");
    expect(benchExample("probability-calculator")).toEqual({ input: "2.15 · 3.20 · 3.50", output: "44%", market: true });
    expect(benchExample("kelly-criterion").output).toBe("2.8% · €14");
    expect(benchExample("odds-converter").output).toBe("46.5%");
  });
});
