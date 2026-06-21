import { describe, it, expect } from "vitest";
import { computeGoalscorerMarkets, GsPlayer, GsOdd } from "./goalscorer-model";

const P = (over: Partial<GsPlayer> = {}): GsPlayer => ({
  playerId: "1", name: "Striker", goalsPer90: 0.6, minutesShare: 1.0, tier: 1, ...over,
});

describe("computeGoalscorerMarkets", () => {
  it("P(segna) = 1 - e^-lambda su un caso noto (un solo giocatore => share=1)", () => {
    // share=1, minutesFactor=1 => lambdaPlayer = teamLambda = 1.5
    const out = computeGoalscorerMarkets(1.5, 0, [P({ name: "Solo", goalsPer90: 0.6 })], [], []);
    expect(out).toHaveLength(1);
    expect(out[0].pScores).toBeCloseTo(1 - Math.exp(-1.5), 10);
    expect(out[0].marketImplied).toBeNull();
    expect(out[0].edge).toBeNull();
  });

  it("pScores e` monotona nella share (g90 piu` alto => P piu` alta a parita` di team lambda)", () => {
    const out = computeGoalscorerMarkets(
      2.0, 0,
      [P({ name: "Big", goalsPer90: 0.9 }), P({ name: "Small", goalsPer90: 0.3 })],
      [], [],
    );
    const big = out.find((m) => m.name === "Big")!;
    const small = out.find((m) => m.name === "Small")!;
    expect(big.pScores).toBeGreaterThan(small.pScores);
    out.forEach((m) => {
      expect(m.pScores).toBeGreaterThan(0);
      expect(m.pScores).toBeLessThan(1);
    });
  });

  it("Edge = pScores - 1/best_price e sceglie il prezzo migliore tra piu` book", () => {
    const odds: GsOdd[] = [
      { playerName: "Solo", price: 2.0, bookmaker: "fanduel" },
      { playerName: "Solo", price: 2.5, bookmaker: "draftkings" }, // best (piu` alto)
    ];
    const out = computeGoalscorerMarkets(1.5, 0, [P({ name: "Solo", goalsPer90: 0.6 })], [], odds);
    expect(out[0].bestPrice).toBe(2.5);
    expect(out[0].bookmaker).toBe("draftkings");
    expect(out[0].marketImplied).toBeCloseTo(1 / 2.5, 10);
    expect(out[0].edge).toBeCloseTo(out[0].pScores - 1 / 2.5, 10);
  });

  it("match nome case/space-insensitive", () => {
    const odds: GsOdd[] = [{ playerName: "  LAMINE  yamal ", price: 1.8, bookmaker: "betmgm" }];
    const out = computeGoalscorerMarkets(1.5, 0, [P({ name: "Lamine Yamal", goalsPer90: 0.6 })], [], odds);
    expect(out[0].bestPrice).toBe(1.8);
  });

  it("ignora quote con price <= 1.0", () => {
    const odds: GsOdd[] = [{ playerName: "Solo", price: 1.0, bookmaker: "x" }];
    const out = computeGoalscorerMarkets(1.5, 0, [P({ name: "Solo" })], [], odds);
    expect(out[0].bestPrice).toBeNull();
    expect(out[0].edge).toBeNull();
  });

  it("minutesShare riduce lambda (panchina < titolare)", () => {
    const starter = computeGoalscorerMarkets(1.5, 0, [P({ name: "S", minutesShare: 1.0 })], [], [])[0];
    const bench = computeGoalscorerMarkets(1.5, 0, [P({ name: "B", minutesShare: 0.3 })], [], [])[0];
    expect(bench.pScores).toBeLessThan(starter.pScores);
  });

  it("topN e ordinamento per pScores desc, per squadra", () => {
    const players = [0.2, 0.9, 0.5, 0.1, 0.7, 0.3].map((g, i) =>
      P({ playerId: String(i), name: "P" + i, goalsPer90: g }));
    const out = computeGoalscorerMarkets(2.0, 0, players, [], [], 3);
    expect(out).toHaveLength(3); // solo home (away vuota)
    expect(out[0].pScores).toBeGreaterThanOrEqual(out[1].pScores);
    expect(out[1].pScores).toBeGreaterThanOrEqual(out[2].pScores);
  });

  it("fail-closed: somma g90 = 0 => nessun mercato per quella squadra", () => {
    const out = computeGoalscorerMarkets(1.5, 1.5,
      [P({ name: "Z", goalsPer90: 0 })],
      [P({ name: "A", goalsPer90: 0.5, tier: 2 })], []);
    expect(out.every((m) => m.side === "away")).toBe(true);
    expect(out[0].confidence).toBe("media"); // tier 2
  });

  it("lambda squadra <= 0 => nessun mercato per quella squadra", () => {
    const out = computeGoalscorerMarkets(0, 1.5, [P({ name: "H" })], [P({ name: "A" })], []);
    expect(out.every((m) => m.side === "away")).toBe(true);
  });
});
