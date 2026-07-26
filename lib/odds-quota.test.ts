import { describe, it, expect, beforeEach, vi } from "vitest";

const dbQuery = vi.fn(async (..._a: unknown[]) => [] as unknown[]);
vi.mock("@/lib/db", () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));

import {
  oddsBudgetOk,
  observeRemaining,
  seedOddsRemaining,
  persistOddsRemaining,
  ODDS_RESERVE,
  _resetForTest,
  _peekRemaining,
} from "./odds-quota";

beforeEach(() => {
  _resetForTest();
  dbQuery.mockClear();
  dbQuery.mockResolvedValue([]);
});

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

// #ODDS-PLAN-5M + #ODDS-DEADLOCK-FIX (2026-07-26)
describe("piano 5M + niente deadlock del gate", () => {
  it("seed di una riga esausta sul VECCHIO tetto (100k/100k) NON blocca più: col piano 5M il remaining è alto", async () => {
    dbQuery.mockResolvedValueOnce([{ requests_made: 100_000, requests_limit: 5_000_000 }]);
    await seedOddsRemaining();
    // 5M − 100k = 4.9M, ben sopra la riserva → gate aperto (prima era 0 → chiuso).
    expect(_peekRemaining()).toBe(4_900_000);
    expect(oddsBudgetOk()).toBe(true);
  });

  it("persist NON scrive se in questo run non abbiamo osservato l'header (evita il re-lock della riga stantìa)", async () => {
    dbQuery.mockResolvedValueOnce([{ requests_made: 5_000_000, requests_limit: 5_000_000 }]);
    await seedOddsRemaining();          // remainingSeen dal seed (gate chiuso), non dall'header
    dbQuery.mockClear();
    await persistOddsRemaining();
    expect(dbQuery).not.toHaveBeenCalled(); // niente re-persist → la riga invecchia → recovery
  });

  it("persist scrive dopo aver osservato un header reale", async () => {
    observeRemaining("4900000");         // header reale del piano 5M
    await persistOddsRemaining();
    expect(dbQuery).toHaveBeenCalledTimes(1);
    const args = dbQuery.mock.calls[0] as unknown[];
    const params = args[1] as number[];
    // params: [provider, used, limit] → used = 5M − 4.9M = 100k, limit = 5M
    expect(params[1]).toBe(100_000);
    expect(params[2]).toBe(5_000_000);
  });
});
