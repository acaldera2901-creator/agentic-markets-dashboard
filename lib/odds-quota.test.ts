import { describe, it, expect, beforeEach } from "vitest";
import {
  oddsBudgetOk,
  observeRemaining,
  ODDS_RESERVE,
  _resetForTest,
  _peekRemaining,
} from "./odds-quota";

beforeEach(() => _resetForTest());

describe("#ODDS-QUOTA-GUARD guard logic", () => {
  it("fail-open: remaining ignoto → si può chiamare", () => {
    expect(_peekRemaining()).toBeNull();
    expect(oddsBudgetOk()).toBe(true);
  });

  it("blocca quando il remaining osservato è a/​sotto la riserva", () => {
    observeRemaining(String(ODDS_RESERVE));
    expect(oddsBudgetOk()).toBe(false);
    _resetForTest();
    observeRemaining(String(ODDS_RESERVE - 1));
    expect(oddsBudgetOk()).toBe(false);
  });

  it("consente quando il remaining osservato è sopra la riserva", () => {
    observeRemaining(String(ODDS_RESERVE + 5000));
    expect(oddsBudgetOk()).toBe(true);
  });

  it("tiene il MINIMO remaining visto tra più risposte (conservativo)", () => {
    observeRemaining("50000");
    observeRemaining("30000");
    observeRemaining("40000");
    expect(_peekRemaining()).toBe(30000);
  });

  it("ignora header nulli o non numerici (non falsa il minimo)", () => {
    observeRemaining("50000");
    observeRemaining(null);
    observeRemaining("garbage");
    observeRemaining("");
    expect(_peekRemaining()).toBe(50000);
  });
});
