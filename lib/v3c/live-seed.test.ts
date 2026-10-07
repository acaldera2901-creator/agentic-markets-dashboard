// lib/v3c/live-seed.test.ts (#REDESIGN-V3C final2) — the server's first live read
// (no layout shift on home, board, match): only around kick-off, never waits long.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbQueryStrict = vi.fn();
vi.mock("@/lib/db", () => ({ dbQueryStrict: (...a: unknown[]) => dbQueryStrict(...a) }));

import { _resetLiveCache, liveSeed, SEED_WAIT_MS } from "./live-service.server";

const NOW = new Date("2026-10-07T08:15:00Z");

describe("liveSeed", () => {
  beforeEach(() => {
    _resetLiveCache();
    dbQueryStrict.mockReset();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ events: [] }), { status: 200 })));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("no match around kick-off → null, nothing is read", async () => {
    expect(await liveSeed(["2026-10-07T18:00:00Z", "2026-10-06T08:00:00Z"], NOW)).toBeNull();
    expect(dbQueryStrict).not.toHaveBeenCalled();
  });

  it("a match in the window → the same response the route serves", async () => {
    dbQueryStrict.mockResolvedValue([]);
    const r = await liveSeed(["2026-10-07T08:00:00Z"], NOW);
    expect(r?.contract).toBe("v3.live.1");
  });

  it("a slow source → null after SEED_WAIT_MS, the page is not held", async () => {
    vi.useFakeTimers();
    dbQueryStrict.mockReturnValue(new Promise(() => {}));
    const p = liveSeed(["2026-10-07T08:00:00Z"], NOW);
    await vi.advanceTimersByTimeAsync(SEED_WAIT_MS);
    expect(await p).toBeNull();
  });

  it("a failing source → null", async () => {
    dbQueryStrict.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await liveSeed(["2026-10-07T08:00:00Z"], NOW)).toBeNull();
  });
});
