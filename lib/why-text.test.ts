import { describe, it, expect } from "vitest";
import { formPhrase, goalsPhrase, scorerPhrase, confidenceWord } from "./why-text";

describe("why-text", () => {
  it("formPhrase: 4 vinte su 5 (IT/EN)", () => {
    expect(formPhrase({ w: 4, d: 0, l: 1 }, "it")).toBe("4 vittorie nelle ultime 5");
    expect(formPhrase({ w: 4, d: 0, l: 1 }, "en")).toBe("4 wins in the last 5");
  });
  it("formPhrase: mood buono / difficile / altalena", () => {
    expect(formPhrase({ w: 2, d: 1, l: 0 }, "it")).toBe("in un buon momento");
    expect(formPhrase({ w: 0, d: 1, l: 3 }, "it")).toBe("in un periodo difficile");
    expect(formPhrase({ w: 1, d: 1, l: 1 }, "it")).toBe("in forma altalenante");
    expect(formPhrase(null, "it")).toBeNull();
  });
  it("goalsPhrase con e senza Over", () => {
    expect(goalsPhrase(2.9, 2, 3, 0.58, "it")).toContain("Over 2.5 al 58%");
    expect(goalsPhrase(2.9, 2, 3, null, "it")).not.toContain("Over");
  });
  it("scorerPhrase formatta nome + %", () => {
    expect(scorerPhrase("Mbappé", 0.51, "it")).toContain("Mbappé");
    expect(scorerPhrase("Mbappé", 0.51, "it")).toContain("51%");
  });
  it("confidenceWord", () => {
    expect(confidenceWord(true, false, "it")).toBe("lettura solida");
    expect(confidenceWord(false, true, "it")).toContain("campione");
  });
});
