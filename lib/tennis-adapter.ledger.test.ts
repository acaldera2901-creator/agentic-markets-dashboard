import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbQuery: mock.query }));
import { syncTennisPredictionsToUnified } from "./tennis-adapter";
const fixture = { match_id: "tennis:test", tournament: "Test Open", surface: "hard", player1: "A", player2: "B", scheduled_at: "2099-09-21T16:00:00Z", p1: .6, p2: .4, odds_p1: 1.7, odds_p2: 2.4, edge: null, best_selection: "P1", model_version: "test-v1" };
beforeEach(() => { vi.clearAllMocks(); mock.query.mockImplementation(async (sql: string) => sql.includes("FROM tennis_predictions") ? [fixture] : []); });
describe("tennis prospective ledger capture", () => {
  it("captures the persisted published prediction with database time and immutable conflict handling", async () => {
    await syncTennisPredictionsToUnified();
    const calls = mock.query.mock.calls;
    const ledger = calls.find(([sql]) => sql.includes("INSERT INTO pick_ledger"));
    expect(ledger).toBeDefined();
    expect(ledger![0]).toContain("FROM unified_predictions");
    expect(ledger![0]).toContain("starts_at > NOW()");
    expect(ledger![0]).toContain("ON CONFLICT (source_table, source_id, model_version) DO NOTHING");
    expect(ledger![0]).not.toMatch(/DO UPDATE|is_backfill/);
    expect(ledger![1]).toEqual(["tennis_predictions", fixture.match_id]);
    expect(calls.findIndex(([sql]) => sql.includes("INSERT INTO unified_predictions"))).toBeLessThan(calls.indexOf(ledger!));
  });
  it("does not capture when publication failed", async () => {
    mock.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tennis_predictions")) return [fixture];
      if (sql.includes("INSERT INTO unified_predictions")) throw new Error("database unavailable");
      return [];
    });
    await expect(syncTennisPredictionsToUnified()).rejects.toThrow("database unavailable");
    expect(mock.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO pick_ledger"))).toBe(false);
  });
  it("reports ledger failure without destroying the published prediction", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mock.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tennis_predictions")) return [fixture];
      if (sql.includes("INSERT INTO pick_ledger")) throw new Error("ledger offline");
      return [];
    });
    await syncTennisPredictionsToUnified();
    expect(warn).toHaveBeenCalledWith("tennis pick_ledger write failed (non-fatal):", expect.any(Error));
    warn.mockRestore();
  });
});
