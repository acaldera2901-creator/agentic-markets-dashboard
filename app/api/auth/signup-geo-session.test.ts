import { describe, it, expect, vi, beforeEach } from "vitest";

// #G2-TRACKING-1110 — geo e session_id della registrazione: UPDATE separato,
// best-effort, session_id solo col consenso, signup mai bloccato.

const dbQuery = vi.fn();
const dbQueryStrict = vi.fn();
const dbExecute = vi.fn();

vi.mock("@/lib/db", () => ({ dbQuery, dbQueryStrict, dbExecute }));
vi.mock("@/lib/referral-rewards", () => ({ grantInviteeBonus: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/notify", () => ({ sendTransactional: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => false, clientIp: () => "1.2.3.4" }));
vi.mock("@/lib/auth", () => ({ getSessionPlan: vi.fn().mockResolvedValue(null) }));

const ID = "nuovo@x.com";

function registerReq(extra: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("https://x/api/auth", {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "register",
      identifier: ID,
      password: "unaPasswordLunga123",
      age_confirmed: true,
      tos_accepted: true,
      ...extra,
    }),
  });
}

const geoCall = () => dbExecute.mock.calls.find((c) => /signup_country/.test(String(c[0])));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = "test-session-secret-0123456789";
  process.env.NEXT_PUBLIC_SITE_URL = "https://x";
  process.env.AUTH_REQUIRE_EMAIL_ACTIVATION = "false";
  delete process.env.RESEND_API_KEY;
  delete process.env.SIGNUP_COUNTRY_ALLOWLIST;
  dbQuery.mockResolvedValue([]);
  dbExecute.mockResolvedValue([]);
  dbQueryStrict
    .mockResolvedValueOnce([])
    .mockResolvedValue([{ identifier: ID, plan: "free", name: null }]);
});

describe("register → signup geo + session", () => {
  it("salva paese, regione, città decodificata e session_id col consenso", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      registerReq(
        { analytics_consent: true, session_id: "abc123xyz" },
        { "x-vercel-ip-country": "ng", "x-vercel-ip-country-region": "la", "x-vercel-ip-city": "S%C3%A3o%20Paulo" }
      )
    );
    expect(res.status).toBe(200);
    expect(geoCall()?.[1]).toEqual([ID, "NG", "LA", "São Paulo", "abc123xyz"]);
  });

  it("senza consenso non salva il session_id", async () => {
    const { POST } = await import("./route");
    await POST(registerReq({ session_id: "abc123xyz" }, { "x-vercel-ip-country": "IT" }));
    expect(geoCall()?.[1]).toEqual([ID, "IT", null, null, null]);
  });

  it("scarta session_id e header malformati", async () => {
    const { POST } = await import("./route");
    await POST(
      registerReq(
        { analytics_consent: true, session_id: "<script>" },
        { "x-vercel-ip-country": "XYZ", "x-vercel-ip-city": "%E0%A4%A" }
      )
    );
    expect(geoCall()).toBeUndefined();
  });

  it("colonna assente (migration non applicata): il signup riesce lo stesso", async () => {
    dbExecute.mockImplementation(async (sql: string) => {
      if (/signup_country/.test(sql)) throw new Error('column "signup_country" does not exist');
      return [];
    });
    const { POST } = await import("./route");
    const res = await POST(registerReq({}, { "x-vercel-ip-country": "GB" }));
    expect(res.status).toBe(200);
  });
});
