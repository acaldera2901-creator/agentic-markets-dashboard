import { describe, it, expect } from "vitest";
import { selectPickOfDay } from "./select-pick-of-day";
import type { PickCardVM } from "./pick-view-model";

const vm = (o: Partial<PickCardVM>): PickCardVM => ({
  id: "x", sport: "football", competition: "", kickoff: "", homeTeam: null, awayTeam: null,
  decision: "", odds: null, confidenceScore: 0, why: null, hasValue: false, locked: false, externalEventId: null,
  result: null, finalScore: null, settled: false, ...o,
});

describe("selectPickOfDay", () => {
  it("lista vuota → null", () => expect(selectPickOfDay([])).toBeNull());
  it("sceglie la confidenza più alta tra i non-locked", () => {
    const picks = [vm({ id: "a", confidenceScore: 60 }), vm({ id: "b", confidenceScore: 82 }), vm({ id: "c", confidenceScore: 75 })];
    expect(selectPickOfDay(picks)).toBe("b");
  });
  it("ignora i locked", () => {
    const picks = [vm({ id: "a", confidenceScore: 90, locked: true }), vm({ id: "b", confidenceScore: 70 })];
    expect(selectPickOfDay(picks)).toBe("b");
  });
  it("tutti locked → null", () => {
    expect(selectPickOfDay([vm({ id: "a", locked: true })])).toBeNull();
  });
  it("a parità di confidenza sceglie il primo in ordine di input", () => {
    expect(selectPickOfDay([vm({ id: "a", confidenceScore: 80 }), vm({ id: "b", confidenceScore: 80 })])).toBe("a");
  });
  it("gestisce confidenceScore null (trattato come 0)", () => {
    expect(selectPickOfDay([vm({ id: "a", confidenceScore: null }), vm({ id: "b", confidenceScore: 5 })])).toBe("b");
  });
});
