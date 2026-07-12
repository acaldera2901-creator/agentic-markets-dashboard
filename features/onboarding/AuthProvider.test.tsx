import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthProvider";

// Real GET /api/auth shape (app/api/auth/route.ts):
// - 200 OK  -> { identifier, plan, name }              (flat, no "profile" wrapper)
// - 401     -> { error: "not authenticated" }

function Probe() {
  const { user, plan, loading } = useAuth();
  if (loading) return <div>load</div>;
  return <div>{`plan:${plan ?? "none"} user:${user?.identifier ?? "none"}`}</div>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthProvider / useAuth", () => {
  it("logged-in: espone user + plan dalla sessione", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ identifier: "a@b.c", name: "A", plan: "premium" }),
      })
    );
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByText("plan:premium user:a@b.c")).toBeInTheDocument()
    );
  });

  it("anonimo (401) -> plan/user none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "not authenticated" }),
      })
    );
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByText("plan:none user:none")).toBeInTheDocument()
    );
  });

  it("errore di rete -> logged-out, nessun crash", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByText("plan:none user:none")).toBeInTheDocument()
    );
  });

  it("refresh() ri-fetcha la sessione", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "not authenticated" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ identifier: "x@y.z", name: null, plan: "base" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    function ProbeWithRefresh() {
      const { plan, refresh, loading } = useAuth();
      return (
        <div>
          <div>{loading ? "load" : `plan:${plan ?? "none"}`}</div>
          <button onClick={() => refresh()}>refresh</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <ProbeWithRefresh />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("plan:none")).toBeInTheDocument());
    fireEvent.click(screen.getByText("refresh"));
    await waitFor(() => expect(screen.getByText("plan:base")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
