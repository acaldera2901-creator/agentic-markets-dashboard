import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTrackRecord } from "./use-track-record";

const unlockedRow = {
  id: "1", sport: "football", competition: "Serie A",
  home_team: "Inter", away_team: "Verona", starts_at: "2026-07-10T18:45:00Z",
  status: "settled", result: "won", settled_at: "2026-07-10T20:45:00Z",
  locked: false, pick: "Inter", market: "1x2", final_score: "2-1",
};

const lockedRow = {
  id: "2", sport: "tennis", competition: "ATP", home_team: "Sinner", away_team: "Alcaraz",
  starts_at: "2026-07-11T14:00:00Z", status: "settled", result: "lost",
  settled_at: "2026-07-11T16:00:00Z", locked: true, final_score: "6-4 3-6 4-6",
};

const stats = { total: 2, won: 1, lost: 1, void: 0, pending: 0, win_rate: "50.0%" };

beforeEach(() => { vi.restoreAllMocks(); });

describe("useTrackRecord", () => {
  it("carica e mappa history + stats", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ history: [unlockedRow, lockedRow], stats }),
    }));
    const { result } = renderHook(() => useTrackRecord());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.history).toHaveLength(2);
    const [won, lost] = result.current.history;
    expect(won.decision).toBe("Vince l'Inter");
    expect(won.result).toBe("won");
    expect(won.finalScore).toBe("2-1");
    expect(won.locked).toBe(false);
    expect(lost.decision).toBeNull();
    expect(lost.locked).toBe(true);
    expect(lost.result).toBe("lost");

    expect(result.current.stats).toEqual({
      total: 2, won: 1, lost: 1, void: 0, pending: 0, winRate: "50.0%",
    });
    expect(result.current.error).toBeNull();
  });

  it("normalizza result sconosciuto a null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        history: [{ ...unlockedRow, result: "unresolved" }],
        stats,
      }),
    }));
    const { result } = renderHook(() => useTrackRecord());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.history[0].result).toBeNull();
  });

  it("passa ?sport= quando richiesto", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ history: [], stats }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() => useTrackRecord({ sport: "tennis" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v2/history?sport=tennis");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include" });
  });

  it("gestisce l'errore di rete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { result } = renderHook(() => useTrackRecord());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.history).toEqual([]);
    expect(result.current.stats).toBeNull();
  });
});
