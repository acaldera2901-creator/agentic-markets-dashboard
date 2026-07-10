import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePicks } from "./use-picks";

const row = {
  id: "1", sport: "football", competition: "Serie A", home_team: "Inter", away_team: "Verona",
  market: "1x2", pick: "Inter", odds: 1.55, edge_percent: 6, confidence_score: 78,
  explanation: "Forma.", plan_access: "free", starts_at: "2026-07-10T18:45:00Z", player_one: null, player_two: null,
  locked: false,
};

beforeEach(() => { vi.restoreAllMocks(); });

describe("usePicks", () => {
  it("carica e mappa le predizioni", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ predictions: [row], meta: {} }),
    }));
    const { result } = renderHook(() => usePicks());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.picks).toHaveLength(1);
    expect(result.current.picks[0].decision).toBe("Vince l'Inter");
    expect(result.current.error).toBeNull();
  });
  it("gestisce l'errore di rete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { result } = renderHook(() => usePicks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.picks).toEqual([]);
  });
});
