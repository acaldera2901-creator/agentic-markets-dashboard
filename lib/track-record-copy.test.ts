// #SPLIT-0201 — la riga di scomposizione del totale per fonte.
import { it, expect } from "vitest";
import { sourceBreakdownLine } from "./track-record-copy";

const b = { model: { winRate: "75.0%", n: 40 }, partner: { winRate: "57.1%", n: 35 } };

it("modello e partner, ciascuno con la sua percentuale e la sua n", () => {
  expect(sourceBreakdownLine("it", b)).toBe("Modello: 75.0% su 40 · Quote di mercato del partner: 57.1% su 35");
  expect(sourceBreakdownLine("en", b)).toBe("Model: 75.0% on 40 · Partner market prices: 57.1% on 35");
  expect(sourceBreakdownLine("fr", b)).toBe("Modèle : 75.0% sur 40 · Cotes de marché du partenaire : 57.1% sur 35");
  for (const l of ["es", "ru"]) {
    const s = sourceBreakdownLine(l, b);
    expect(s).toContain("75.0%");
    expect(s).toContain("57.1%");
  }
  expect(sourceBreakdownLine("xx", b)).toBe(sourceBreakdownLine("en", b));
});

it("sotto soglia: solo il numero di pick; partner senza pick: non compare", () => {
  expect(sourceBreakdownLine("it", { model: b.model, partner: { winRate: null, n: 3 } }))
    .toBe("Modello: 75.0% su 40 · Quote di mercato del partner: 3 pick");
  expect(sourceBreakdownLine("en", { model: b.model, partner: { winRate: null, n: 0 } }))
    .toBe("Model: 75.0% on 40");
});
