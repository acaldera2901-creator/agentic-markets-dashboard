// #SPLIT-0201 — le diciture del track record.
import { it, expect } from "vitest";
import { ourPredictionsLabel } from "./track-record-copy";

it("l'etichetta del modello dice che sono le nostre predizioni e su quante pick", () => {
  expect(ourPredictionsLabel("it", 40)).toBe("hit rate delle nostre predizioni · 40 pick concluse");
  expect(ourPredictionsLabel("en", 40)).toBe("hit rate of our predictions · 40 settled picks");
  expect(ourPredictionsLabel("xx", 40)).toBe("hit rate of our predictions · 40 settled picks");
});
