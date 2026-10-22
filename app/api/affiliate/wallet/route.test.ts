// #AFFILIATE-V2-CRYPTO-1007 PR-5 — /api/affiliate/wallet: validazione, KYC D3,
// screening fail-closed, suspended, IDOR, rate-limit, log senza indirizzi interi.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSessionPlan = vi.fn();
const dbQueryStrict = vi.fn();
const dbQuery = vi.fn();
const affiliateRpc = vi.fn();
const sendEmail = vi.fn();
const screenPayoutAddress = vi.fn();

vi.mock("@/lib/auth", () => ({ getSessionPlan }));
vi.mock("@/lib/db", () => ({ dbQueryStrict, dbQuery, dbExecute: vi.fn(), getSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/affiliate/rpc", () => ({ affiliateRpc }));
vi.mock("@/lib/email", async (orig) => ({ ...(await orig<typeof import("@/lib/email")>()), sendEmail }));
vi.mock("@/lib/affiliate/screening", async (orig) => ({
  ...(await orig<typeof import("@/lib/affiliate/screening")>()),
  screenPayoutAddress,
}));

const ADDR = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const ADDR_TYPO = "0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"; // una lettera col caso sbagliato

type Aff = { id: number; identifier: string; status: string };
const AFFS: Record<string, Aff> = {
  "alice@x.io": { id: 11, identifier: "alice@x.io", status: "active" },
  "bob@x.io": { id: 22, identifier: "bob@x.io", status: "active" },
  "sus@x.io": { id: 33, identifier: "sus@x.io", status: "suspended" },
};
let walletOf: Record<number, unknown>;
let ip = 0;

function req(method: string, who: string | null, body?: unknown, headers: Record<string, string> = {}) {
  return new Request("https://x/api/affiliate/wallet", {
    method,
    headers: { "x-forwarded-for": `10.0.0.${++ip}`, ...(who ? { "x-test-who": who } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const good = (over: Record<string, unknown> = {}) => ({
  coin: "USDT",
  address: ADDR,
  last6: ADDR.slice(-6).toLowerCase(),
  payee_legal_name: "Alice Liddell",
  payee_country: "gb",
  declarations: { sanctions: true, tax: true },
  network_ack: true,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Moduli freschi a ogni test: il rate-limit in memoria non si trascina.
  vi.resetModules();
  getSessionPlan.mockImplementation(async (r: Request) => {
    const who = r.headers.get("x-test-who");
    return who ? { identifier: who, plan: "free" } : null;
  });
  vi.stubEnv("AFFILIATE_MODE", "shadow");
  vi.stubEnv("AFFILIATE_TERMS_VERSION", "aff-2026-10-22-v3");
  walletOf = {};
  dbQueryStrict.mockImplementation(async (sql: string, params: unknown[]) => {
    if (/FROM affiliates\b/.test(sql)) {
      const a = AFFS[String(params[0])];
      return a ? [{ ...a, code: "C" + a.id, terms_version: "v", created_at: "2026-10-01", payee_legal_name: null, payee_country: null, payee_sanctions_declared_at: null, payee_tax_declared_at: null }] : [];
    }
    if (/FROM affiliate_wallets/.test(sql)) {
      const w = walletOf[Number(params[0])];
      return w ? [w] : [];
    }
    throw new Error(`unexpected sql ${sql}`);
  });
  dbQuery.mockResolvedValue([{ language: "en" }]);
  screenPayoutAddress.mockResolvedValue({ kind: "not_screened" });
  affiliateRpc.mockResolvedValue({ ok: true, usable_after: "2026-10-18T12:00:00Z", cancelled_payout_ids: [] });
  sendEmail.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

async function load() {
  return import("./route");
}

describe("auth e iscrizione", () => {
  it("401 senza sessione, 404 se non iscritto", async () => {
    const { PUT, GET } = await load();
    expect((await PUT(req("PUT", null, good()))).status).toBe(401);
    expect((await GET(req("GET", "nobody@x.io"))).status).toBe(404);
  });
  it("cross-site bloccato prima di tutto", async () => {
    const { PUT, DELETE } = await load();
    expect((await PUT(req("PUT", "alice@x.io", good(), { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect((await DELETE(req("DELETE", "alice@x.io", undefined, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("programma spento (AFFILIATE_MODE=off) → 403, niente salvato", async () => {
    vi.stubEnv("AFFILIATE_MODE", "off");
    const { PUT } = await load();
    const res = await PUT(req("PUT", "alice@x.io", good()));
    expect(res.status).toBe(403);
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
});

describe("PUT: salvataggio", () => {
  it("ok: una sola RPC con l'id della SESSIONE, cooldown dal DB, email mascherata", async () => {
    const { PUT } = await load();
    const res = await PUT(req("PUT", "alice@x.io", { ...good(), affiliate_id: 22 }));
    expect(res.status).toBe(200);
    expect(affiliateRpc).toHaveBeenCalledTimes(1);
    const [fn, args] = affiliateRpc.mock.calls[0];
    expect(fn).toBe("affiliate_set_wallet");
    expect(args).toMatchObject({
      p_affiliate_id: 11, // IDOR: l'affiliate_id del body è ignorato
      p_coin: "USDT",
      p_network: "polygon",
      p_address: ADDR,
      p_screening_result: "not_screened",
      p_screening_provider: null,
      p_legal_name: "Alice Liddell",
      p_country: "GB",
      p_declared: true,
      p_declarations_version: "aff-2026-10-22-v3",
      p_require_kyc: true,
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe("alice@x.io");
    expect(mail.text).toContain("0x5aAe…eAed");
    expect(mail.text + mail.html).not.toContain(ADDR);
  });

  it("un'email fallita non fa fallire il salvataggio", async () => {
    sendEmail.mockRejectedValueOnce(new Error("resend down"));
    const { PUT } = await load();
    expect((await PUT(req("PUT", "alice@x.io", good()))).status).toBe(200);
  });

  it("payout in preparazione annullato: lo dice la risposta e l'email", async () => {
    affiliateRpc.mockResolvedValueOnce({ ok: true, usable_after: "2026-10-18T12:00:00Z", cancelled_payout_ids: [5] });
    const { PUT } = await load();
    const res = await PUT(req("PUT", "alice@x.io", good()));
    expect((await res.json()).cancelled_payouts).toBe(1);
    expect(sendEmail.mock.calls[0][0].text).toContain("cancelled before sending");
  });

  it("mai l'indirizzo intero nei log", async () => {
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    affiliateRpc.mockRejectedValueOnce(new Error("db down"));
    screenPayoutAddress.mockResolvedValueOnce({ kind: "blocked", provider: "p" });
    const { PUT } = await load();
    await PUT(req("PUT", "alice@x.io", good())); // blocked
    await PUT(req("PUT", "bob@x.io", good())); // db down
    await PUT(req("PUT", "bob@x.io", good())); // ok
    const logged = spies.flatMap((s) => s.mock.calls.map((c) => c.join(" "))).join("\n");
    expect(logged).toContain("0x5aAe…eAed");
    expect(logged.toLowerCase()).not.toContain(ADDR.toLowerCase());
    spies.forEach((s) => s.mockRestore());
  });
});

describe("PUT: validazione (il server è l'arbitro)", () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ["formato", { address: "0x123" }, "invalid_format"],
    ["EIP-55", { address: ADDR_TYPO, last6: ADDR_TYPO.slice(-6) }, "invalid_checksum"],
    ["indirizzo zero", { address: "0x0000000000000000000000000000000000000000", last6: "000000" }, "zero_address"],
    ["Tron spento (D1)", { network: "tron", address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" }, "network_not_enabled"],
    ["valuta non supportata", { coin: "BTC" }, "unsupported_coin"],
    ["ultime 6 diverse", { last6: "ffffff" }, "last6_mismatch"],
    ["conferma di rete", { network_ack: false }, "network_ack_required"],
    ["nome legale", { payee_legal_name: "A" }, "invalid_legal_name"],
    ["paese", { payee_country: "ZZ" }, "invalid_country"],
    ["dichiarazione sanzioni", { declarations: { sanctions: false, tax: true } }, "declaration_required"],
    ["dichiarazione imposte (separata)", { declarations: { sanctions: true } }, "declaration_required"],
  ];
  for (const [name, over, code] of cases) {
    it(`${name} → ${code}, niente salvato`, async () => {
      const { PUT } = await load();
      const res = await PUT(req("PUT", "alice@x.io", good(over)));
      expect(res.status).toBe(422);
      expect((await res.json()).error).toBe(code);
      expect(affiliateRpc).not.toHaveBeenCalled();
    });
  }

  it("ultime 6: confronto case-insensitive, paste permesso", async () => {
    const { PUT } = await load();
    expect((await PUT(req("PUT", "alice@x.io", good({ last6: ADDR.slice(-6).toUpperCase() })))).status).toBe(200);
  });

  it("KYC spento (AFFILIATE_KYC_AT_WALLET=off): nome/paese non richiesti", async () => {
    vi.stubEnv("AFFILIATE_KYC_AT_WALLET", "off");
    const { PUT } = await load();
    const res = await PUT(req("PUT", "alice@x.io", good({ payee_legal_name: undefined, payee_country: undefined, declarations: undefined })));
    expect(res.status).toBe(200);
    expect(affiliateRpc.mock.calls[0][1]).toMatchObject({ p_require_kyc: false, p_legal_name: null, p_declared: false });
  });

  it("KYC spento + dichiarazioni inviate comunque: NON registrate (QA F8: altrimenti 500 sul CHECK)", async () => {
    vi.stubEnv("AFFILIATE_KYC_AT_WALLET", "off");
    const { PUT } = await load();
    const res = await PUT(req("PUT", "alice@x.io", good({ payee_legal_name: undefined, payee_country: undefined })));
    expect(res.status).toBe(200);
    expect(affiliateRpc.mock.calls[0][1]).toMatchObject({ p_declared: false, p_declarations_version: null });
  });
});

describe("PUT: denylist destinatari (QA F6)", () => {
  const cases: [string, string, Record<string, string>][] = [
    ["wallet di uscita", "0x1111111111111111111111111111111111111111", { AFFILIATE_PAYOUT_FROM: "0x1111111111111111111111111111111111111111" }],
    ["wallet incassi PayGate", "0x72e348d948e984c7d57d8ccb93fdd52710e47fa2", { PAYGATE_PAYOUT_WALLET: "0x72E348D948E984C7D57D8CCB93FDD52710E47FA2" }],
    ["contratto USDT Polygon", "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", {}],
    ["contratto USDC Base (catalogo)", "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", {}],
    ["burn 0x…dEaD", "0x000000000000000000000000000000000000dEaD", {}],
  ];
  for (const [name, address, env] of cases) {
    it(`${name} → address_not_allowed, niente salvato`, async () => {
      for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
      const { PUT } = await load();
      const res = await PUT(req("PUT", "alice@x.io", good({ address, last6: address.slice(-6) })));
      expect(res.status).toBe(422);
      expect((await res.json()).error).toBe("address_not_allowed");
      expect(affiliateRpc).not.toHaveBeenCalled();
    });
  }
});

describe("PUT: screening fail-closed", () => {
  it("provider che non risponde → 503, niente salvato", async () => {
    const { ScreeningUnavailableError } = await import("@/lib/affiliate/screening");
    screenPayoutAddress.mockRejectedValueOnce(new ScreeningUnavailableError("timeout"));
    const { PUT } = await load();
    const res = await PUT(req("PUT", "alice@x.io", good()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("screening_unavailable");
    expect(affiliateRpc).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it("indirizzo bloccato → address_blocked senza dettagli, niente salvato", async () => {
    screenPayoutAddress.mockResolvedValueOnce({ kind: "blocked", provider: "p" });
    const { PUT } = await load();
    const res = await PUT(req("PUT", "alice@x.io", good()));
    expect(await res.json()).toEqual({ error: "address_blocked", field: "address" });
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("clear → registrato col provider", async () => {
    screenPayoutAddress.mockResolvedValueOnce({ kind: "clear", provider: "p" });
    const { PUT } = await load();
    await PUT(req("PUT", "alice@x.io", good()));
    expect(affiliateRpc.mock.calls[0][1]).toMatchObject({ p_screening_result: "clear", p_screening_provider: "p" });
  });
});

describe("suspended e corse", () => {
  it("sospeso: PUT 403 senza toccare il DB", async () => {
    const { PUT } = await load();
    const res = await PUT(req("PUT", "sus@x.io", good()));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("suspended");
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("sospeso fra la lettura e la transazione: il DB (FOR UPDATE) rifiuta → 403", async () => {
    affiliateRpc.mockResolvedValueOnce({ ok: false, error: "suspended" });
    const { PUT } = await load();
    const res = await PUT(req("PUT", "alice@x.io", good()));
    expect(res.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("rate-limit (lib/rate-limit esistente)", () => {
  it("6ª scrittura in un'ora dallo stesso affiliato → 429", async () => {
    const { PUT } = await load();
    AFFS["rl@x.io"] = { id: 44, identifier: "rl@x.io", status: "active" };
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await PUT(req("PUT", "rl@x.io", good()))).status);
    expect(codes.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(codes[5]).toBe(429);
  });
});

describe("GET e DELETE", () => {
  it("GET: mascherato, mai l'indirizzo intero; solo il proprio wallet", async () => {
    walletOf[11] = { id: 1, coin: "USDT", network: "polygon", address: ADDR, created_at: "2026-10-01", usable_after: "2026-10-04", screening_result: "not_screened" };
    walletOf[22] = { id: 2, coin: "USDT", network: "polygon", address: "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359", created_at: "2026-10-01", usable_after: "2026-10-04", screening_result: "clear" };
    const { GET } = await load();
    const body = await (await GET(req("GET", "alice@x.io"))).json();
    expect(body.wallet).toMatchObject({ address_masked: "0x5aAe…eAed", state: "pending_screening" });
    expect(JSON.stringify(body)).not.toContain(ADDR);
    expect(JSON.stringify(body)).not.toContain("d359");
    expect(body.rails).toEqual({ coins: ["USDT", "USDC"], networks: ["polygon"] });
  });
  it("DELETE: revoca via RPC con l'id della sessione + email", async () => {
    affiliateRpc.mockResolvedValueOnce({ ok: true, cancelled_payout_ids: [9] });
    const { DELETE } = await load();
    const res = await DELETE(req("DELETE", "bob@x.io"));
    expect(res.status).toBe(200);
    expect(affiliateRpc).toHaveBeenCalledWith("affiliate_revoke_wallet", { p_affiliate_id: 22 });
    expect((await res.json()).wallet.state).toBe("none");
    expect(sendEmail.mock.calls[0][0].subject).toBe("Your payout wallet has been removed");
  });
  it("DELETE senza wallet → 404", async () => {
    affiliateRpc.mockResolvedValueOnce({ ok: false, error: "no_wallet" });
    const { DELETE } = await load();
    expect((await DELETE(req("DELETE", "bob@x.io"))).status).toBe(404);
  });
});

describe("USDC on Polygon",()=>{
 it("saves the chosen currency and includes it in the notification",async()=>{
 const {PUT}=await load();
 const res=await PUT(req("PUT","alice@x.io",good({coin:"USDC"})));
 expect(res.status).toBe(200);
 expect(affiliateRpc).toHaveBeenCalledWith("affiliate_set_wallet",expect.objectContaining({p_coin:"USDC",p_network:"polygon"}));
 expect(JSON.stringify(sendEmail.mock.calls)).toContain("USDC");
 });
});
