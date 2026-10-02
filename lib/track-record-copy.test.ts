// #SPLIT-0201 — le diciture del track record: la riga del totale non si legge
// come il dato del partner, e ogni lingua ha la sua.
import { it, expect } from "vitest";
import { partnerTotalLine, ourPredictionsLabel } from "./track-record-copy";

const total = { winRate: "66.7%", n: 75 };

it("la riga sotto comincia da «Totale» in ogni lingua e porta X e N", () => {
  expect(partnerTotalLine("it", total)).toBe("Totale con le quote di mercato del partner: 66.7% su 75 pick");
  expect(partnerTotalLine("en", total)).toBe("Total including the partner's market prices: 66.7% on 75 picks");
  for (const l of ["es", "fr", "ru"]) {
    const s = partnerTotalLine(l, total);
    expect(s).toMatch(/^(Total|Итого)/);
    expect(s).toContain("66.7%");
    expect(s).toContain("75");
  }
});

it("l'etichetta del modello dice che sono le nostre predizioni e su quante pick", () => {
  expect(ourPredictionsLabel("it", 40)).toBe("hit rate delle nostre predizioni · 40 pick concluse");
  expect(ourPredictionsLabel("en", 40)).toBe("hit rate of our predictions · 40 settled picks");
  expect(ourPredictionsLabel("xx", 40)).toBe("hit rate of our predictions · 40 settled picks");
});
