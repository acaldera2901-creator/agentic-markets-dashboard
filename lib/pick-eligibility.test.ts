// #PICK-FLOOR-0830
import { describe, it, expect } from "vitest";
import { goalPickSide, scorerPickEligible } from "./pick-eligibility";

describe("goalPickSide", () => {
  it("non marca nulla quando la riga e' sotto il floor", () => {
    expect(
      goalPickSide({ overP: 0.7, underP: 0.3, overOdds: 2.0, underOdds: 1.8, belowFloor: true }),
    ).toBeNull();
  });

  it("non marca nulla quando nessun lato raggiunge la soglia di edge", () => {
    // over: 0.52*1.90-1 = -0.012 ; under: 0.48*1.90-1 = -0.088
    expect(
      goalPickSide({ overP: 0.52, underP: 0.48, overOdds: 1.9, underOdds: 1.9, belowFloor: false }),
    ).toBeNull();
  });

  it("marca il lato con edge sopra soglia, non quello piu' probabile", () => {
    // over: 0.52*1.90-1 = -0.012 ; under: 0.48*2.30-1 = +0.104
    expect(
      goalPickSide({ overP: 0.52, underP: 0.48, overOdds: 1.9, underOdds: 2.3, belowFloor: false }),
    ).toBe("under");
  });

  it("non marca nulla se mancano le quote", () => {
    expect(
      goalPickSide({ overP: 0.6, underP: 0.4, overOdds: null, underOdds: null, belowFloor: false }),
    ).toBeNull();
  });

  it("marca un solo lato quando entrambi superano la soglia", () => {
    // over: 0.7*2.0-1 = +0.40 ; under: 0.3*3.9-1 = +0.17 -> vince l'edge maggiore
    expect(
      goalPickSide({ overP: 0.7, underP: 0.3, overOdds: 2.0, underOdds: 3.9, belowFloor: false }),
    ).toBe("over");
  });

  it("su una linea tipica senza valore, nessuna delle due chip e' raccomandata", () => {
    const side = goalPickSide({
      overP: 0.55,
      underP: 0.45,
      overOdds: 1.8,
      underOdds: 2.0,
      belowFloor: false,
    });
    expect(side === "over").toBe(false);
    expect(side === "under").toBe(false); // prima era garantito true su uno dei due
  });
});

describe("scorerPickEligible", () => {
  it("non marca il marcatore piu' probabile se non ha edge", () => {
    // 0.28 * 3.5 - 1 = -0.02
    expect(scorerPickEligible({ p: 0.28, odds: 3.5 })).toBe(false);
  });

  it("marca solo con edge sopra soglia", () => {
    // 0.32 * 3.6 - 1 = +0.152
    expect(scorerPickEligible({ p: 0.32, odds: 3.6 })).toBe(true);
  });

  it("non marca senza quota", () => {
    expect(scorerPickEligible({ p: 0.9, odds: null })).toBe(false);
  });
});