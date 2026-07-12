import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLeaderboard } from "./use-leaderboard";

const entry = {
  rank: 1, name: "Marco", points: 120, bets_won: 8, bets_total: 10,
  hit_rate: 80, sport: "football",
};

beforeEach(() => { vi.restoreAllMocks(); });

describe("useLeaderboard", () => {
  it("carica e mappa la leaderboard", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        leaderboard: [entry],
        system_wins: 40,
        system_hit_rate: 62,
        system_settled: 65,
        points_per_win: 10,
      }),
    }));
    const { result } = renderHook(() => useLeaderboard());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]).toEqual({
      rank: 1, name: "Marco", points: 120, betsWon: 8, betsTotal: 10,
      hitRate: 80, sport: "football",
    });
    expect(result.current.systemHitRate).toBe(62);
    expect(result.current.systemSettled).toBe(65);
    expect(result.current.pointsPerWin).toBe(10);
    expect(result.current.error).toBeNull();

    // FTC: no money fields ever exposed.
    expect(result.current.entries[0]).not.toHaveProperty("pnl");
    expect(result.current.entries[0]).not.toHaveProperty("roi");
    expect(result.current.entries[0]).not.toHaveProperty("stake");
    expect(result.current.entries[0]).not.toHaveProperty("profit");
  });

  it("gestisce system_hit_rate null (sotto la soglia)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        leaderboard: [],
        system_wins: null,
        system_hit_rate: null,
        system_settled: 5,
        points_per_win: 10,
      }),
    }));
    const { result } = renderHook(() => useLeaderboard());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.systemHitRate).toBeNull();
    expect(result.current.entries).toEqual([]);
  });

  it("gestisce l'errore di rete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { result } = renderHook(() => useLeaderboard());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.entries).toEqual([]);
    expect(result.current.systemHitRate).toBeNull();
  });
});
