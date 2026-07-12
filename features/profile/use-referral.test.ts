import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useReferral } from "./use-referral";

beforeEach(() => { vi.restoreAllMocks(); });

describe("useReferral", () => {
  it("carica code+signups+paid (200)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: "ABC123", signups: 4, paid: 2 }),
    }));
    const { result } = renderHook(() => useReferral());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.code).toBe("ABC123");
    expect(result.current.signups).toBe(4);
    expect(result.current.paid).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it("403 → nessun codice, non è un errore", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "no referral code claimed" }),
    }));
    const { result } = renderHook(() => useReferral());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.code).toBeNull();
    expect(result.current.signups).toBe(0);
    expect(result.current.paid).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("401 → nessun codice, non è un errore (anonimo)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "unauthorized" }),
    }));
    const { result } = renderHook(() => useReferral());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.code).toBeNull();
    expect(result.current.signups).toBe(0);
    expect(result.current.paid).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("errore di rete diverso da 403 → error valorizzato", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const { result } = renderHook(() => useReferral());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.code).toBeNull();
  });

  it("claim ok → POST /api/referral/claim e ri-fetcha le stats", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: "no referral code claimed" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: "NEWCODE", signups: 0, paid: 0 }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useReferral());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.code).toBeNull();

    let claimResult: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      claimResult = await result.current.claim("NEWCODE");
    });

    expect(claimResult).toEqual({ ok: true });
    await waitFor(() => expect(result.current.code).toBe("NEWCODE"));

    const [, claimCall] = fetchMock.mock.calls;
    expect(claimCall[0]).toBe("/api/referral/claim");
    expect(claimCall[1]).toMatchObject({ method: "POST", credentials: "include" });
    expect(JSON.parse(claimCall[1].body)).toEqual({ code: "NEWCODE" });
  });

  it("claim 409 → {ok:false, error} senza throw e senza ri-fetch", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: "ABC123", signups: 1, paid: 0 }) })
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: "already claimed" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useReferral());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let claimResult: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      claimResult = await result.current.claim("TAKEN");
    });

    expect(claimResult).toEqual({ ok: false, error: "already claimed" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.code).toBe("ABC123");
  });
});
