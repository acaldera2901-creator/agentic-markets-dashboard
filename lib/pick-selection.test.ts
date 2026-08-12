import { describe, expect, it } from "vitest";
import { favouritePick } from "./pick-selection";

// #PICK-FAVOURITE-0812 — regression pins for the served pick direction.
// The bug being pinned: the previous argmax-EDGE selection put the pick on the
// longshot for 25 of the 26 board rows with a favourite ≥56% (2026-08-12).
describe("favouritePick", () => {
  it("picks the favourite even when the max edge sits on the longshot (Rangers case)", () => {
    // Rangers vs St Mirren, 2026-08-12 board: home 66%, but the model tops the
    // market most on the 9.00 away — old code selected AWAY.
    const r = favouritePick(0.66, 0.2, 0.14, 1.4, 5.0, 9.0);
    expect(r.selection).toBe("HOME");
  });

  it("reports the favourite's own edge, negative when the market is sharper (Fluminense case)", () => {
    // Fluminense vs Remo: p_home 0.6617, odds_home 1.45 → edge = 0.6617 − 1/1.45.
    const r = favouritePick(0.6617, 0.2126, 0.1257, 1.45, 4.47, 7.7);
    expect(r.selection).toBe("HOME");
    expect(r.edge).toBeCloseTo(0.6617 - 1 / 1.45, 4);
    expect(r.edge!).toBeLessThan(0);
  });

  it("selects AWAY when the away side is the favourite", () => {
    const r = favouritePick(0.19, 0.23, 0.58, 6.5, 4.75, 1.47);
    expect(r.selection).toBe("AWAY");
    expect(r.edge).toBeCloseTo(0.58 - 1 / 1.47, 4);
  });

  it("selects DRAW when the draw is the most probable outcome", () => {
    const r = favouritePick(0.3, 0.4, 0.3, 3.1, 3.0, 3.2);
    expect(r.selection).toBe("DRAW");
  });

  it("keeps the favourite but yields no edge when odds are missing", () => {
    const r = favouritePick(0.55, 0.25, 0.2, null, null, null);
    expect(r.selection).toBe("HOME");
    expect(r.edge).toBeNull();
  });

  it("never returns an edge from a degenerate price", () => {
    const r = favouritePick(0.55, 0.25, 0.2, 1, 4.0, 8.0);
    expect(r.selection).toBe("HOME");
    expect(r.edge).toBeNull();
  });
});
