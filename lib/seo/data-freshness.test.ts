import { describe, expect, it, vi } from "vitest";

const dbQuery = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery }));
const { fetchFreshness, pickLastModified } = await import("./data-freshness");

const NOW = Date.parse("2026-11-06T21:00:00Z");

describe("pickLastModified", () => {
  it("the data date wins when it is later than the file date (board: 22 Aug file → today's cycle)", () =>
    expect(pickLastModified("2026-08-22T16:52:16+02:00", "2026-11-06T20:00:00.000Z", NOW)).toBe("2026-11-06T20:00:00.000Z"));
  it("the file date stays when it is later", () => expect(pickLastModified("2026-11-06T20:30:00Z", "2026-11-01T00:00:00Z", NOW)).toBe("2026-11-06T20:30:00Z"));
  it("never in the future: a data date after now (clock skew) is ignored", () => expect(pickLastModified("2026-08-22T00:00:00Z", "2026-11-07T00:00:00Z", NOW)).toBe("2026-08-22T00:00:00Z"));
  it("null/invalid data date → the file date, untouched", () => {
    expect(pickLastModified("2026-08-22T00:00:00Z", null, NOW)).toBe("2026-08-22T00:00:00Z");
    expect(pickLastModified("2026-08-22T00:00:00Z", "garbage", NOW)).toBe("2026-08-22T00:00:00Z");
  });
});

describe("fetchFreshness", () => {
  it("reads only public rows (not demo; board = not historical, history = settled) and returns ISO dates", async () => {
    dbQuery.mockResolvedValueOnce([{ board: "2026-11-06T19:00:00Z", history: new Date("2026-11-06T08:00:00Z") }]);
    const f = await fetchFreshness();
    expect(f).toEqual({ board: "2026-11-06T19:00:00.000Z", history: "2026-11-06T08:00:00.000Z" });
    const [sql] = dbQuery.mock.calls[0] as [string];
    expect(sql).toMatch(/is_demo = FALSE/g); expect(sql).toMatch(/is_historical = FALSE/); expect(sql).toMatch(/settled_at IS NOT NULL/);
  });
  it("DB error → both null (the sitemap keeps the file dates, never a 500)", async () => {
    dbQuery.mockRejectedValueOnce(new Error("db down"));
    expect(await fetchFreshness()).toEqual({ board: null, history: null });
  });
});
