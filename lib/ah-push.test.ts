// #AH-PUSH-0930 — audit agentic_codex 29/09. Sulle linee intere di handicap il
// "pareggio a handicap" rimborsa la puntata: quota equa ed EV devono trattarlo
// come rimborso, non come perdita. Numeri di riferimento dall'audit
// (λ 1,5/1, casa −1): push ~24,17%, quota equa ~3,08 (non 4,06), EV a quota 4
// ~+22,68% (non −1,5%).
import { describe, it, expect } from "vitest";
import { computeExtraMarkets, poisson, pushEdge, pushFairOdds } from "./poisson-model";
import { joinFpWithModel } from "./market-join";

function exact(lh: number, la: number, h: number) {
  let win = 0, push = 0;
  for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) {
    const p = poisson(i, lh) * poisson(j, la);
    if (i - j > -h) win += p;
    if (i - j === -h) push += p;
  }
  return { win, push };
}

describe("handicap intero: il push e' un rimborso", () => {
  it("casa −1 con λ 1,5/1: quota equa (1−push)/p ed EV p·o − (1−push)", () => {
    const m = computeExtraMarkets(1.5, 1, { "ah_home_-1": 4 }).find((x) => x.key === "ah_home_-1")!;
    const { win, push } = exact(1.5, 1, -1);
    expect(m.push).toBeCloseTo(push, 3);
    expect(push).toBeCloseTo(0.2417, 3);
    expect(m.model_odds).toBeCloseTo((1 - push) / win, 1);
    expect(m.model_odds).toBeLessThan(3.2); // prima 4,06
    expect(m.edge!).toBeCloseTo(win * 4 - (1 - push), 3);
    expect(m.edge!).toBeGreaterThan(0.2); // prima −0,015
  });

  it("trasferta +1 e' lo specchio: push quando la casa vince di 1", () => {
    const m = computeExtraMarkets(1.5, 1, {}).find((x) => x.key === "ah_away_1")!;
    let push = 0;
    for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) if (i - j === 1) push += poisson(i, 1.5) * poisson(j, 1);
    expect(m.push).toBeCloseTo(push, 3);
  });

  it("le mezze linee non hanno push e restano 1/p", () => {
    const m = computeExtraMarkets(1.5, 1, { "ah_home_-1_5": 3 }).find((x) => x.key === "ah_home_-1_5")!;
    expect(m.push).toBeUndefined();
    expect(m.model_odds).toBeCloseTo(1 / m.p, 1);
    expect(m.edge!).toBeCloseTo(m.p * 3 - 1, 3);
  });

  it("senza push le formule tornano quelle di sempre", () => {
    expect(pushFairOdds(0.5, 0)).toBe(2);
    expect(pushEdge(0.5, 0, 2.2)).toBeCloseTo(0.1, 6);
    expect(pushEdge(0.5, 0.2, null)).toBeNull();
  });

  it("market-join usa lo stesso push sulla quota del partner", () => {
    const extra = computeExtraMarkets(1.5, 1, {});
    const [joined] = joinFpWithModel(
      [{ name: "Goals Handicap", line: null, outcomes: [{ label: "Home (-1)", odds: 4 }] }] as never,
      extra,
      "Home",
      "Away",
    );
    const o = joined.outcomes[0];
    const { win, push } = exact(1.5, 1, -1);
    expect(o.p).toBeCloseTo(win, 3);
    expect(o.edge!).toBeCloseTo(win * 4 - (1 - push), 3);
    expect(o.fairOdds!).toBeCloseTo((1 - push) / win, 1);
  });
});

describe("Over/Under: la chiave, non la label", () => {
  it("il modello etichetta O2.5/U2.5 e ha le chiavi over_2_5/under_2_5", () => {
    const extra = computeExtraMarkets(1.5, 1, {});
    // il vecchio lookup della UI: label che contiene "over" ⇒ non trova niente
    expect(extra.find((x) => x.label.toLowerCase().includes("over") && x.label.includes("2.5"))).toBeUndefined();
    const over = extra.find((x) => x.key === "over_2_5")!;
    const under = extra.find((x) => x.key === "under_2_5")!;
    expect(over.p).toBeCloseTo(0.4562, 3);
    expect(over.p + under.p).toBeCloseTo(1, 3);
  });
});
