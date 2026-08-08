import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashActivationToken } from "@/lib/activation";

// #REFERRAL-V2-0808 — dove si concedono i 7 giorni di PRO all'invitato.
// La regola che questi test difendono: il bonus va all'ATTIVAZIONE, mai
// all'INSERT del profilo. Il profilo nasce `plan='free'` e l'account è usabile
// solo dopo l'attivazione (HIGH-3): concedere il regalo alla registrazione lo
// farebbe scadere prima che l'utente possa entrare.
// La validazione di `referred_by` contro un `profiles.referral_code` reale (e
// l'idempotenza del tier 0) vivono nell'helper e sono coperte in
// lib/referral-rewards.test.ts — qui si inchioda il CABLAGGIO.

const dbQuery = vi.fn();
const dbQueryStrict = vi.fn();
const dbExecute = vi.fn();
const grantInviteeBonus = vi.fn();
const sendTransactional = vi.fn();

vi.mock("@/lib/db", () => ({ dbQuery, dbQueryStrict, dbExecute }));
vi.mock("@/lib/referral-rewards", () => ({ grantInviteeBonus }));
vi.mock("@/lib/notify", () => ({ sendTransactional }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => false, clientIp: () => "1.2.3.4" }));
vi.mock("@/lib/auth", () => ({ getSessionPlan: vi.fn().mockResolvedValue(null) }));

const ID = "invited@x.com";
const PASSWORD = "unaPasswordLunga123";

function registerReq(extra: Record<string, unknown> = {}) {
  return new Request("https://x/api/auth", {
    method: "POST",
    body: JSON.stringify({
      action: "register",
      identifier: ID,
      password: PASSWORD,
      age_confirmed: true,
      tos_accepted: true,
      ref: "AMICO",
      ...extra,
    }),
  });
}

/** `vi.clearAllMocks()` azzera le chiamate ma NON le implementazioni: il reset
 *  esplicito evita che il mock che lancia contamini i test successivi. */
beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = "test-session-secret-0123456789";
  process.env.NEXT_PUBLIC_SITE_URL = "https://x";
  dbQuery.mockResolvedValue([]);
  dbQueryStrict.mockResolvedValue([]);
  dbExecute.mockResolvedValue([]);
  grantInviteeBonus.mockResolvedValue(true);
  sendTransactional.mockResolvedValue(undefined);
});

// ── Percorso 1: auto-attivazione inline (nessun provider email) ──────────────
describe("register con auto-attivazione", () => {
  beforeEach(() => {
    process.env.AUTH_REQUIRE_EMAIL_ACTIVATION = "false";
    delete process.env.RESEND_API_KEY;
  });

  it("concede il bonus dopo l'UPDATE di activated_at, prima della sessione", async () => {
    dbQueryStrict
      .mockResolvedValueOnce([]) // loadAuthRow: account nuovo
      .mockResolvedValueOnce([{ identifier: ID, plan: "premium", name: null }]); // loadProfile

    const { POST } = await import("./route");
    const res = await POST(registerReq());

    expect(res.status).toBe(200);
    expect(grantInviteeBonus).toHaveBeenCalledTimes(1);
    expect(grantInviteeBonus).toHaveBeenCalledWith(ID);

    // L'ordine è la sostanza del test: l'attivazione PRIMA (altrimenti i giorni
    // scadono su un account inutilizzabile) e la rilettura del profilo DOPO
    // (così la sessione risponde col piano appena concesso).
    const activationWrite = dbExecute.mock.calls.findIndex((c) => /activated_at = NOW\(\)/.test(String(c[0])));
    expect(activationWrite).toBeGreaterThanOrEqual(0);
    expect(dbExecute.mock.invocationCallOrder[activationWrite]).toBeLessThan(
      grantInviteeBonus.mock.invocationCallOrder[0]
    );
    expect(grantInviteeBonus.mock.invocationCallOrder[0]).toBeLessThan(
      dbQueryStrict.mock.invocationCallOrder[1]
    );
    // Il piano concesso arriva al client nella risposta della registrazione.
    expect((await res.json()).plan).toBe("premium");
  });

  it("se il bonus lancia, la registrazione riesce comunque", async () => {
    dbQueryStrict
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ identifier: ID, plan: "free", name: null }]);
    grantInviteeBonus.mockRejectedValue(new Error("boom"));

    const { POST } = await import("./route");
    const res = await POST(registerReq());

    expect(res.status).toBe(200);
  });
});

// ── Il bonus NON va all'INSERT ───────────────────────────────────────────────
describe("register col gate email attivo", () => {
  beforeEach(() => {
    delete process.env.AUTH_REQUIRE_EMAIL_ACTIVATION;
    process.env.RESEND_API_KEY = "re_test";
  });

  it("non concede niente alla registrazione: l'account non è ancora usabile", async () => {
    dbQueryStrict.mockResolvedValueOnce([]); // account nuovo

    const { POST } = await import("./route");
    const res = await POST(registerReq());

    expect(res.status).toBe(202); // pending_activation
    expect(grantInviteeBonus).not.toHaveBeenCalled();
  });
});

// ── Percorso 2: il link di attivazione via email ─────────────────────────────
describe("GET /api/auth/activate (link email)", () => {
  const TOKEN = "token-di-prova";
  const url = (t = TOKEN) => `https://x/api/auth/activate?token=${t}&id=${encodeURIComponent(ID)}`;

  function profileRow(over: Record<string, unknown> = {}) {
    return {
      identifier: ID,
      activated_at: null,
      activation_token_hash: hashActivationToken(TOKEN),
      activation_token_expires: new Date(Date.now() + 3_600_000).toISOString(),
      language: "it",
      ...over,
    };
  }

  it("con un token valido concede il bonus all'identifier del profilo", async () => {
    dbQuery.mockResolvedValueOnce([profileRow()]);

    const { GET } = await import("./activate/route");
    const res = await GET(new Request(url()));

    expect(res.headers.get("location")).toContain("activated=1");
    expect(grantInviteeBonus).toHaveBeenCalledTimes(1);
    expect(grantInviteeBonus).toHaveBeenCalledWith(ID);
  });

  it("token scaduto: nessuna attivazione, nessun bonus", async () => {
    dbQuery.mockResolvedValueOnce([
      profileRow({ activation_token_expires: new Date(Date.now() - 1000).toISOString() }),
    ]);

    const { GET } = await import("./activate/route");
    const res = await GET(new Request(url()));

    expect(res.headers.get("location")).toContain("activation=expired");
    expect(grantInviteeBonus).not.toHaveBeenCalled();
  });

  it("token sbagliato: nessun bonus", async () => {
    dbQuery.mockResolvedValueOnce([profileRow()]);

    const { GET } = await import("./activate/route");
    const res = await GET(new Request(url("token-falso")));

    expect(res.headers.get("location")).toContain("activation=invalid");
    expect(grantInviteeBonus).not.toHaveBeenCalled();
  });

  it("profilo già attivato: nessun secondo bonus", async () => {
    dbQuery.mockResolvedValueOnce([profileRow({ activated_at: new Date().toISOString() })]);

    const { GET } = await import("./activate/route");
    const res = await GET(new Request(url()));

    expect(res.headers.get("location")).toContain("activation=already");
    expect(grantInviteeBonus).not.toHaveBeenCalled();
  });

  it("se il bonus lancia, l'account resta attivato", async () => {
    dbQuery.mockResolvedValueOnce([profileRow()]);
    grantInviteeBonus.mockRejectedValue(new Error("boom"));

    const { GET } = await import("./activate/route");
    const res = await GET(new Request(url()));

    expect(res.headers.get("location")).toContain("activated=1");
  });
});

// ── Percorso 3: il heal pigro al login (non era nel piano) ───────────────────
describe("login che attiva una riga rimasta non attivata", () => {
  beforeEach(() => {
    process.env.AUTH_REQUIRE_EMAIL_ACTIVATION = "false";
    delete process.env.RESEND_API_KEY;
  });

  it("concede il bonus: è un'attivazione a tutti gli effetti", async () => {
    const { hashPassword } = await import("@/lib/password");
    dbQueryStrict
      .mockResolvedValueOnce([
        { identifier: ID, plan: "free", name: null, password_hash: hashPassword(PASSWORD), activated_at: null },
      ])
      .mockResolvedValueOnce([{ identifier: ID, plan: "premium", name: null }]);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("https://x/api/auth", {
        method: "POST",
        body: JSON.stringify({ action: "login", identifier: ID, password: PASSWORD }),
      })
    );

    expect(res.status).toBe(200);
    expect(grantInviteeBonus).toHaveBeenCalledWith(ID);
  });

  it("un login su riga già attivata non ri-concede nulla", async () => {
    const { hashPassword } = await import("@/lib/password");
    dbQueryStrict
      .mockResolvedValueOnce([
        {
          identifier: ID,
          plan: "free",
          name: null,
          password_hash: hashPassword(PASSWORD),
          activated_at: new Date().toISOString(),
        },
      ])
      .mockResolvedValueOnce([{ identifier: ID, plan: "free", name: null }]);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("https://x/api/auth", {
        method: "POST",
        body: JSON.stringify({ action: "login", identifier: ID, password: PASSWORD }),
      })
    );

    expect(res.status).toBe(200);
    expect(grantInviteeBonus).not.toHaveBeenCalled();
  });
});
