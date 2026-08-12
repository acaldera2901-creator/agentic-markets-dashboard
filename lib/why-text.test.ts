import { describe, it, expect } from "vitest";
import { formPhrase, goalsPhrase, scorerPhrase, confidenceWord, valuePhrase } from "./why-text";

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

describe("valuePhrase (#COVERAGE-0812-L2bis)", () => {
  const edge = { hasMarket: true, hasEdge: true, isBestBet: true } as const;

  it("con edge e value bet: dice che c'e' valore, col lato", () => {
    expect(valuePhrase(edge, " in casa", "it")).toBe("il modello la dà più probabile della quota: c'è valore in casa");
    expect(valuePhrase(edge, " on the home side", "en")).toContain("there's value on the home side");
  });

  it("con edge ma non value bet: mercato in linea", () => {
    expect(valuePhrase({ ...edge, isBestBet: false }, " in casa", "it")).toBe("il mercato è già in linea, nessun margine di valore");
  });

  // IL TEST CHE CONTA. Prima del 12/08 queste due righe cadevano nel ramo
  // "non c'è una quota di mercato: è la lettura del modello", che era falso su
  // ENTRAMBI i punti: la quota c'era e il modello no. Scattava su ogni prima
  // giornata di Champions ed Europa League.
  it("REGRESSIONE: con quote e senza edge NON dice mai che le quote mancano", () => {
    for (const reason of ["insufficient_data", "cross_competition"] as const) {
      for (const lang of ["it", "en"] as const) {
        const s = valuePhrase({ hasMarket: true, hasEdge: false, isBestBet: false, reason }, "", lang);
        expect(s, `${reason}/${lang}`).not.toContain("non c'è una quota");
        expect(s, `${reason}/${lang}`).not.toContain("no market price");
        // e non deve nemmeno spacciarla per una lettura del modello
        expect(s, `${reason}/${lang}`).not.toContain("lettura del modello");
        expect(s, `${reason}/${lang}`).not.toContain("model's read");
      }
    }
  });

  it("distingue lo strutturale (cross-lega) dal temporaneo (poche partite)", () => {
    const cross = valuePhrase({ hasMarket: true, hasEdge: false, isBestBet: false, reason: "cross_competition" }, "", "it");
    const few = valuePhrase({ hasMarket: true, hasEdge: false, isBestBet: false, reason: "insufficient_data" }, "", "it");
    expect(cross).toContain("campionati diversi");
    expect(few).toContain("troppe poche partite");
    expect(cross).not.toBe(few);
    // entrambe devono dire esplicitamente che non c'e' un pick
    expect(cross).toContain("non pubblichiamo un pick");
    expect(few).toContain("non pubblichiamo un pick");
  });

  it("senza quote resta la frase di prima: e' l'unico caso in cui e' vera", () => {
    const s = valuePhrase({ hasMarket: false, hasEdge: false, isBestBet: false }, "", "it");
    expect(s).toBe("non c'è una quota di mercato: è la lettura del modello, non una value bet");
  });

  it("nessun ramo promette di battere il mercato quando non c'e' edge", () => {
    for (const reason of [undefined, "insufficient_data", "cross_competition"] as const) {
      const s = valuePhrase({ hasMarket: true, hasEdge: false, isBestBet: false, reason }, "", "it");
      expect(s).not.toContain("c'è valore");
    }
  });
});
