import { describe, expect, it } from "vitest";
import { ttlCache } from "./cache";
import { LIVE_CACHE_TTL_S, hasFailedRead } from "./live-source";
import { snapshotSource } from "./snapshot-source";

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("live server cache", () => {
  it("serves the same read within the TTL and reads again after it", async () => {
    const c = clock();
    const cache = ttlCache<string, number>(120_000, () => true, c.now);
    let reads = 0;
    const load = async () => ++reads;
    expect(await cache.get("7d", load)).toBe(1);
    c.advance(119_999);
    expect(await cache.get("7d", load)).toBe(1);
    c.advance(1);
    expect(await cache.get("7d", load)).toBe(2);
  });

  it("each window is cached separately", async () => {
    const cache = ttlCache<string, string>(120_000, () => true, clock().now);
    expect(await cache.get("today", async () => "today-read")).toBe("today-read");
    expect(await cache.get("30d", async () => "30d-read")).toBe("30d-read");
    expect(await cache.get("today", async () => "other")).toBe("today-read");
  });

  it("concurrent misses share one read", async () => {
    const cache = ttlCache<string, number>(120_000, () => true, clock().now);
    let reads = 0;
    const load = () => new Promise<number>((r) => setTimeout(() => r(++reads), 5));
    const [a, b] = await Promise.all([cache.get("7d", load), cache.get("7d", load)]);
    expect([a, b, reads]).toEqual([1, 1, 1]);
  });

  it("a failed load is not kept", async () => {
    const cache = ttlCache<string, number>(120_000, () => true, clock().now);
    await expect(cache.get("7d", async () => Promise.reject(new Error("db down")))).rejects.toThrow("db down");
    expect(await cache.get("7d", async () => 7)).toBe(7);
  });

  it("a load marked not cacheable (a query in ERRORE) is shown once, then read again", async () => {
    const cache = ttlCache<string, { err: boolean }>(120_000, (v) => !v.err, clock().now);
    expect(await cache.get("7d", async () => ({ err: true }))).toEqual({ err: true });
    expect(await cache.get("7d", async () => ({ err: false }))).toEqual({ err: false });
    expect(await cache.get("7d", async () => ({ err: true }))).toEqual({ err: false });
  });

  it("the TTL stays inside the agreed 60–300 s", () => {
    expect(LIVE_CACHE_TTL_S).toBeGreaterThanOrEqual(60);
    expect(LIVE_CACHE_TTL_S).toBeLessThanOrEqual(300);
  });
});

describe("hasFailedRead (what the live cache refuses to keep)", () => {
  it("a complete load is cacheable; one failed query or one failed series is not", async () => {
    const { data } = await snapshotSource().load("7d");
    expect(hasFailedRead(data)).toBe(false);
    expect(hasFailedRead({ ...data, partners: { ok: false, error: "lettura fallita" } })).toBe(true);
    expect(hasFailedRead({ ...data, trends: { ...data.trends, errors: { page_views: "lettura fallita" } } })).toBe(true);
  });
});
