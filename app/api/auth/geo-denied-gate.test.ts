import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// #SESSIONI-1006 leva 1 — `signup_geo_denied` e' un contatore: fuori
// produzione non scrive su `events`. Il deny (403) vale comunque.

const dbQuery = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/db", () => ({
  dbQuery,
  dbQueryStrict: vi.fn().mockResolvedValue([]), // account nuovo
  dbExecute: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => false, clientIp: () => "1.2.3.4" }));
vi.mock("@/lib/auth", () => ({ getSessionPlan: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/notify", () => ({ sendTransactional: vi.fn() }));
vi.mock("@/lib/referral-rewards", () => ({ grantInviteeBonus: vi.fn() }));

const deniedReq = () =>
  new Request("https://x/api/auth", {
    method: "POST",
    headers: { "x-vercel-ip-country": "US" },
    body: JSON.stringify({ action: "register", identifier: "a@x.com", password: "unaPasswordLunga123", age_confirmed: true, tos_accepted: true }),
  });

const geoInserts = () => dbQuery.mock.calls.filter((c) => /signup_geo_denied/.test(String(c[0])));

beforeEach(() => {
  dbQuery.mockClear();
  vi.stubEnv("SESSION_SECRET", "test-session-secret-0123456789");
  vi.stubEnv("SIGNUP_COUNTRY_ALLOWLIST", "IT");
  vi.stubEnv("TRACK_ALLOW_WRITE", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("signup_geo_denied rispetta il gate di ambiente", () => {
  it("production: 403 e una riga", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { POST } = await import("./route");
    const res = await POST(deniedReq());
    expect(res.status).toBe(403);
    expect(geoInserts()).toHaveLength(1);
  });

  it("preview: 403 e nessuna riga", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const { POST } = await import("./route");
    const res = await POST(deniedReq());
    expect(res.status).toBe(403);
    expect(geoInserts()).toHaveLength(0);
  });
});
