// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), auth: vi.fn(), store: new Map<string, unknown>() }));
vi.mock("@/lib/db", () => ({ dbQueryStrict: mocks.query }));
vi.mock("@/lib/auth", () => ({ resolveAccessState: mocks.auth }));
vi.mock("next/cache", () => ({
  unstable_cache: (load: (...args: unknown[]) => Promise<unknown>, keys: string[], options: { revalidate: number }) => {
    expect(options.revalidate).toBe(30);
    return async (...args: unknown[]) => {
      const key = JSON.stringify([keys, args]);
      if (mocks.store.has(key)) return structuredClone(mocks.store.get(key));
      const value = await load(...args);
      mocks.store.set(key, structuredClone(value));
      return value;
    };
  },
}));
const fixture = (count = 60) => Array.from({ length: count }, (_, i) => ({
  id: `row-${i}`, sport: "tennis", competition: "ATP", event_name: `Home ${i} vs Away ${i}`,
  home_team: `Home ${i}`, away_team: `Away ${i}`, market: "moneyline", pick: "HOME",
  status: "finished", result: i % 3 ? "won" : "lost", is_paper: false, is_verified: true,
  verification_state: "verified", published_at: "2026-06-01T00:00:00Z",
  starts_at: "2026-07-01T12:00:00Z", confidence_score: 70, notes: '{"final_score":"2-0","private":"paid"}',
}));
let GET: typeof import("@/app/api/v2/history/route").GET;
beforeEach(async () => {
  vi.resetModules(); mocks.store.clear(); mocks.query.mockReset(); mocks.auth.mockReset();
  vi.stubEnv("LEDGER_SEALED_GRADING", "0");
  mocks.query.mockResolvedValue(fixture()); mocks.auth.mockResolvedValue({ state: "anonymous" });
  GET = (await import("@/app/api/v2/history/route")).GET;
});
const request = (query = "") => new Request(`https://example.test/api/v2/history?${query}`);
describe("cached history snapshot / live access projection", () => {
  it("reuses aggregates across every role but resolves access and gates every response", async () => {
    let stats: unknown;
    for (const state of ["base", "anonymous", "premium", "free", "admin_full", "pending_payment", "unpaid"]) {
      mocks.auth.mockResolvedValue({ state });
      const response = await GET(request("aggregate=segments")); const body = await response.json();
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      const paid = ["base", "premium", "admin_full"].includes(state);
      expect(body.history[0].locked).toBe(!paid);
      expect(body.history[0].pick).toBe(paid ? "HOME" : undefined);
      expect(body.history[0].notes).toBe(paid ? fixture()[0].notes : undefined);
      expect(body.history[0].final_score).toBe("2-0");
      if (stats) expect(body.stats).toEqual(stats); else stats = body.stats;
      expect(body.stats.n).toBe(60); expect(body.stats.won).toBe(40); expect(body.stats.win_rate).toBe("66.7%");
      expect(body.segments).toBeDefined();
    }
    expect(mocks.auth).toHaveBeenCalledTimes(7); expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it("isolates sport, competition and year, while limit/aggregate share the same population", async () => {
    await GET(request()); await GET(request("sport=all&competition=all&year=invalid&limit=1"));
    expect(mocks.query).toHaveBeenCalledTimes(1);
    for (const query of ["sport=tennis", "competition=ATP", "year=2026"]) await GET(request(query));
    expect(mocks.query).toHaveBeenCalledTimes(4);
    expect(mocks.query.mock.calls.map(c => c[1])).toEqual([[], ["tennis"], ["%ATP%"], [2026]]);
    const body = await (await GET(request("limit=1"))).json();
    expect(body.history).toHaveLength(1); expect(body.stats.n).toBe(60); expect(body.segments).toBeUndefined();
  });
  it("keeps only 300 display rows in shared storage, without truncating the population stats", async () => {
    mocks.query.mockResolvedValue(fixture(400));
    const body = await (await GET(request("limit=99999"))).json();
    expect(body.history).toHaveLength(300); expect(body.stats.n).toBe(400);
    expect([...mocks.store.values()][0]).toMatchObject({ rows: expect.any(Array) });
    expect((([...mocks.store.values()][0]) as { rows: unknown[] }).rows).toHaveLength(300);
  });
  it("fails loudly and retries main database errors, never caching a fake empty record", async () => {
    mocks.query.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(GET(request())).rejects.toThrow("database unavailable");
    expect(mocks.store.size).toBe(0);
    expect((await (await GET(request())).json()).stats.n).toBe(60);
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
  it("preserves degraded sealed grading without retaining the outage; config changes separate caches", async () => {
    await GET(request());
    vi.stubEnv("LEDGER_SEALED_GRADING", "1"); vi.stubEnv("LEDGER_SEALED_FROM", "2026-01-01");
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM pick_ledger")) throw new Error("ledger unavailable");
      return fixture();
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = await (await GET(request())).json();
    expect(body.stats.sealed_grading.unavailable).toBe(true);
    expect(mocks.store.size).toBe(1);
    await GET(request()); expect(mocks.query).toHaveBeenCalledTimes(5);
    errorLog.mockRestore();
  });
});
