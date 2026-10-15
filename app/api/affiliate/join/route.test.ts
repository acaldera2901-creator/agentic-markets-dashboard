// #AFFILIATE-V2-CRYPTO-1007 PR-5 — /api/affiliate/join: tre spunte, versione
// dei T&C, codice immutabile, programma chiuso di default.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSessionPlan = vi.fn();
const dbQueryStrict = vi.fn();
const dbExecute = vi.fn();

vi.mock("@/lib/auth", () => ({ getSessionPlan }));
vi.mock("@/lib/db", () => ({ dbQueryStrict, dbExecute, dbQuery: vi.fn() }));

type Profile = { referral_code: string | null; referred_by: string | null };
let profiles: Record<string, Profile>;
let affiliates: { identifier: string; code: string; status: string; terms_version: string; onerous_ack_version: string }[];

function req(method: string, who: string | null, body?: unknown, headers: Record<string, string> = {}) {
  return new Request("https://x/api/affiliate/join", {
    method,
    headers: { ...(who ? { "x-test-who": who } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ok = (over: Record<string, unknown> = {}) => ({
  code: "alice",
  terms_version: "2026-11-v1",
  age: true,
  onerous_ack: true,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubEnv("AFFILIATE_MODE", "shadow");
  vi.stubEnv("AFFILIATE_TERMS_VERSION", "2026-11-v1");
  profiles = {
    "Alice@X.io": { referral_code: null, referred_by: null },
    "bob@x.io": { referral_code: "BOBBY", referred_by: null },
    "self@x.io": { referral_code: null, referred_by: "SELFY" },
  };
  affiliates = [];
  getSessionPlan.mockImplementation(async (r: Request) => {
    const who = r.headers.get("x-test-who");
    return who ? { identifier: who, plan: "free" } : null;
  });
  dbQueryStrict.mockImplementation(async (sql: string, params: unknown[]) => {
    if (/FROM affiliates\b/.test(sql)) {
      const a = affiliates.find((x) => x.identifier === params[0]);
      return a ? [{ id: 1, created_at: "2026-10-15", ...a }] : [];
    }
    if (/COUNT\(\*\)::int AS n FROM profiles/.test(sql)) {
      const n = Object.values(profiles).filter((p) => (p.referral_code ?? "").toUpperCase() === params[0]).length;
      return [{ n }];
    }
    if (/FROM profiles WHERE identifier/.test(sql)) {
      const p = profiles[String(params[0])];
      return p ? [p] : [];
    }
    throw new Error(`unexpected sql ${sql}`);
  });
  dbExecute.mockImplementation(async (sql: string, params: unknown[]) => {
    if (/UPDATE profiles SET referral_code/.test(sql)) {
      const p = profiles[String(params[0])];
      if (p && p.referral_code == null) p.referral_code = String(params[1]);
    } else if (/UPDATE profiles SET referred_by = NULL/.test(sql)) {
      profiles[String(params[0])].referred_by = null;
    } else if (/INSERT INTO affiliates/.test(sql)) {
      expect(sql).toContain("onerous_ack_at");
      if (!affiliates.some((a) => a.identifier === params[0] || a.code === params[1])) {
        affiliates.push({ identifier: String(params[0]), code: String(params[1]), status: "active", terms_version: String(params[2]), onerous_ack_version: String(params[2]) });
      }
    }
    return [];
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/affiliate/join", () => {
  it("iscrive: rivendica il codice, identifier normalizzato, versione e clausole onerose registrate", async () => {
    const { POST } = await import("./route");
    const res = await POST(req("POST", "Alice@X.io", ok()));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, enrolled: true, code: "ALICE" });
    expect(profiles["Alice@X.io"].referral_code).toBe("ALICE");
    expect(affiliates).toEqual([
      { identifier: "alice@x.io", code: "ALICE", status: "active", terms_version: "2026-11-v1", onerous_ack_version: "2026-11-v1" },
    ]);
  });

  it("ognuna delle tre spunte è obbligatoria, come booleano vero", async () => {
    const { POST } = await import("./route");
    expect((await (await POST(req("POST", "bob@x.io", ok({ age: "true" })))).json()).error).toBe("age_required");
    expect((await (await POST(req("POST", "bob@x.io", ok({ onerous_ack: undefined })))).json()).error).toBe("onerous_ack_required");
    const t = await POST(req("POST", "bob@x.io", ok({ terms_version: "old" })));
    expect(t.status).toBe(409);
    expect((await t.json()).error).toBe("terms_outdated");
    expect(affiliates).toHaveLength(0);
  });

  it("codice già posseduto: deve coincidere (immutabile, i link /r/ restano)", async () => {
    const { POST } = await import("./route");
    const bad = await POST(req("POST", "bob@x.io", ok({ code: "ALTRO" })));
    expect(bad.status).toBe(409);
    expect((await bad.json()).error).toBe("code_mismatch");
    const good = await POST(req("POST", "bob@x.io", ok({ code: "bobby" })));
    expect((await good.json()).code).toBe("BOBBY");
  });

  it("codice di un altro → code_taken; codice riservato → code_reserved", async () => {
    const { POST } = await import("./route");
    const taken = await POST(req("POST", "Alice@X.io", ok({ code: "BOBBY" })));
    expect((await taken.json()).error).toBe("code_taken");
    vi.stubEnv("INTERNAL_INVITE_CODES", "AMICI:30");
    const r = await POST(req("POST", "Alice@X.io", ok({ code: "amici" })));
    expect((await r.json()).error).toBe("code_reserved");
    expect(affiliates).toHaveLength(0);
  });

  it("anti self-referral come /api/referral/claim", async () => {
    const { POST } = await import("./route");
    await POST(req("POST", "self@x.io", ok({ code: "selfy" })));
    expect(profiles["self@x.io"].referred_by).toBeNull();
  });

  it("doppio invio: idempotente, nessuna seconda riga", async () => {
    const { POST } = await import("./route");
    await POST(req("POST", "Alice@X.io", ok()));
    const again = await POST(req("POST", "Alice@X.io", ok()));
    expect(await again.json()).toMatchObject({ ok: true, already: true });
    expect(affiliates).toHaveLength(1);
  });

  it("programma chiuso: AFFILIATE_MODE=off → 403; T&C non pubblicati → 503", async () => {
    vi.stubEnv("AFFILIATE_MODE", "off");
    let { POST } = await import("./route");
    expect((await POST(req("POST", "Alice@X.io", ok()))).status).toBe(403);
    vi.stubEnv("AFFILIATE_MODE", "shadow");
    vi.stubEnv("AFFILIATE_TERMS_VERSION", "");
    vi.resetModules();
    ({ POST } = await import("./route"));
    expect((await POST(req("POST", "Alice@X.io", ok()))).status).toBe(503);
    expect(affiliates).toHaveLength(0);
  });

  it("401 senza login, 403 cross-site", async () => {
    const { POST } = await import("./route");
    expect((await POST(req("POST", null, ok()))).status).toBe(401);
    expect((await POST(req("POST", "Alice@X.io", ok(), { "sec-fetch-site": "cross-site" }))).status).toBe(403);
  });
});

describe("GET /api/affiliate/join", () => {
  it("dice se il programma è aperto e il codice dell'utente", async () => {
    const { GET } = await import("./route");
    expect(await (await GET(req("GET", "bob@x.io"))).json()).toEqual({
      open: true,
      enrolled: false,
      status: null,
      terms_version: "2026-11-v1",
      code: "BOBBY",
      code_locked: true,
    });
  });
});
