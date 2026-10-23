// #AFFILIATE-V2-CRYPTO-1007 PR-9 — rotte admin dei payout: auth, flag, input,
// verifica on-chain per hash (RPC finto, nessuna rete), esiti, email.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const isAdminAuthorized = vi.fn();
const dbQueryStrict = vi.fn();
const dbQuery = vi.fn();
const affiliateRpc = vi.fn();
const sendEmail = vi.fn();
const opsAlert = vi.fn();
const screenPayoutAddress = vi.fn();
const rpcCalls: string[] = [];
const rpcArgs: { method: string; params: unknown[] }[] = [];
let chain: { receipt?: unknown; head?: number; down?: boolean; tx?: unknown; finalizedNonce?: number; logs?: unknown[] };

vi.mock("@/lib/admin-auth", async (orig) => ({ ...(await orig<typeof import("@/lib/admin-auth")>()), isAdminAuthorized }));
vi.mock("@/lib/db", () => ({ dbQueryStrict, dbQuery, dbExecute: vi.fn(), getSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/affiliate/rpc", () => ({ affiliateRpc }));
vi.mock("@/lib/email", async (orig) => ({ ...(await orig<typeof import("@/lib/email")>()), sendEmail }));
vi.mock("@/lib/ops-alert", () => ({ opsAlert }));
vi.mock("@/lib/affiliate/screening", async (orig) => ({
  ...(await orig<typeof import("@/lib/affiliate/screening")>()),
  screenPayoutAddress,
}));
vi.mock("@/lib/affiliate/payout-verify", async (orig) => {
  const real = await orig<typeof import("@/lib/affiliate/payout-verify")>();
  return {
    ...real,
    // RPC finto con la forma reale delle risposte Polygon; nessuna chiamata di rete.
    jsonRpc: () => async (method: string, params: unknown[]) => {
      rpcCalls.push(method);
      rpcArgs.push({ method, params });
      if (chain.down) throw new real.VerifierUnavailableError("rpc down");
      if (method === "eth_chainId") return "0x89";
      if (method === "eth_blockNumber") return `0x${(chain.head ?? 1_000_100).toString(16)}`;
      if (method === "eth_getBlockByNumber") return { number: `0x${((chain.head ?? 1_000_100) - 2).toString(16)}` };
      if (method === "eth_getTransactionByHash") return chain.tx === undefined ? { nonce: "0x7", from: FROM } : chain.tx;
      if (method === "eth_getLogs") return chain.logs ?? [];
      if (method === "eth_getTransactionCount") return `0x${(chain.finalizedNonce ?? 0).toString(16)}`;
      if (method === "eth_getTransactionReceipt") return chain.receipt === undefined ? receiptOk() : chain.receipt;
      throw new Error(method);
    },
  };
});

const FROM = "0x1111111111111111111111111111111111111111";
const TO = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
const H1 = `0x${"a1".repeat(32)}`;
const H2 = `0x${"b2".repeat(32)}`;
const pad = (a: string) => `0x${"0".repeat(24)}${a.slice(2).toLowerCase()}`;
function receiptOk(amount = 60, to = TO, from = FROM) {
  return {
    status: "0x1",
    blockNumber: `0x${(1_000_000).toString(16)}`,
    logs: [{ address: USDT, topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", pad(from), pad(to)], data: `0x${(amount * 1e6).toString(16).padStart(64, "0")}` }],
  };
}

type PayoutFixture = { status: string; tx_hash: string | null; cancel_code?: string | null; affiliate_status?: string; tx_nonce?: number | null; tx_block?: number | null; tx_from?: string | null };
let payout: PayoutFixture | null;
let manualClear = false;

function req(url: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  // Il browser dell'admin manda sempre Origin su una POST same-origin.
  const h = method === "GET" ? headers : { origin: "https://x", ...headers };
  return new Request(`https://x${url}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }) as unknown as NextRequest;
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
// #AFFILIATE-COMPLETE-1023: payouts are created by a named backoffice operator (Bearer + x-admin-actor).
const BO = { authorization: "Bearer bo-secret", "x-admin-actor": "anna" };
const month = () => new Date().toISOString().slice(0, 7);

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  rpcCalls.length = 0;
  rpcArgs.length = 0;
  chain = {};
  vi.stubEnv("AFFILIATE_PAYOUTS", "live");
  vi.stubEnv("AFFILIATE_PAYOUT_FROM", FROM);
  vi.stubEnv("ADMIN_SECRET", "bo-secret");
  isAdminAuthorized.mockResolvedValue(true);
  payout = { status: "created", tx_hash: null };
  manualClear = false;
  dbQueryStrict.mockImplementation(async (sql: string) => {
    if (/FROM affiliate_wallets WHERE affiliate_id = \$1 AND revoked_at IS NULL/.test(sql)) return [{ ok: manualClear }];
    if (/affiliate_payout_rows/.test(sql)) {
      return [
        { affiliate_id: 1, code: "A1", status: "active", payee_legal_name: "Ann", payee_country: "IT", sanctions_declared: true, tax_declared: true, balance: 54, wallet_id: 1, address: TO, coin: "USDT", network: "polygon", wallet_created_at: "x", usable_after: "y", screening_result: "clear", paid_in_year: 120, payout_id: null, payout_status: null, payout_amount: null, reasons: [] },
        { affiliate_id: 2, code: "A2", status: "active", payee_legal_name: null, payee_country: null, sanctions_declared: false, tax_declared: false, balance: 10, wallet_id: null, address: null, coin: null, network: null, wallet_created_at: null, usable_after: null, screening_result: null, paid_in_year: 0, payout_id: null, payout_status: null, payout_amount: null, reasons: ["no_wallet", "missing_payee", "below_threshold"] },
        { affiliate_id: 3, code: "A3", status: "active", payee_legal_name: "C", payee_country: "FR", sanctions_declared: true, tax_declared: true, balance: 60.1, wallet_id: 3, address: TO, coin: "USDT", network: "polygon", wallet_created_at: "x", usable_after: "y", screening_result: "clear", paid_in_year: 0, payout_id: 9, payout_status: "created", payout_amount: 60.1, reasons: ["already_created"] },
      ];
    }
    if (/FROM affiliate_payouts p JOIN affiliates/.test(sql)) {
      return payout
        ? [{ id: 7, affiliate_id: 1, affiliate_identifier: "ann@x.io", affiliate_code: "A1", affiliate_status: "active", payee_name: "Ann", payee_country: "IT", period_month: `${month()}-01`, amount_usd: "60.00", coin: "USDT", network: "polygon", to_address: TO, amount_coin: null, created_at: "x", submitted_at: null, paid_at: null, cancel_reason: "nota admin", cancel_code: null, ...payout }]
        : [];
    }
    throw new Error(`unexpected ${sql}`);
  });
  dbQuery.mockResolvedValue([{ language: "en" }]);
  affiliateRpc.mockResolvedValue({ ok: true, status: "paid", became_paid: true });
  screenPayoutAddress.mockResolvedValue({ kind: "clear", provider: "test" });
  sendEmail.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

const list = () => import("./route");
const one = () => import("./[id]/route");
const tx = () => import("./[id]/tx/route");
const verify = () => import("./[id]/verify/route");
const cancel = () => import("./[id]/cancel/route");

describe("auth admin (come activations)", () => {
  it("401 su tutte le rotte senza admin", async () => {
    isAdminAuthorized.mockResolvedValue(false);
    expect((await (await list()).GET(req("/p"))).status).toBe(401);
    expect((await (await list()).POST(req("/p", "POST", {}))).status).toBe(401);
    expect((await (await one()).GET(req("/p/7"), params("7"))).status).toBe(401);
    expect((await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }), params("7"))).status).toBe(401);
    expect((await (await verify()).POST(req("/p/7/verify", "POST"), params("7"))).status).toBe(401);
    expect((await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "xyz" }), params("7"))).status).toBe(401);
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("cross-site bloccato sulle scritture", async () => {
    const h = { "sec-fetch-site": "cross-site" };
    expect((await (await list()).POST(req("/p", "POST", {}, h))).status).toBe(403);
    expect((await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }, h), params("7"))).status).toBe(403);
    expect((await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "xyz" }, h), params("7"))).status).toBe(403);
  });
});

describe("AFFILIATE_PAYOUTS (default off)", () => {
  it("senza env: create/tx/verify 403 payouts_off, la lista resta leggibile, l'annullo resta possibile", async () => {
    vi.stubEnv("AFFILIATE_PAYOUTS", "");
    const c = await (await list()).POST(req("/p", "POST", { month: month(), ids: [1], expected_total: "54.00" }, BO));
    expect(await c.json()).toEqual({ error: "payouts_off" });
    expect((await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }), params("7"))).status).toBe(403);
    expect((await (await verify()).POST(req("/p/7/verify", "POST"), params("7"))).status).toBe(403);
    expect((await (await list()).GET(req(`/p?month=${month()}`))).status).toBe(200);
    expect((await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "errore" }), params("7"))).status).toBe(200);
    expect(rpcCalls).toEqual([]);
  });
  it("D2: senza wallet di uscita (o = wallet incassi PayGate) non si crea", async () => {
    vi.stubEnv("PAYGATE_PAYOUT_WALLET", FROM);
    const r = await (await list()).POST(req("/p", "POST", { month: month(), ids: [1], expected_total: "54.00" }, BO));
    expect(r.status).toBe(503);
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
});

describe("GET lista del mese", () => {
  it("righe con motivi, wallet intero per l'admin, riepilogo e wallet di uscita", async () => {
    const body = await (await (await list()).GET(req(`/p?month=${month()}`))).json();
    expect(body).toMatchObject({ month: month(), mode: "live", payout_from: FROM, min_payout_usd: 50 });
    expect(body.summary).toEqual({ eligible_count: 1, eligible_total_usd: 54, to_fund_usd: 54, prepared_count: 1 });
    expect(body.rows[0]).toMatchObject({ eligible: true, paid_in_year_usd: 120, wallet: { address: TO, address_masked: "0x5aAe…eAed" }, checks: { payee: true, screened: true, declarations: true } });
    expect(body.rows[1]).toMatchObject({ eligible: false, reasons: ["no_wallet", "missing_payee", "below_threshold"], wallet: null });
    const [sql, p] = dbQueryStrict.mock.calls[0];
    expect(sql).toContain("affiliate_payout_rows($1::date");
    expect(p).toEqual([`${month()}-01`, 50, true, "{polygon}", "{USDT,USDC}"]);
  });
  it("mese malformato → 400", async () => {
    expect((await (await list()).GET(req("/p?month=2026-13"))).status).toBe(400);
    expect((await (await list()).GET(req("/p?month=1999-01"))).status).toBe(400);
  });
});

describe("POST crea payout", () => {
  it("passa a una sola transazione SQL ids, mese, totale atteso e le stesse regole della lista", async () => {
    affiliateRpc.mockResolvedValueOnce({ ok: true, total: 54, created: [{ payout_id: 1, affiliate_id: 1, amount: 54 }] });
    const r = await (await list()).POST(req("/p", "POST", { month: month(), ids: [1, "1"], expected_total: 54 }, BO));
    expect(r.status).toBe(200);
    expect(affiliateRpc).toHaveBeenCalledWith("affiliate_create_payouts", {
      p_ids: [1],
      p_period: `${month()}-01`,
      p_expected_total: "54.00",
      p_min: 50,
      p_require_kyc: true,
      p_networks: ["polygon"],
      p_coins: ["USDT", "USDC"],
      p_created_by: "bo:anna",
    });
  });
  it("totale cambiato nel frattempo → 409 col diff, niente creato (lo decide il DB)", async () => {
    affiliateRpc.mockResolvedValueOnce({ ok: false, error: "total_mismatch", expected: 54, actual: 60, items: [{ affiliate_id: 1, amount: 60 }] });
    const r = await (await list()).POST(req("/p", "POST", { month: month(), ids: [1], expected_total: "54" }, BO));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ error: "total_mismatch", expected: 54, actual: 60 });
  });
  it("input non validi → 400/409 prima del DB", async () => {
    const P = (await list()).POST;
    expect((await P(req("/p", "POST", { month: "2026-01", ids: [1], expected_total: "1" }, BO))).status).toBe(409);
    expect((await P(req("/p", "POST", { month: month(), ids: [], expected_total: "1" }, BO))).status).toBe(400);
    expect((await P(req("/p", "POST", { month: month(), ids: [-1], expected_total: "1" }, BO))).status).toBe(400);
    expect((await P(req("/p", "POST", { month: month(), ids: [1], expected_total: "1.234" }, BO))).status).toBe(400);
    expect((await P(req("/p", "POST", { month: month(), ids: [1] }, BO))).status).toBe(400);
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
});

describe("GET [id]", () => {
  it("indirizzo intero e motivo admin per l'admin, senza l'email dell'affiliato", async () => {
    const body = await (await (await one()).GET(req("/p/7"), params("7"))).json();
    expect(body.payout).toMatchObject({ id: 7, to_address: TO, amount_usd: 60, status: "created", cancel_reason: "nota admin" });
    expect(JSON.stringify(body)).not.toContain("ann@x.io");
    expect(body.payout_from).toBe(FROM);
  });
  it("id non numerico → 400, inesistente → 404", async () => {
    expect((await (await one()).GET(req("/p/x"), params("1 OR 1=1"))).status).toBe(400);
    payout = null;
    expect((await (await one()).GET(req("/p/8"), params("8"))).status).toBe(404);
  });
});

describe("POST [id]/tx — verifica per hash", () => {
  it("tutto giusto → paid, registrato una volta, email con importo e link", async () => {
    const r = await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1.toUpperCase().replace("0X", "") }), params("7"));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ outcome: "paid", confirmations: 101, amount_coin: "60.000000" });
    expect(rpcCalls).toEqual(["eth_chainId", "eth_getTransactionReceipt", "eth_getTransactionByHash", "eth_blockNumber", "eth_getBlockByNumber"]);
    expect(affiliateRpc).toHaveBeenCalledWith("affiliate_payout_record_tx", { p_id: 7, p_tx_hash: H1, p_paid: true, p_amount_coin: "60.000000", p_nonce: 7, p_block: 1_000_000, p_from: FROM });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "ann@x.io", subject: "Payout sent" });
    expect(sendEmail.mock.calls[0][0].text).toContain(`https://polygon.blockscout.com/tx/${H1}`);
  });
  it("poche conferme → submitted, nessuna email", async () => {
    chain.head = 1_000_011;
    affiliateRpc.mockResolvedValueOnce({ ok: true, status: "submitted", became_paid: false });
    const r = await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }), params("7"));
    expect(await r.json()).toMatchObject({ outcome: "submitted", confirmations: 12, required: 30 });
    expect(affiliateRpc.mock.calls[0][1]).toMatchObject({ p_paid: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it("hash rifiutato (destinatario diverso) → 422 col motivo, NIENTE registrato", async () => {
    chain.receipt = receiptOk(60, "0x2222222222222222222222222222222222222222");
    const r = await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }), params("7"));
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ outcome: "rejected", reason: "wrong_recipient" });
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("hash malformato → invalid_format senza chiamare l'RPC", async () => {
    const r = await (await tx()).POST(req("/p/7/tx", "POST", { hash: "0x123" }), params("7"));
    expect(await r.json()).toEqual({ outcome: "rejected", reason: "invalid_format" });
    expect(rpcCalls).toEqual([]);
  });
  it("RPC giù → 503 fail-closed, payout invariato", async () => {
    chain.down = true;
    const r = await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }), params("7"));
    expect(r.status).toBe(503);
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("doppio submit: stesso hash su un paid → idempotente, nessuna seconda email; hash diverso → 409", async () => {
    payout = { status: "paid", tx_hash: H1 };
    const again = await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }), params("7"));
    expect(await again.json()).toMatchObject({ outcome: "paid", already: true });
    const other = await (await tx()).POST(req("/p/7/tx", "POST", { hash: H2 }), params("7"));
    expect(other.status).toBe(409);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("doppio submit concorrente: il DB dice became_paid=false al secondo → nessuna seconda email", async () => {
    affiliateRpc.mockResolvedValueOnce({ ok: true, status: "paid", became_paid: false });
    await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }), params("7"));
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it("hash già usato per lo stesso destinatario (UNIQUE) → 409", async () => {
    affiliateRpc.mockResolvedValueOnce({ ok: false, error: "hash_already_used" });
    const r = await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }), params("7"));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "hash_already_used" });
  });
  it("payout annullato (es. wallet cambiato) → 409 col codice, mai registrato", async () => {
    payout = { status: "cancelled", tx_hash: null, cancel_code: "wallet_changed" };
    const r = await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }), params("7"));
    expect(await r.json()).toEqual({ error: "cancelled", cancel_code: "wallet_changed" });
    expect(rpcCalls).toEqual([]);
  });
  it("submitted con un hash e ne arriva un altro → hash_mismatch prima della rete", async () => {
    payout = { status: "submitted", tx_hash: H1 };
    const r = await (await tx()).POST(req("/p/7/tx", "POST", { hash: H2 }), params("7"));
    expect(await r.json()).toEqual({ error: "hash_mismatch" });
    expect(rpcCalls).toEqual([]);
  });
});

describe("POST [id]/verify — Riverifica", () => {
  it("submitted → rilegge l'hash registrato (col mittente registrato)", async () => {
    payout = { status: "submitted", tx_hash: H1, tx_from: FROM };
    const r = await (await verify()).POST(req("/p/7/verify", "POST"), params("7"));
    expect(await r.json()).toMatchObject({ outcome: "paid" });
    expect(affiliateRpc.mock.calls[0][1]).toMatchObject({ p_tx_hash: H1, p_paid: true });
  });
  it("non submitted → 409", async () => {
    const r = await (await verify()).POST(req("/p/7/verify", "POST"), params("7"));
    expect(r.status).toBe(409);
  });
});

describe("POST [id]/cancel", () => {
  it("motivo obbligatorio", async () => {
    expect((await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: " " }), params("7"))).status).toBe(400);
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("ok → email generica, MAI il motivo admin", async () => {
    affiliateRpc.mockResolvedValueOnce({ ok: true, affiliate_id: 1 });
    const r = await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "indirizzo sospetto MOTIVO-INTERNO" }), params("7"));
    expect(r.status).toBe(200);
    expect(affiliateRpc).toHaveBeenCalledWith("affiliate_cancel_payout", { p_id: 7, p_reason: "indirizzo sospetto MOTIVO-INTERNO" });
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.subject).toBe("Payout cancelled before sending");
    expect(mail.text + mail.html).not.toContain("MOTIVO-INTERNO");
  });
  it("non annullabile (ha già una tx) → 409, nessuna email", async () => {
    affiliateRpc.mockResolvedValueOnce({ ok: false, error: "not_cancellable", status: "submitted" });
    const r = await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "errore" }), params("7"));
    expect(r.status).toBe(409);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("QA F10: Origin esatto sulle scritture admin", () => {
  it("Origin diverso o assente con cookie admin → 403; Bearer server-to-server passa", async () => {
    const P = (await list()).POST;
    const body = { month: month(), ids: [1], expected_total: "54.00" };
    expect((await P(req("/p", "POST", body, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await P(req("/p", "POST", body, { origin: "https://x.evil" }))).status).toBe(403);
    const noOrigin = new Request("https://x/p", { method: "POST", body: JSON.stringify(body) }) as unknown as NextRequest;
    expect((await P(noOrigin)).status).toBe(403);
    expect((await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "xyz" }, { origin: "null" }), params("7"))).status).toBe(403);
    expect(affiliateRpc).not.toHaveBeenCalled();
    affiliateRpc.mockResolvedValueOnce({ ok: true, created: [] });
    const bearer = new Request("https://x/p", { method: "POST", headers: BO, body: JSON.stringify(body) }) as unknown as NextRequest;
    expect((await P(bearer)).status).toBe(200);
  });
  it("#AFFILIATE-COMPLETE-1023: dal cookie di /admin non si crea (quattro occhi = operatori nominati)", async () => {
    const r = await (await list()).POST(req("/p", "POST", { month: month(), ids: [1], expected_total: "54.00" }));
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: "named_operators_required" });
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
});

describe("QA F13 + F6 alla creazione", () => {
  it("rifà lo screening degli indirizzi selezionati: bloccato → 409, niente creato", async () => {
    screenPayoutAddress.mockResolvedValueOnce({ kind: "blocked", provider: "p" });
    const r = await (await list()).POST(req("/p", "POST", { month: month(), ids: [1], expected_total: "54.00" }, BO));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ error: "address_blocked", affiliate_id: 1 });
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("nessun provider (not_screened) → 409 not_screened: fail-closed anche alla creazione", async () => {
    screenPayoutAddress.mockResolvedValueOnce({ kind: "not_screened" });
    const r = await (await list()).POST(req("/p", "POST", { month: month(), ids: [1], expected_total: "54.00" }, BO));
    expect(await r.json()).toMatchObject({ error: "not_screened", affiliate_id: 1 });
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("#AFFILIATE-OPS-1022 nessun provider ma decisione manuale clear recente → si crea", async () => {
    screenPayoutAddress.mockResolvedValueOnce({ kind: "not_screened" });
    manualClear = true;
    affiliateRpc.mockResolvedValueOnce({ ok: true, total: 54, created: [] });
    const r = await (await list()).POST(req("/p", "POST", { month: month(), ids: [1], expected_total: "54.00" }, BO));
    expect(r.status).toBe(200);
    expect(affiliateRpc).toHaveBeenCalledWith("affiliate_create_payouts", expect.objectContaining({ p_ids: [1] }));
  });
  it("provider giù → 503, niente creato", async () => {
    const { ScreeningUnavailableError } = await import("@/lib/affiliate/screening");
    screenPayoutAddress.mockRejectedValueOnce(new ScreeningUnavailableError("down"));
    const r = await (await list()).POST(req("/p", "POST", { month: month(), ids: [1], expected_total: "54.00" }, BO));
    expect(r.status).toBe(503);
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("destinatario in denylist (es. diventato AFFILIATE_PAYOUT_FROM) → 409", async () => {
    vi.stubEnv("PAYGATE_PAYOUT_WALLET", TO);
    const r = await (await list()).POST(req("/p", "POST", { month: month(), ids: [1], expected_total: "54.00" }, BO));
    expect(await r.json()).toMatchObject({ error: "address_not_allowed", affiliate_id: 1 });
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
});

describe("QA F3: pagamento eccessivo", () => {
  it("paid ma overpaid:true + opsAlert, senza indirizzo intero", async () => {
    chain.receipt = receiptOk(10_000);
    const r = await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }), params("7"));
    expect(await r.json()).toMatchObject({ outcome: "paid", overpaid: true, amount_coin: "10000.000000" });
    expect(opsAlert).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(opsAlert.mock.calls[0])).not.toContain(TO);
  });
  it("importo giusto: nessun alert", async () => {
    await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }), params("7"));
    expect(opsAlert).not.toHaveBeenCalled();
  });
});

describe("QA F4: affiliato non attivo", () => {
  it("GET [id] espone lo stato dell'affiliato", async () => {
    payout = { status: "created", tx_hash: null, affiliate_status: "suspended" } as PayoutFixture;
    const body = await (await (await one()).GET(req("/p/7"), params("7"))).json();
    expect(body.payout.affiliate_status).toBe("suspended");
  });
  it("record_tx rifiuta (DB: affiliate_not_active) → 409, nessuna email", async () => {
    affiliateRpc.mockResolvedValueOnce({ ok: false, error: "affiliate_not_active", affiliate_status: "suspended" });
    const r = await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }), params("7"));
    expect(r.status).toBe(409);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("QA F2 + N1: tx sparita, submitted → cancelled solo con nonce consumato", () => {
  const sub = { status: "submitted", tx_hash: H1, tx_nonce: 7, tx_block: 1_000_000, tx_from: FROM };
  it("ricevuta null, tx sconosciuta, nonce consumato al finalized → drop, email generica", async () => {
    payout = { ...sub };
    chain.receipt = null;
    chain.tx = null;
    chain.finalizedNonce = 8;
    affiliateRpc.mockResolvedValueOnce({ ok: true, affiliate_id: 1, dropped_tx_hash: H1 });
    const r = await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "tx sparita dopo reorg" }), params("7"));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, cancel_code: "tx_dropped", onchain: "not_found" });
    expect(affiliateRpc).toHaveBeenCalledWith("affiliate_payout_drop_tx", { p_id: 7, p_reason: "tx sparita dopo reorg" });
    expect(rpcCalls).toContain("eth_getTransactionCount");
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
  it("ricevuta null ma nonce NON consumato → 409 nonce_not_consumed, niente annullato (N1)", async () => {
    payout = { ...sub };
    chain.receipt = null;
    chain.tx = null;
    chain.finalizedNonce = 7;
    const r = await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "sembra sparita" }), params("7"));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ error: "tx_not_droppable", reason: "nonce_not_consumed" });
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("nonce non registrato → 409 nonce_unknown senza chiamare la rete", async () => {
    payout = { ...sub, tx_nonce: null };
    const r = await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "sembra sparita" }), params("7"));
    expect(await r.json()).toEqual({ error: "nonce_unknown" });
    expect(rpcCalls).toEqual([]);
  });
  it("tx fallita in un blocco finalizzato → drop", async () => {
    payout = { ...sub };
    chain.receipt = { status: "0x0", blockNumber: "0xf4240", logs: [] };
    affiliateRpc.mockResolvedValueOnce({ ok: true });
    const r = await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "tx revertita" }), params("7"));
    expect(await r.json()).toMatchObject({ onchain: "tx_failed" });
  });
  it("tx ancora valida on-chain → 409, NON si annulla (sarebbe un doppio pagamento)", async () => {
    payout = { ...sub };
    const r = await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "voglio annullare" }), params("7"));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ error: "tx_not_droppable", reason: "tx_on_chain" });
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("RPC giù → 503, niente annullato", async () => {
    payout = { ...sub };
    chain.down = true;
    const r = await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "boh boh" }), params("7"));
    expect(r.status).toBe(503);
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
});

describe("QA N1: hash scartato riusato", () => {
  it("il DB risponde hash_already_used(dropped) → 409 + opsAlert", async () => {
    affiliateRpc.mockResolvedValueOnce({ ok: false, error: "hash_already_used", dropped: true });
    const r = await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }), params("7"));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "hash_already_used", dropped: true });
    expect(opsAlert).toHaveBeenCalledTimes(1);
  });
});

describe("QA R1–R3", () => {
  const sub = { status: "submitted", tx_hash: H1, tx_nonce: 7, tx_block: 1_000_000, tx_from: FROM };
  it("R1: tx firmata da un altro indirizzo → registrata con nonce null e segnalata", async () => {
    chain.tx = { nonce: "0x0", from: "0x9999999999999999999999999999999999999999" };
    const r = await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }), params("7"));
    expect(await r.json()).toMatchObject({ outcome: "paid", tx_from_mismatch: true });
    expect(affiliateRpc.mock.calls[0][1]).toMatchObject({ p_nonce: null, p_block: 1_000_000 });
  });
  it("R2: ricevuta con status «0x01» al drop → 503, niente annullato", async () => {
    payout = { ...sub };
    chain.receipt = { status: "0x01", blockNumber: "0xf4240", logs: [] };
    const r = await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "boh boh" }), params("7"));
    expect(r.status).toBe(503);
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("R3: indice potato ma il Transfer è nei log → 409 transfer_found, niente annullato", async () => {
    payout = { ...sub };
    chain.receipt = null;
    chain.tx = null;
    chain.finalizedNonce = 8;
    chain.logs = [{ address: USDT, topics: [], data: "0x", transactionHash: H1 }];
    const r = await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "sembra sparita" }), params("7"));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "tx_not_droppable", reason: "transfer_found" });
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("R3: blocco di registrazione assente → 409 block_unknown senza rete", async () => {
    payout = { ...sub, tx_block: null };
    const r = await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "sembra sparita" }), params("7"));
    expect(await r.json()).toEqual({ error: "block_unknown" });
    expect(rpcCalls).toEqual([]);
  });
});

describe("QA S3: rotazione di AFFILIATE_PAYOUT_FROM", () => {
  const OLD = "0x3333333333333333333333333333333333333333";
  const sub = { status: "submitted", tx_hash: H1, tx_nonce: 7, tx_block: 1_000_000, tx_from: OLD };
  it("il drop usa il mittente REGISTRATO per log e nonce, anche se l'env ora punta altrove", async () => {
    payout = { ...sub };
    chain.receipt = null;
    chain.tx = null;
    chain.finalizedNonce = 8;
    affiliateRpc.mockResolvedValueOnce({ ok: true });
    const r = await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "tx sparita" }), params("7"));
    expect(r.status).toBe(200);
    const logs = rpcArgs.find((a) => a.method === "eth_getLogs")!.params[0] as { topics: string[] };
    expect(logs.topics[1]).toBe(pad(OLD));
    expect(rpcArgs.find((a) => a.method === "eth_getTransactionCount")!.params[0]).toBe(OLD);
  });
  it("funziona anche con AFFILIATE_PAYOUT_FROM non più configurato", async () => {
    vi.stubEnv("AFFILIATE_PAYOUT_FROM", "");
    payout = { ...sub };
    chain.receipt = null;
    chain.tx = null;
    chain.finalizedNonce = 8;
    affiliateRpc.mockResolvedValueOnce({ ok: true });
    expect((await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "tx sparita" }), params("7"))).status).toBe(200);
  });
  it("mittente non registrato → 409 from_unknown senza rete", async () => {
    payout = { ...sub, tx_from: null };
    const r = await (await cancel()).POST(req("/p/7/cancel", "POST", { reason: "tx sparita" }), params("7"));
    expect(await r.json()).toEqual({ error: "from_unknown" });
    expect(rpcCalls).toEqual([]);
  });
  it("GET [id] espone tx_from", async () => {
    payout = { ...sub };
    const body = await (await (await one()).GET(req("/p/7"), params("7"))).json();
    expect(body.payout.tx_from).toBe(OLD);
  });
});

describe("Gate A fix payouts.ts:342 — riverifica dopo la rotazione di AFFILIATE_PAYOUT_FROM", () => {
  const OLD = "0x3333333333333333333333333333333333333333";
  const NEW = "0x4444444444444444444444444444444444444444";
  it("submitted registrato da OLD, env ora NEW: la riverifica usa tx_from e arriva a paid", async () => {
    vi.stubEnv("AFFILIATE_PAYOUT_FROM", NEW);
    payout = { status: "submitted", tx_hash: H1, tx_nonce: 7, tx_block: 1_000_000, tx_from: OLD };
    chain.receipt = receiptOk(60, TO, OLD);
    chain.tx = { nonce: "0x7", from: OLD };
    affiliateRpc.mockResolvedValueOnce({ ok: true, status: "paid", became_paid: true });
    const r = await (await verify()).POST(req("/p/7/verify", "POST"), params("7"));
    expect(await r.json()).toMatchObject({ outcome: "paid", tx_from_mismatch: false });
    expect(affiliateRpc.mock.calls[0][1]).toMatchObject({ p_from: OLD, p_nonce: 7, p_paid: true });
  });
  it("stessa cosa con AFFILIATE_PAYOUT_FROM non più configurato", async () => {
    vi.stubEnv("AFFILIATE_PAYOUT_FROM", "");
    payout = { status: "submitted", tx_hash: H1, tx_nonce: 7, tx_block: 1_000_000, tx_from: OLD };
    chain.receipt = receiptOk(60, TO, OLD);
    chain.tx = { nonce: "0x7", from: OLD };
    const r = await (await verify()).POST(req("/p/7/verify", "POST"), params("7"));
    expect(await r.json()).toMatchObject({ outcome: "paid" });
  });
  it("payout created: il mittente atteso resta il wallet di uscita ATTUALE (Transfer da OLD → wrong_sender)", async () => {
    vi.stubEnv("AFFILIATE_PAYOUT_FROM", NEW);
    payout = { status: "created", tx_hash: null };
    chain.receipt = receiptOk(60, TO, OLD);
    chain.tx = { nonce: "0x7", from: OLD };
    const r = await (await tx()).POST(req("/p/7/tx", "POST", { hash: H1 }), params("7"));
    expect(await r.json()).toEqual({ outcome: "rejected", reason: "wrong_sender" });
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("submitted senza tx_from registrato → 409 from_unknown, nessuna chiamata di rete", async () => {
    payout = { status: "submitted", tx_hash: H1, tx_nonce: 7, tx_block: 1_000_000, tx_from: null };
    const r = await (await verify()).POST(req("/p/7/verify", "POST"), params("7"));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "from_unknown" });
    expect(rpcCalls).toEqual([]);
  });
});
