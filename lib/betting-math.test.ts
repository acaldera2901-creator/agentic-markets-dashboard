// lib/betting-math.test.ts (#TOOLS-HUB-0805)
// I casi attesi sono calcolati A MANO (vedi lo spec, §2), non presi dall'output
// del modulo: un test che copia il codice non dimostra niente.

import { describe, it, expect } from "vitest";
import {
  parseOdds,
  formatOdds,
  impliedProbability,
  probabilityToDecimal,
  bookmakerMargin,
  payoutPercent,
  noVigProbabilities,
  noVigOdds,
  expectedValue,
  kelly,
  parlayProbability,
  parlayOdds,
  arbitrage,
} from "./betting-math";

const near = (v: number | null | undefined, expected: number, digits = 6) => {
  expect(v).not.toBeNull();
  expect(v as number).toBeCloseTo(expected, digits);
};

describe("parseOdds", () => {
  it("legge il decimale, anche con la virgola europea", () => {
    near(parseOdds("2.50", "decimal"), 2.5);
    near(parseOdds("2,50", "decimal"), 2.5);
    near(parseOdds("  1.01 ", "decimal"), 1.01);
  });

  it("rifiuta i decimali che non sono quote", () => {
    expect(parseOdds("1", "decimal")).toBeNull(); // 1.00 non paga niente
    expect(parseOdds("0.5", "decimal")).toBeNull();
    expect(parseOdds("-2", "decimal")).toBeNull();
    expect(parseOdds("", "decimal")).toBeNull();
    expect(parseOdds("   ", "decimal")).toBeNull();
    expect(parseOdds("due e cinquanta", "decimal")).toBeNull();
  });

  it("converte l'americana nei due segni", () => {
    near(parseOdds("+150", "american"), 2.5);
    near(parseOdds("150", "american"), 2.5);
    near(parseOdds("-110", "american"), 1 + 100 / 110);
    near(parseOdds("-200", "american"), 1.5);
    near(parseOdds("+100", "american"), 2);
    near(parseOdds("-100", "american"), 2);
  });

  it("rifiuta le americane impossibili", () => {
    expect(parseOdds("+50", "american")).toBeNull();
    expect(parseOdds("-99", "american")).toBeNull();
    expect(parseOdds("0", "american")).toBeNull();
    expect(parseOdds("abc", "american")).toBeNull();
  });

  it("legge le frazionarie", () => {
    near(parseOdds("3/2", "fractional"), 2.5);
    near(parseOdds("11/4", "fractional"), 3.75); // 1 + 2.75
    near(parseOdds("10/11", "fractional"), 1 + 10 / 11);
    near(parseOdds("2", "fractional"), 3); // 2/1
  });

  it("rifiuta le frazionarie malformate", () => {
    expect(parseOdds("3/0", "fractional")).toBeNull();
    expect(parseOdds("0/1", "fractional")).toBeNull();
    expect(parseOdds("-3/2", "fractional")).toBeNull();
    expect(parseOdds("3/", "fractional")).toBeNull();
    expect(parseOdds("/2", "fractional")).toBeNull();
  });

  it("legge Hong Kong, indonesiane e malay", () => {
    near(parseOdds("1.50", "hongkong"), 2.5);
    near(parseOdds("0.90", "hongkong"), 1.9);
    expect(parseOdds("0", "hongkong")).toBeNull();
    expect(parseOdds("-0.5", "hongkong")).toBeNull();

    near(parseOdds("+1.50", "indonesian"), 2.5);
    near(parseOdds("-1.25", "indonesian"), 1.8);
    near(parseOdds("1", "indonesian"), 2);
    expect(parseOdds("0.5", "indonesian")).toBeNull(); // |i| < 1 non esiste
    expect(parseOdds("0", "indonesian")).toBeNull();

    near(parseOdds("0.90", "malay"), 1.9);
    near(parseOdds("-0.6667", "malay"), 1 + 1 / 0.6667);
    near(parseOdds("1", "malay"), 2);
    expect(parseOdds("1.5", "malay")).toBeNull(); // |m| > 1 non esiste
    expect(parseOdds("0", "malay")).toBeNull();
  });
});

describe("formatOdds", () => {
  it("scrive 2.50 in tutti i formati", () => {
    expect(formatOdds(2.5, "decimal")).toBe("2.50");
    expect(formatOdds(2.5, "american")).toBe("+150");
    expect(formatOdds(2.5, "fractional")).toBe("3/2");
    expect(formatOdds(2.5, "hongkong")).toBe("1.50");
    expect(formatOdds(2.5, "indonesian")).toBe("+1.50");
    expect(formatOdds(2.5, "malay")).toBe("-0.67");
  });

  it("scrive la -110 americana come 10/11", () => {
    const d = 1 + 100 / 110;
    expect(formatOdds(d, "decimal")).toBe("1.91");
    expect(formatOdds(d, "american")).toBe("-110");
    expect(formatOdds(d, "fractional")).toBe("10/11");
    expect(formatOdds(d, "indonesian")).toBe("-1.10");
    expect(formatOdds(d, "malay")).toBe("0.91");
  });

  it("tiene il confine di 2.00 coerente", () => {
    expect(formatOdds(2, "american")).toBe("+100");
    expect(formatOdds(2, "fractional")).toBe("1/1");
    expect(formatOdds(2, "hongkong")).toBe("1.00");
    expect(formatOdds(2, "indonesian")).toBe("+1.00");
    expect(formatOdds(2, "malay")).toBe("1.00");
  });

  it("non inventa niente su una quota invalida", () => {
    expect(formatOdds(1, "american")).toBe("—");
    expect(formatOdds(0, "decimal")).toBe("—");
    expect(formatOdds(Number.NaN, "fractional")).toBe("—");
  });
});

describe("probabilità implicita", () => {
  it("2.50 vale il 40%", () => {
    near(impliedProbability(2.5), 0.4);
  });

  it("la -110 americana vale il 52.38%", () => {
    near(impliedProbability(1 + 100 / 110), 0.523809, 5);
  });

  it("torna avanti e indietro", () => {
    near(probabilityToDecimal(0.4), 2.5);
    near(probabilityToDecimal(0.523809523809), 1 + 100 / 110, 5);
  });

  it("rifiuta gli impossibili", () => {
    expect(impliedProbability(1)).toBeNull();
    expect(impliedProbability(0)).toBeNull();
    expect(probabilityToDecimal(0)).toBeNull();
    expect(probabilityToDecimal(1)).toBeNull();
    expect(probabilityToDecimal(-0.2)).toBeNull();
  });
});

describe("margine del bookmaker", () => {
  it("su 1.90/1.90 il margine è 5.26% e il payout 95%", () => {
    near(bookmakerMargin([1.9, 1.9]), 0.0526315789, 8);
    near(payoutPercent([1.9, 1.9]), 0.95, 8);
  });

  it("su tre esiti somma tutte le probabilità implicite", () => {
    // 1/2.10 + 1/3.40 + 1/3.80 = 0.476190476 + 0.294117647 + 0.263157894 = 1.033466018
    near(bookmakerMargin([2.1, 3.4, 3.8]), 0.0334660, 6);
  });

  it("un mercato senza margine dà zero", () => {
    near(bookmakerMargin([2, 2]), 0);
  });

  it("serve almeno un mercato vero", () => {
    expect(bookmakerMargin([])).toBeNull();
    expect(bookmakerMargin([2])).toBeNull();
    expect(bookmakerMargin([2, 1])).toBeNull();
    expect(bookmakerMargin([2, Number.NaN])).toBeNull();
    expect(payoutPercent([])).toBeNull();
  });
});

describe("quote eque (no-vig)", () => {
  it("toglie il margine da un mercato a due esiti", () => {
    const probs = noVigProbabilities([1.9, 1.9])!;
    near(probs[0], 0.5);
    near(probs[1], 0.5);
    const fair = noVigOdds([1.9, 1.9])!;
    near(fair[0], 2);
    near(fair[1], 2);
  });

  it("su tre esiti le probabilità eque sommano esattamente a 1", () => {
    const probs = noVigProbabilities([2.1, 3.4, 3.8])!;
    near(probs.reduce((a, b) => a + b, 0), 1, 10);
    // 0.476190476 / 1.033466018 = 0.4607703
    near(probs[0], 0.4607703, 6);
  });

  it("tiene l'ordine degli esiti", () => {
    const probs = noVigProbabilities([1.5, 4.0])!;
    expect(probs[0]).toBeGreaterThan(probs[1]);
  });

  it("rifiuta input non validi", () => {
    expect(noVigProbabilities([2])).toBeNull();
    expect(noVigProbabilities([2, 0])).toBeNull();
    expect(noVigOdds([])).toBeNull();
  });
});

describe("valore atteso", () => {
  it("p=0.55 su quota 2.00 con 100 di stake vale +10", () => {
    const r = expectedValue({ probability: 0.55, decimal: 2, stake: 100 })!;
    near(r.ev, 10);
    near(r.evPercent, 10);
    near(r.edge, 0.1);
    near(r.fairDecimal, 1.8181818, 6);
  });

  it("mostra il negativo invece di nasconderlo", () => {
    const r = expectedValue({ probability: 0.45, decimal: 2, stake: 100 })!;
    near(r.ev, -10);
    near(r.edge, -0.1);
  });

  it("a quota equa l'EV è zero", () => {
    const r = expectedValue({ probability: 0.5, decimal: 2, stake: 50 })!;
    near(r.ev, 0);
    near(r.evPercent, 0);
  });

  it("rifiuta probabilità e stake impossibili", () => {
    expect(expectedValue({ probability: 0, decimal: 2, stake: 100 })).toBeNull();
    expect(expectedValue({ probability: 1, decimal: 2, stake: 100 })).toBeNull();
    expect(expectedValue({ probability: 1.2, decimal: 2, stake: 100 })).toBeNull();
    expect(expectedValue({ probability: 0.5, decimal: 1, stake: 100 })).toBeNull();
    expect(expectedValue({ probability: 0.5, decimal: 2, stake: 0 })).toBeNull();
    expect(expectedValue({ probability: 0.5, decimal: 2, stake: -10 })).toBeNull();
  });
});

describe("criterio di Kelly", () => {
  it("p=0.55 su 2.00 è il 10% del bankroll", () => {
    const r = kelly({ probability: 0.55, decimal: 2, bankroll: 1000, fraction: 1 })!;
    near(r.edge, 0.1);
    near(r.fullKelly, 0.1);
    near(r.stakeFraction, 0.1);
    near(r.stake, 100);
    // 0.55·ln(1.1) + 0.45·ln(0.9)
    near(r.growthRate, 0.0050082, 6);
  });

  it("il mezzo-Kelly dimezza lo stake", () => {
    const r = kelly({ probability: 0.55, decimal: 2, bankroll: 1000, fraction: 0.5 })!;
    near(r.fullKelly, 0.1);
    near(r.stakeFraction, 0.05);
    near(r.stake, 50);
  });

  it("senza edge non si punta nulla, e l'edge negativo resta visibile", () => {
    const r = kelly({ probability: 0.4, decimal: 2, bankroll: 1000, fraction: 1 })!;
    near(r.edge, -0.2);
    near(r.fullKelly, 0);
    near(r.stake, 0);
    near(r.growthRate, 0);
  });

  it("alla probabilità di break-even lo stake è zero", () => {
    const r = kelly({ probability: 0.5, decimal: 2, bankroll: 1000, fraction: 1 })!;
    near(r.stake, 0);
  });

  it("scala col bankroll", () => {
    const r = kelly({ probability: 0.6, decimal: 2.5, bankroll: 250, fraction: 1 })!;
    // f* = (0.6·2.5 − 1)/1.5 = 0.5/1.5 = 0.333333
    near(r.fullKelly, 0.3333333, 6);
    near(r.stake, 83.333333, 5);
  });

  it("rifiuta bankroll e frazioni impossibili", () => {
    expect(kelly({ probability: 0.55, decimal: 2, bankroll: 0, fraction: 1 })).toBeNull();
    expect(kelly({ probability: 0.55, decimal: 2, bankroll: -100, fraction: 1 })).toBeNull();
    expect(kelly({ probability: 0.55, decimal: 2, bankroll: 100, fraction: 0 })).toBeNull();
    expect(kelly({ probability: 0.55, decimal: 2, bankroll: 100, fraction: 1.5 })).toBeNull();
    expect(kelly({ probability: 0, decimal: 2, bankroll: 100, fraction: 1 })).toBeNull();
    expect(kelly({ probability: 0.55, decimal: 1, bankroll: 100, fraction: 1 })).toBeNull();
  });
});

describe("multipla", () => {
  it("tre eventi al 50% valgono il 12.5%", () => {
    near(parlayProbability([0.5, 0.5, 0.5]), 0.125);
  });

  it("tre quote 2.00 fanno 8.00", () => {
    near(parlayOdds([2, 2, 2]), 8);
  });

  it("un solo evento resta se stesso", () => {
    near(parlayProbability([0.4]), 0.4);
    near(parlayOdds([2.5]), 2.5);
  });

  it("la quota combinata è coerente con la probabilità combinata", () => {
    // 1.90 · 2.10 = 3.99; probabilità implicite 0.526315 · 0.476190 = 0.250626 = 1/3.99
    near(parlayOdds([1.9, 2.1]), 3.99);
    near(parlayProbability([1 / 1.9, 1 / 2.1]), 1 / 3.99, 8);
  });

  it("rifiuta liste vuote o membri impossibili", () => {
    expect(parlayProbability([])).toBeNull();
    expect(parlayProbability([0.5, 0])).toBeNull();
    expect(parlayProbability([0.5, 1])).toBeNull();
    expect(parlayOdds([])).toBeNull();
    expect(parlayOdds([2, 1])).toBeNull();
  });
});

describe("arbitrage", () => {
  it("2.10 e 2.10 su due book danno +5.00% e stake simmetrici", () => {
    const r = arbitrage({ decimals: [2.1, 2.1], total: 1000 });
    expect(r).not.toBeNull();
    expect(r!.impliedSum).toBeCloseTo(0.952381, 6);
    expect(r!.profitPercent).toBeCloseTo(0.05, 6);
    expect(r!.stakes[0]).toBeCloseTo(500, 6);
    expect(r!.stakes[1]).toBeCloseTo(500, 6);
    expect(r!.returns[0]).toBeCloseTo(1050, 6);
  });

  it("senza arbitraggio il profitto è negativo, non null", () => {
    const r = arbitrage({ decimals: [1.9, 1.9], total: 1000 });
    expect(r!.impliedSum).toBeCloseTo(1.052632, 6);
    expect(r!.profitPercent).toBeLessThan(0);
  });

  it("quote asimmetriche: 3.00 e 1.60 sbilanciano gli stake ma pareggiano il ritorno", () => {
    const r = arbitrage({ decimals: [3.0, 1.6], total: 1000 });
    // 1/3 + 1/1.6 = 0.333333 + 0.625 = 0.958333
    expect(r!.impliedSum).toBeCloseTo(0.958333, 6);
    expect(r!.returns[0]).toBeCloseTo(r!.returns[1], 6);
  });

  it("input non validi tornano null, non NaN", () => {
    expect(arbitrage({ decimals: [], total: 1000 })).toBeNull();
    expect(arbitrage({ decimals: [2.1, 0], total: 1000 })).toBeNull();
    expect(arbitrage({ decimals: [2.1, 2.1], total: 0 })).toBeNull();
  });
});
