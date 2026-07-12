import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useProfile } from "./use-profile";

beforeEach(() => { vi.restoreAllMocks(); });

describe("useProfile", () => {
  it("carica e mappa il profilo (200)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ identifier: "u1", plan: "pro", name: "Andrea", plan_expires_at: "2026-08-01T00:00:00Z" }),
    }));
    const { result } = renderHook(() => useProfile());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loggedIn).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.profile).toEqual({
      identifier: "u1",
      name: "Andrea",
      plan: "pro",
      planExpiresAt: "2026-08-01T00:00:00Z",
    });
  });

  it("401 → anonimo, non è un errore", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "unauthorized" }),
    }));
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loggedIn).toBe(false);
    expect(result.current.profile).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("errore di rete diverso da 401 → error valorizzato", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loggedIn).toBe(false);
    expect(result.current.error).not.toBeNull();
  });

  it("logout chiama POST /api/auth {action:logout} e azzera il profilo", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ identifier: "u1", plan: "pro", name: "Andrea", plan_expires_at: null }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loggedIn).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.loggedIn).toBe(false);
    expect(result.current.profile).toBeNull();

    const [, logoutCall] = fetchMock.mock.calls;
    expect(logoutCall[0]).toBe("/api/auth");
    expect(logoutCall[1]).toMatchObject({
      method: "POST",
      credentials: "include",
    });
    expect(JSON.parse(logoutCall[1].body)).toEqual({ action: "logout" });
  });
});
