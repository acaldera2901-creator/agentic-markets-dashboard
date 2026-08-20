import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// #INTERNAL-INVITE-0813 — quello che questi test difendono: i codici interni
// (link mandati a mano, 30gg di PRO) sono testo libero come tutti gli altri, e
// `/api/referral/claim` è first-come-first-served. Senza guard un utente può
// rivendicare MAVEN30 come SUO codice: da quel momento il link interno gli
// attribuirebbe gli iscritti e li farebbe contare verso i suoi gradini.

const dbQuery = vi.fn();
const dbQueryStrict = vi.fn();
const dbExecute = vi.fn();
const getSessionPlan = vi.fn();

vi.mock("@/lib/db", () => ({ dbQuery, dbQueryStrict, dbExecute }));
vi.mock("@/lib/auth", () => ({ getSessionPlan }));

// Import dinamico dentro i test (come stats/route.test.ts): l'import statico
// gira prima delle const mockate e vi.mock non le trova ancora inizializzate.
const load = async () => (await import("./route")).POST;

const ME = "user@x.com";
const ENV = "INTERNAL_INVITE_CODES";

const req = (code: string) =>
  new Request("https://x/api/referral/claim", {
    method: "POST",
    headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" },
    body: JSON.stringify({ code }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env[ENV] = "MAVEN30:30";
  getSessionPlan.mockResolvedValue({ identifier: ME });
  dbQuery.mockImplementation(async (sql: string) => {
    if (/referral_code, referred_by/.test(sql)) return [{ referral_code: null, referred_by: null }];
    if (/AS n/.test(sql)) return [{ n: 0 }]; // codice libero
    if (/SELECT referral_code FROM profiles/.test(sql)) return [{ referral_code: "AMICO" }];
    return [];
  });
  dbExecute.mockResolvedValue([]);
});

afterEach(() => {
  delete process.env[ENV];
});

describe("POST /api/referral/claim", () => {
  it("rifiuta un codice interno e non tocca il profilo", async () => {
    const res = await (await load())(req("MAVEN30"));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "code reserved" });
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("rifiuta il codice interno anche scritto in minuscolo", async () => {
    const res = await (await load())(req("maven30"));
    expect(res.status).toBe(409);
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("un codice normale si rivendica ancora", async () => {
    const res = await (await load())(req("AMICO"));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, code: "AMICO" });
    const updates = dbExecute.mock.calls.filter((c) => /SET referral_code/.test(String(c[0])));
    expect(updates).toHaveLength(1);
  });
});
