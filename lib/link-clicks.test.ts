import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbExecute = vi.fn();
vi.mock("@/lib/db", () => ({ dbExecute, dbQueryStrict: vi.fn(), dbQuery: vi.fn() }));
const after = vi.fn((fn: () => unknown) => void fn());
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after }));

const { channelRedirect, linkClickCountable, recordLinkClickSafe } = await import("./link-clicks");
const { GET } = await import("@/app/ig/route");
const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const PROD: Record<string, string> = { VERCEL_ENV: "production" };
const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers: { "user-agent": CHROME, "x-forwarded-for": "1.2.3.4", ...headers } });

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("AFFILIATE_HASH_SECRET", "s".repeat(32)); });
afterEach(() => vi.unstubAllEnvs());

describe("channelRedirect", () => {
  it("/r/BRAND-IG with utm_source=instagram, utm_medium=bio, utm_campaign=profile", () => {
    const u = channelRedirect("ig", new URL("https://www.betredge.com/ig"), "https://www.betredge.com/ig");
    expect(u.origin + u.pathname).toBe("https://www.betredge.com/r/BRAND-IG");
    expect(Object.fromEntries(u.searchParams)).toEqual({ utm_source: "instagram", utm_medium: "bio", utm_campaign: "profile" });
  });
  it("source/medium can NOT be overridden from the URL; campaign/content survive; ref and strangers are dropped", () => {
    const u = channelRedirect("ig", new URL("https://x/ig?utm_source=evil&utm_medium=x&src=y&utm_campaign=nov&utm_content=reel1&ref=EVIL&foo=1"), "https://x/ig");
    expect(Object.fromEntries(u.searchParams)).toEqual({ utm_source: "instagram", utm_medium: "bio", utm_campaign: "nov", utm_content: "reel1" });
  });
});

describe("linkClickCountable", () => {
  const f = new URL("https://x/ig");
  it("counts a real browser in production", () => expect(linkClickCountable(req("https://x/ig"), f, PROD)).toBe(true));
  it("does not count outside production, bots, prefetch, test-marked links", () => {
    expect(linkClickCountable(req("https://x/ig"), f, { VERCEL_ENV: "preview" })).toBe(false);
    expect(linkClickCountable(req("https://x/ig", { "user-agent": "Googlebot/2.1" }), f, PROD)).toBe(false);
    expect(linkClickCountable(req("https://x/ig", { "sec-purpose": "prefetch" }), f, PROD)).toBe(false);
    expect(linkClickCountable(req("https://x/ig?utm_campaign=test"), new URL("https://x/ig?utm_campaign=test"), PROD)).toBe(false);
  });
});

describe("GET /ig", () => {
  it("302 to the home with the source, Cache-Control no-store, and ONE click row (HMAC only, no plain IP/UA, no Set-Cookie)", async () => {
    const res = await GET(req("https://www.betredge.com/ig", { "x-forwarded-for": "9.9.9.1" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://www.betredge.com/r/BRAND-IG?utm_source=instagram&utm_medium=bio&utm_campaign=profile");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(dbExecute).toHaveBeenCalledTimes(1);
    const [sql, params] = dbExecute.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/INSERT INTO link_clicks/);
    expect(params[0]).toBe("ig");
    const flat = JSON.stringify(params);
    expect(flat).not.toContain("9.9.9.1"); expect(flat).not.toContain("Mozilla");
  });
  it("redirects but does NOT count a bot or a non-production deploy", async () => {
    const bot = await GET(req("https://www.betredge.com/ig", { "user-agent": "bingbot" }));
    expect(bot.status).toBe(302); expect(dbExecute).not.toHaveBeenCalled();
    vi.stubEnv("VERCEL_ENV", "preview");
    const prev = await GET(req("https://www.betredge.com/ig", { "x-forwarded-for": "9.9.9.2" }));
    expect(prev.status).toBe(302); expect(dbExecute).not.toHaveBeenCalled();
  });
  it("a DB failure never breaks the redirect", async () => {
    dbExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await GET(req("https://www.betredge.com/ig", { "x-forwarded-for": "9.9.9.3" }));
    expect(res.status).toBe(302);
    expect(await recordLinkClickSafe("ig", "1.1.1.1", "ua", "/")).toBe(true);
  });
});
