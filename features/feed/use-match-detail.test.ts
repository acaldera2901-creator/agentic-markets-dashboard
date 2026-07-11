import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMatchDetail } from "./use-match-detail";

beforeEach(() => vi.restoreAllMocks());

describe("useMatchDetail", () => {
  it("id null → nessun fetch", () => {
    const fetchSpy = vi.stubGlobal("fetch", vi.fn());
    const { result } = renderHook(() => useMatchDetail(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.detail).toBeNull();
  });
  it("trova la riga per match_id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      predictions: [{ match_id: "A", home_team: "X" }, { match_id: "B", home_team: "Inter" }] }) }));
    const { result } = renderHook(() => useMatchDetail("B"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.detail?.home_team).toBe("Inter");
  });
  it("match non presente in v1 → detail null, no error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ predictions: [{ match_id: "A" }] }) }));
    const { result } = renderHook(() => useMatchDetail("Z"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.detail).toBeNull();
    expect(result.current.error).toBeNull();
  });
  it("errore rete → error valorizzato", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { result } = renderHook(() => useMatchDetail("B"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });
});
