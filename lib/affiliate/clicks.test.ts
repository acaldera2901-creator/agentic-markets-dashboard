import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const dbExecute = vi.fn();
vi.mock("@/lib/db", () => ({ dbExecute, dbQueryStrict: vi.fn(), dbQuery: vi.fn() }));
const after = vi.fn((fn: () => unknown) => void fn());
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after }));

const { keptSourceParams, clickCountable, recordReferralClickSafe } = await import("./clicks");
const { GET } = await import("@/app/r/[code]/route");
const SECRET = "s".repeat(32);
const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const PROD: Record<string, string> = { VERCEL_ENV: "production", AFFILIATE_MODE: "live" };

const req = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { headers: { "user-agent": CHROME, "x-forwarded-for": "1.2.3.4", ...headers } });
const go = (code: string, url: string, headers?: Record<string, string>) =>
  GET(req(url, headers), { params: Promise.resolve({ code }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("AFFILIATE_MODE", "live");
  vi.stubEnv("AFFILIATE_HASH_SECRET", SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe("keptSourceParams", () => {
  it("tiene utm_* e src, mai ref né parametri estranei o valori sporchi", () => {
    const u = new URL("https://x/r/ABC?utm_source=tiktok&UTM_Campaign=oct&ref=EVIL&foo=1&utm_content=%3Cscript%3E&src=bio");
    expect(keptSourceParams(u)).toEqual([["utm_source", "tiktok"], ["utm_campaign", "oct"], ["src", "bio"]]);
  });
});

describe("clickCountable", () => {
  const r = (h: Record<string, string> = {}) => req("https://x/r/ABC", h);
  it("conta un browser vero in produzione", () => expect(clickCountable(r(), [], PROD)).toBe(true));
  it("non conta fuori produzione, a programma spento, bot, prefetch, link di test", () => {
    expect(clickCountable(r(), [], { ...PROD, VERCEL_ENV: "preview" })).toBe(false);
    expect(clickCountable(r(), [], { ...PROD, AFFILIATE_MODE: "off" })).toBe(false);
    expect(clickCountable(r({ "user-agent": "TelegramBot (like TwitterBot)" }), [], PROD)).toBe(false);
    expect(clickCountable(r({ "user-agent": "" }), [], PROD)).toBe(false);
    expect(clickCountable(r({ "sec-purpose": "prefetch;prerender" }), [], PROD)).toBe(false);
    expect(clickCountable(r(), [["utm_campaign", "qa-test-1"]], PROD)).toBe(false);
  });
});

describe("recordReferralClickSafe", () => {
  it("scrive solo per un affiliato attivo, IP e UA solo come HMAC", async () => {
    const at = new Date("2026-10-22T10:00:00Z");
    expect(await recordReferralClickSafe("ABC", "1.2.3.4", CHROME, "/?ref=ABC", at)).toBe(true);
    const [sql, params] = dbExecute.mock.calls[0];
    expect(sql).toMatch(/FROM affiliates WHERE code = \$1 AND status = 'active'/);
    const h = (v: string) => createHmac("sha256", SECRET).update(v).digest("hex");
    expect(params).toEqual(["ABC", at.toISOString(), h("1.2.3.4|2026-10-22"), h(CHROME), "/?ref=ABC"]);
    expect(JSON.stringify(params)).not.toContain("1.2.3.4");
  });
  it("un errore DB non lancia", async () => {
    dbExecute.mockRejectedValueOnce(new Error("down"));
    expect(await recordReferralClickSafe("ABC", "1.2.3.4", CHROME, "/")).toBe(false);
  });
});

describe("GET /r/[code]", () => {
  it("302 alla home con ref + utm, no-store, e un click contato", async () => {
    const res = await go("abc", "https://www.betredge.com/r/abc?utm_source=ig&utm_campaign=launch");
    expect(res.status).toBe(302);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/");
    expect(Object.fromEntries(loc.searchParams)).toEqual({ ref: "ABC", utm_source: "ig", utm_campaign: "launch" });
    expect(dbExecute).toHaveBeenCalledTimes(1);
    expect(dbExecute.mock.calls[0][1][4]).toBe("/?ref=ABC&utm_source=ig&utm_campaign=launch");
  });
  it("una ricarica dallo stesso IP non conta due volte", async () => {
    await go("RELOAD", "https://x/r/RELOAD", { "x-forwarded-for": "5.5.5.5" });
    await go("RELOAD", "https://x/r/RELOAD", { "x-forwarded-for": "5.5.5.5" });
    expect(dbExecute).toHaveBeenCalledTimes(1);
  });
  it("codice malformato: home pulita (utm tenuti), nessun click; bot: redirect sì, click no", async () => {
    const bad = await go("x", "https://x/r/x?utm_source=ig");
    expect(Object.fromEntries(new URL(bad.headers.get("location")!).searchParams)).toEqual({ utm_source: "ig" });
    await go("BOTTED", "https://x/r/BOTTED", { "user-agent": "facebookexternalhit/1.1" });
    expect(dbExecute).not.toHaveBeenCalled();
  });
});
