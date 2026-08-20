import { describe, it, expect, vi, beforeEach } from "vitest";

// #FUNNEL-MEAS-0813 — il cablaggio che questi test inchiodano: la sorgente di
// acquisizione mandata dal client finisce nell'INSERT del profilo, sanificata,
// e la sua assenza non blocca MAI la registrazione.

const dbQuery = vi.fn();
const dbQueryStrict = vi.fn();
const dbExecute = vi.fn();

vi.mock("@/lib/db", () => ({ dbQuery, dbQueryStrict, dbExecute }));
vi.mock("@/lib/referral-rewards", () => ({ grantInviteeBonus: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/notify", () => ({ sendTransactional: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => false, clientIp: () => "1.2.3.4" }));
vi.mock("@/lib/auth", () => ({ getSessionPlan: vi.fn().mockResolvedValue(null) }));

const ID = "nuovo@x.com";

function registerReq(acquisition?: unknown) {
  return new Request("https://x/api/auth", {
    method: "POST",
    body: JSON.stringify({
      action: "register",
      identifier: ID,
      password: "unaPasswordLunga123",
      age_confirmed: true,
      tos_accepted: true,
      acquisition,
    }),
  });
}

// L'INSERT del register è l'unica dbExecute con "INSERT INTO profiles".
const insertCall = () => dbExecute.mock.calls.find((c) => /INSERT INTO profiles/.test(String(c[0])));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = "test-session-secret-0123456789";
  process.env.NEXT_PUBLIC_SITE_URL = "https://x";
  process.env.AUTH_REQUIRE_EMAIL_ACTIVATION = "false";
  delete process.env.RESEND_API_KEY;
  dbQuery.mockResolvedValue([]);
  dbExecute.mockResolvedValue([]);
  dbQueryStrict
    .mockResolvedValueOnce([]) // loadAuthRow: account nuovo
    .mockResolvedValue([{ identifier: ID, plan: "free", name: null }]); // loadProfile
});

describe("register → profiles.acquisition", () => {
  it("scrive la sorgente nell'INSERT come JSON", async () => {
    const { POST } = await import("./route");
    const res = await POST(registerReq({ utm_source: "test", utm_medium: "qa", landing_path: "/" }));

    expect(res.status).toBe(200);
    const call = insertCall();
    expect(String(call?.[0])).toContain("acquisition");
    const params = call?.[1] as unknown[];
    expect(JSON.parse(String(params[params.length - 1]))).toEqual({
      utm_source: "test",
      utm_medium: "qa",
      landing_path: "/",
    });
  });

  it("scarta le chiavi non previste dal payload del client", async () => {
    const { POST } = await import("./route");
    await POST(registerReq({ utm_source: "reddit", evil: "'; DROP TABLE profiles; --" }));

    const params = insertCall()?.[1] as unknown[];
    expect(JSON.parse(String(params[params.length - 1]))).toEqual({ utm_source: "reddit" });
  });

  it("nessuna sorgente → la colonna non entra nemmeno nell'INSERT", async () => {
    const { POST } = await import("./route");
    const res = await POST(registerReq(undefined));

    expect(res.status).toBe(200);
    expect(String(insertCall()?.[0])).not.toContain("acquisition");
  });

  // Guard di ordine di deploy: codice in prod prima della migration.
  it("se la colonna non esiste, ritenta senza attribuzione e il signup riesce", async () => {
    dbExecute.mockRejectedValueOnce(new Error('column "acquisition" of relation "profiles" does not exist'));

    const { POST } = await import("./route");
    const res = await POST(registerReq({ utm_source: "reddit" }));

    expect(res.status).toBe(200);
    const inserts = dbExecute.mock.calls.filter((c) => /INSERT INTO profiles/.test(String(c[0])));
    expect(inserts).toHaveLength(2);
    expect(String(inserts[1][0])).not.toContain("acquisition");
  });
});
