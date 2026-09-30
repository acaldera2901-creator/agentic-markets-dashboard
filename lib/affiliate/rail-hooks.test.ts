// #AFFILIATE-V2-0930 PR-2 — guardie di regressione sui rail di pagamento.
//
// Il ledger è agganciato nei CHIAMANTI delle activate*Plan (5 rail, 9 punti).
// Qui si verifica, per ognuno, con il ledger VERO (non mockato):
//  1. AFFILIATE_MODE=off → il ledger non emette nemmeno una query;
//  2. shadow + DB del ledger che lancia → il rail si comporta ESATTAMENTE come
//     con off: stessa risposta, stesse query non-affiliate nello stesso ordine
//     (in particolare nessun rollback dell'idempotenza Shopify/Stripe, che
//     farebbe ritentare il webhook e raddoppiare il grant);
//  3. shadow + DB sano → una riga in affiliate_commissions con rail, ref e
//     importi giusti.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";

type Call = { sql: string; params: unknown[] };
const calls: Call[] = [];
const AFF_RE = /\baffiliate|referred_by/;
let affDown = false;
let railResponder: (sql: string, params: unknown[]) => unknown[] = () => [];
let attributionWritten = false;
const commissions: unknown[][] = [];

function affiliateResponder(sql: string, params: unknown[]): unknown[] {
  if (/FROM affiliate_attributions/.test(sql)) return attributionWritten ? [{ affiliate_id: 7, status: "valid" }] : [];
  if (/FROM profiles/.test(sql)) return [{ referred_by: "AFF1" }];
  if (/FROM affiliates/.test(sql)) return [{ id: 7, identifier: "aff@x.com" }];
  if (/FROM affiliate_payer_fingerprints/.test(sql)) return [];
  if (/INSERT INTO affiliate_attributions/.test(sql)) {
    attributionWritten = true;
    return [];
  }
  if (/WHERE rail = \$1 AND rail_payment_ref = \$2/.test(sql)) {
    return [{ n: commissions.filter((c) => c[2] === params[0] && c[3] === params[1]).length }];
  }
  if (/WHERE referred_identifier = \$1/.test(sql)) return [{ n: commissions.length }];
  if (/INSERT INTO affiliate_commissions/.test(sql)) {
    commissions.push(params);
    return [];
  }
  throw new Error(`query affiliate inattesa: ${sql}`);
}

function dbFn() {
  return vi.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (AFF_RE.test(sql)) {
      if (affDown) throw new Error("affiliate db down");
      return affiliateResponder(sql, params);
    }
    return railResponder(sql, params);
  });
}
const dbQuery = dbFn();
const dbQueryStrict = dbFn();
const dbExecute = dbFn();
const rpc = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery, dbQueryStrict, dbExecute, getSupabaseAdminClient: () => ({ rpc }) }));

const grant = { identifier: "u@t.com", name: null, plan: "base" };
const activatePaygatePlan = vi.fn();
const activatePaypalPlan = vi.fn();
const activateShopifyPlan = vi.fn();
const activateStripePlan = vi.fn();
const revokeShopifyPlan = vi.fn();
const sendPlanReceipt = vi.fn();
vi.mock("@/lib/plan-grant", () => ({
  activatePaygatePlan,
  activatePaypalPlan,
  activateShopifyPlan,
  activateStripePlan,
  revokeShopifyPlan,
  sendPlanReceipt,
}));

const checkPaymentStatus = vi.fn();
vi.mock("@/lib/paygate", () => ({
  hashToken: () => "tokhash",
  evaluateCallback: () => ({ grant: true }),
  checkPaymentStatus,
}));
vi.mock("@/lib/shopify-admin", () => ({ createMirroredPaidOrder: vi.fn(async () => null) }));
vi.mock("@/lib/weekly-pick-server", () => ({ grantWeeklyPick: vi.fn(), notifyWeeklyPickGranted: vi.fn() }));
vi.mock("@/lib/ops-alert", () => ({ opsAlert: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ verifyBearer: () => true }));
const checkIncoming = vi.fn();
vi.mock("@/lib/crypto-verify", async () => {
  const real = await vi.importActual<typeof import("../crypto-verify")>("../crypto-verify");
  return { ...real, checkIncoming };
});
const captureOrder = vi.fn();
vi.mock("@/lib/paypal", () => ({
  captureOrder,
  evaluateCapture: () => ({ grant: true }),
  verifyWebhookSignature: async () => true,
}));
const stripeEvent: { current: unknown } = { current: null };
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: () => true,
  getStripe: () => ({
    webhooks: { constructEvent: () => stripeEvent.current },
    subscriptions: { retrieve: async () => ({ metadata: { identifier: "u@t.com" }, status: "active" }) },
  }),
  resolvePlanFromPriceId: () => "base",
  periodEndToIso: () => "2026-11-01T00:00:00.000Z",
}));
vi.mock("@/lib/email", () => ({
  receiptEmail: () => ({ subject: "s", html: "h", text: "t" }),
  cancellationEmail: () => ({ subject: "s", html: "h", text: "t" }),
}));
vi.mock("@/lib/notify", () => ({ sendTransactional: vi.fn() }));

const SHOPIFY_SECRET = "whsec_test_affiliate";
const savedEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  commissions.length = 0;
  affDown = false;
  attributionWritten = false;
  railResponder = () => [];
  rpc.mockResolvedValue({ data: true, error: null });
  activatePaygatePlan.mockResolvedValue(grant);
  activatePaypalPlan.mockResolvedValue(grant);
  activateShopifyPlan.mockResolvedValue(grant);
  activateStripePlan.mockResolvedValue(grant);
  checkPaymentStatus.mockResolvedValue({ status: "paid", valueCoin: 14.99, txidOut: "tx" });
  checkIncoming.mockResolvedValue({ received: 15.01, pending: 0, txHash: "0xtx" });
  captureOrder.mockResolvedValue({ status: "COMPLETED", capturedValue: 14.99, currency: "USD", captureId: "cap-1" });
  Object.assign(process.env, {
    CRYPTO_COINS_ENABLED: "polygon-usdc",
    PAYPAL_CLIENT_ID: "x",
    PAYPAL_CLIENT_SECRET: "x",
    PAYPAL_WEBHOOK_ID: "x",
    STRIPE_WEBHOOK_SECRET: "x",
    SHOPIFY_WEBHOOK_SECRET: SHOPIFY_SECRET,
    SHOPIFY_VARIANT_BASE: "111",
    SHOPIFY_VARIANT_PREMIUM: "222",
    SHOPIFY_VARIANT_WEEKLY: "333",
    CRON_SECRET: "c",
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  process.env = { ...savedEnv };
  vi.restoreAllMocks();
});

type Outcome = { result: unknown; railCalls: Call[] };

/** Esegue il rail una volta e separa le query del rail da quelle del ledger. */
async function run(mode: "off" | "shadow", down: boolean, fn: () => Promise<unknown>): Promise<Outcome & { affCalls: Call[] }> {
  calls.length = 0;
  commissions.length = 0;
  attributionWritten = false;
  affDown = down;
  if (mode === "off") delete process.env.AFFILIATE_MODE;
  else process.env.AFFILIATE_MODE = mode;
  const result = await fn();
  return {
    result,
    railCalls: calls.filter((c) => !AFF_RE.test(c.sql)),
    affCalls: calls.filter((c) => AFF_RE.test(c.sql)),
  };
}

async function body(r: unknown): Promise<unknown> {
  if (r instanceof Response) return { status: r.status, json: await r.json() };
  return r;
}

/** Le tre verifiche, per un rail. `expectRow` = [rail, ref, gross, net]. */
async function guard(fn: () => Promise<unknown>, expectRow: [string, string, number, number] | null) {
  const off = await run("off", false, async () => body(await fn()));
  expect(off.affCalls).toHaveLength(0);

  const broken = await run("shadow", true, async () => body(await fn()));
  expect(broken.result).toEqual(off.result);
  expect(broken.railCalls).toEqual(off.railCalls);
  expect(broken.affCalls.length).toBeGreaterThan(0); // il ledger ci ha provato davvero

  const healthy = await run("shadow", false, async () => body(await fn()));
  expect(healthy.result).toEqual(off.result);
  expect(healthy.railCalls).toEqual(off.railCalls);
  if (expectRow) {
    expect(commissions).toHaveLength(1);
    const row = commissions[0];
    expect([row[2], row[3], row[5], row[6]]).toEqual(expectRow);
    expect(row[4]).toBe("first");
    expect(row[10]).toBe("shadow");
  } else {
    expect(commissions).toHaveLength(0);
  }
  return off;
}

describe("rail PayGate", () => {
  const ORDER = {
    id: "pg-1", identifier: "u@t.com", plan: "base", period: "monthly", amount_usd: 14.99,
    status: "pending", ipn_token: "ipn", shopify_order_id: "gid-existing",
  };

  it("callback: grant invariato, ledger dopo il grant", async () => {
    railResponder = (sql) => (/FROM paygate_orders WHERE token_hash/.test(sql) ? [ORDER] : []);
    const { GET } = await import("@/app/api/paygate/callback/route");
    const off = await guard(() => GET(new Request("https://x/api/paygate/callback?token=t&order=pg-1")), ["paygate", "pg-1", 14.99, 14.99]);
    expect(off.result).toEqual({ status: 200, json: { ok: true } });
    expect(activatePaygatePlan).toHaveBeenCalledWith("u@t.com", "base", "monthly");
  });

  it("settlePendingOrder (settle-mine / reconcile pass 2)", async () => {
    const { settlePendingOrder } = await import("@/lib/paygate-settle");
    const off = await guard(() => settlePendingOrder({ ...ORDER, plan: "base", period: "monthly" } as never), ["paygate", "pg-1", 14.99, 14.99]);
    expect(off.result).toEqual({ granted: true, reason: "ok" });
  });

  it("reconcile pass 1 (paid senza grant): rail paygate, o crypto se l'ordine ha coin", async () => {
    let coin: string | null = null;
    railResponder = (sql) =>
      /status = 'paid' AND granted_at IS NULL/.test(sql)
        ? [{ id: "pg-2", identifier: "u@t.com", plan: "base", period: "monthly", amount_usd: 14.99, coin }]
        : [];
    const { GET } = await import("@/app/api/cron/paygate-reconcile/route");
    const req = () => GET(new Request("https://x/api/cron/paygate-reconcile", { headers: { authorization: "Bearer c" } }));
    await guard(req, ["paygate", "pg-2", 14.99, 14.99]);
    coin = "polygon-usdc";
    await guard(req, ["crypto", "pg-2", 14.99, 14.99]);
  });
});

describe("rail crypto diretto", () => {
  it("settleCryptoOrder: piano concesso, riga crypto", async () => {
    const { settleCryptoOrder } = await import("@/lib/crypto-settle");
    const ORDER = {
      id: "cr-1", identifier: "u@t.com", plan: "base" as const, period: "monthly" as const, amount_usd: 14.99,
      status: "pending", coin: "polygon-usdc", expected_value_coin: 15.01, crypto_address_in: "0xdep", shopify_order_id: "gid",
    };
    const off = await guard(() => settleCryptoOrder(ORDER), ["crypto", "cr-1", 14.99, 14.99]);
    expect(off.result).toMatchObject({ granted: true, reason: "ok" });
  });
});

describe("rail PayPal", () => {
  const ORDER = { id: "pp-1", identifier: "u@t.com", plan: "base", period: "monthly", amount_usd: 14.99, status: "pending" };

  it("capture", async () => {
    railResponder = (sql) => (/FROM paypal_orders/.test(sql) ? [ORDER] : []);
    const { POST } = await import("@/app/api/paypal/capture/route");
    const req = () => POST(new Request("https://x/api/paypal/capture", { method: "POST", body: JSON.stringify({ paypal_order_id: "PP1" }) }));
    const off = await guard(req, ["paypal", "pp-1", 14.99, 14.99]);
    expect(off.result).toEqual({ status: 200, json: { ok: true, granted: true } });
  });

  it("webhook PAYMENT.CAPTURE.COMPLETED", async () => {
    railResponder = (sql) => (/FROM paypal_orders/.test(sql) ? [ORDER] : []);
    const { POST } = await import("@/app/api/paypal/webhook/route");
    const evt = { event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { custom_id: "pp-1", id: "cap-1", amount: { value: "14.99", currency_code: "USD" } } };
    const req = () => POST(new Request("https://x/api/paypal/webhook", { method: "POST", body: JSON.stringify(evt) }));
    const off = await guard(req, ["paypal", "pp-1", 14.99, 14.99]);
    expect(off.result).toEqual({ status: 200, json: { ok: true } });
  });

  it("capture + webhook sullo stesso ordine: una sola commissione", async () => {
    railResponder = (sql) => (/FROM paypal_orders/.test(sql) ? [ORDER] : []);
    process.env.AFFILIATE_MODE = "shadow";
    const cap = await import("@/app/api/paypal/capture/route");
    const wh = await import("@/app/api/paypal/webhook/route");
    await cap.POST(new Request("https://x/c", { method: "POST", body: JSON.stringify({ paypal_order_id: "PP1" }) }));
    const evt = { event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { custom_id: "pp-1", amount: { value: "14.99", currency_code: "USD" } } };
    await wh.POST(new Request("https://x/w", { method: "POST", body: JSON.stringify(evt) }));
    expect(commissions).toHaveLength(1);
  });
});

describe("rail Shopify", () => {
  const sign = (b: string) => crypto.createHmac("sha256", SHOPIFY_SECRET).update(b, "utf8").digest("base64");
  const shopReq = (payload: unknown) => {
    const b = JSON.stringify(payload);
    return new Request("https://x/api/shopify/webhook", {
      method: "POST",
      headers: { "x-shopify-hmac-sha256": sign(b), "x-shopify-topic": "orders/paid" },
      body: b,
    });
  };

  it("webhook orders/paid: tasse dedotte dal netto, idempotenza non toccata", async () => {
    railResponder = (sql) => (/INSERT INTO shopify_events/.test(sql) ? [{ event_id: "won" }] : []);
    const { POST } = await import("@/app/api/shopify/webhook/route");
    const payload = { id: 903, email: "u@t.com", line_items: [{ variant_id: 111 }], total_price: "18.29", total_tax: "3.30", currency: "USD" };
    const off = await guard(() => POST(shopReq(payload)), ["shopify", "903", 18.29, 14.99]);
    expect(off.result).toEqual({ status: 200, json: { received: true } });
    expect(off.railCalls.some((c) => /DELETE FROM shopify_events/.test(c.sql))).toBe(false);
  });

  it("carrello piano + Weekly Pick: lordo non attribuibile al piano → nessuna commissione", async () => {
    railResponder = (sql) => (/INSERT INTO shopify_events/.test(sql) ? [{ event_id: "won" }] : []);
    const { POST } = await import("@/app/api/shopify/webhook/route");
    const payload = { id: 904, email: "u@t.com", line_items: [{ variant_id: 111 }, { variant_id: 333 }], total_price: "30.00" };
    const off = await guard(() => POST(shopReq(payload)), null);
    expect(off.result).toEqual({ status: 200, json: { received: true, weeklyPick: true } });
  });

  it("reconcile degli unresolved: amount da shopify_events", async () => {
    railResponder = (sql) =>
      /WHERE status = 'unresolved'/.test(sql) ? [{ event_id: "905", identifier: "u@t.com", variant_id: "111", amount: "14.99" }] : [];
    const { GET } = await import("@/app/api/cron/shopify-reconcile/route");
    await guard(() => GET(new Request("https://x/api/cron/shopify-reconcile", { headers: { authorization: "Bearer c" } })), ["shopify", "905", 14.99, 14.99]);
  });

  it("reconcile con amount NULL (righe storiche): nessuna commissione", async () => {
    railResponder = (sql) =>
      /WHERE status = 'unresolved'/.test(sql) ? [{ event_id: "906", identifier: "u@t.com", variant_id: "111", amount: null }] : [];
    const { GET } = await import("@/app/api/cron/shopify-reconcile/route");
    await guard(() => GET(new Request("https://x/api/cron/shopify-reconcile", { headers: { authorization: "Bearer c" } })), null);
  });
});

describe("rail Stripe", () => {
  it("invoice.paid: ref = invoice.id, importo da amount_paid, idempotenza non toccata", async () => {
    stripeEvent.current = {
      id: "evt_1",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_1",
          amount_paid: 1499,
          currency: "usd",
          total_taxes: [],
          customer: "cus_1",
          lines: { data: [{ pricing: { price_details: { price: "price_1" } }, period: { end: 1790000000 } }] },
          parent: { subscription_details: { subscription: "sub_1" } },
        },
      },
    };
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = () => POST(new Request("https://x/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "sig" }, body: "{}" }));
    const off = await guard(req, ["stripe", "in_1", 14.99, 14.99]);
    expect(off.result).toEqual({ status: 200, json: { received: true } });
    expect(activateStripePlan).toHaveBeenCalledWith("u@t.com", "base", "sub_1", "2026-11-01T00:00:00.000Z");
    expect(off.railCalls.some((c) => /DELETE FROM stripe_events/.test(c.sql))).toBe(false);
  });
});
