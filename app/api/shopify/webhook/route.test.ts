import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

const dbQueryStrict = vi.fn();
const dbExecute = vi.fn();
const activateShopifyPlan = vi.fn();
const grantWeeklyPick = vi.fn();
const revokeShopifyPlan = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery: vi.fn(), dbQueryStrict, dbExecute }));
vi.mock("@/lib/plan-grant", () => ({ activateShopifyPlan, revokeShopifyPlan }));
vi.mock("@/lib/weekly-pick-server", () => ({ grantWeeklyPick }));
const opsAlert = vi.fn();
vi.mock("@/lib/ops-alert", () => ({ opsAlert }));

const SECRET = "whsec_test_123";
function sign(body: string) {
  return crypto.createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
}
// I webhook orders/paid reali portano SEMPRE l'header x-shopify-topic: il default
// qui riflette la realtà. Passare topic=null simula un header esplicitamente assente.
function req(body: string, hmac: string | null, topic: string | null = "orders/paid") {
  const headers: Record<string, string> = {};
  if (hmac) headers["x-shopify-hmac-sha256"] = hmac;
  if (topic) headers["x-shopify-topic"] = topic;
  return new Request("https://x/api/shopify/webhook", { method: "POST", headers, body });
}

// --- refunds/create: revoca l'accesso ---

it("rimborso: revoca l'accesso dell'identifier dell'ordine originale", async () => {
  // 1a query: idempotenza sul refund (non visto). 2a: lookup identifier dall'ordine.
  dbQueryStrict.mockResolvedValueOnce([]).mockResolvedValueOnce([{ identifier: "u@t.com" }]);
  revokeShopifyPlan.mockResolvedValue(true);
  const body = JSON.stringify({ id: 7001, order_id: 900 });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body), "refunds/create"));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ revoked: true });
  expect(revokeShopifyPlan).toHaveBeenCalledWith("u@t.com");
  expect(activateShopifyPlan).not.toHaveBeenCalled();
});

it("rimborso già processato: non revoca due volte", async () => {
  dbQueryStrict.mockResolvedValueOnce([{ event_id: "refund:7001" }]);
  const body = JSON.stringify({ id: 7001, order_id: 900 });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body), "refunds/create"));
  expect(await res.json()).toMatchObject({ duplicate: true });
  expect(revokeShopifyPlan).not.toHaveBeenCalled();
});

it("rimborso su ordine sconosciuto: NON tira a indovinare chi disattivare", async () => {
  dbQueryStrict.mockResolvedValueOnce([]).mockResolvedValueOnce([]); // ordine non trovato
  const body = JSON.stringify({ id: 7002, order_id: 12345 });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body), "refunds/create"));
  expect(await res.json()).toMatchObject({ unresolved: true });
  expect(revokeShopifyPlan).not.toHaveBeenCalled();
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHOPIFY_WEBHOOK_SECRET = SECRET;
  process.env.SHOPIFY_VARIANT_BASE = "111";
  process.env.SHOPIFY_VARIANT_PREMIUM = "222";
  process.env.SHOPIFY_VARIANT_WEEKLY = "333";
  process.env.SHOPIFY_VARIANT_BASE_ANNUAL = "444";
  process.env.SHOPIFY_VARIANT_PREMIUM_ANNUAL = "555";
  process.env.SHOPIFY_VARIANT_BASE_ONEOFF = "9111";
  process.env.SHOPIFY_CRYPTO_GATEWAY_NAME = "Crypto (USDT, BTC, ETH)";
  // Default per il path orders/paid: l'INSERT..RETURNING restituisce 1 riga = ordine
  // nostro (nessun conflitto) → si procede al grant. I test refund impostano le
  // proprie sequenze con mockResolvedValueOnce.
  dbQueryStrict.mockResolvedValue([{ event_id: "won" }]);
});

it("ordine ANNUALE: concede 365 giorni, non 30", async () => {
  activateShopifyPlan.mockResolvedValue({ identifier: "u@t.com", name: null, plan: "premium" });
  const body = JSON.stringify({ id: 903, email: "u@t.com", line_items: [{ variant_id: 555 }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body)));
  expect(res.status).toBe(200);
  expect(activateShopifyPlan).toHaveBeenCalledWith("u@t.com", "premium", "annual", false);
});

it("weekly pick: concede la settimana corrente, non un piano", async () => {
  const body = JSON.stringify({ id: 901, email: "u@t.com", line_items: [{ variant_id: 333 }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body)));
  expect(res.status).toBe(200);
  expect(activateShopifyPlan).not.toHaveBeenCalled();
  expect(grantWeeklyPick).toHaveBeenCalledTimes(1);
  const [identifier, week, tokenHash] = grantWeeklyPick.mock.calls[0];
  expect(identifier).toBe("u@t.com");
  expect(week).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(tokenHash).toBeNull();
});

it("weekly pick: senza identifier non concede nulla", async () => {
  const body = JSON.stringify({ id: 902, line_items: [{ variant_id: 333 }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body)));
  expect(res.status).toBe(200);
  expect(grantWeeklyPick).not.toHaveBeenCalled();
});

it("rifiuta firma non valida con 401", async () => {
  const { POST } = await import("./route");
  const res = await POST(req('{"id":1}', "bad"));
  expect(res.status).toBe(401);
  expect(activateShopifyPlan).not.toHaveBeenCalled();
});

it("concede il piano su orders/paid valido", async () => {
  activateShopifyPlan.mockResolvedValue({ identifier: "u@t.com", name: null, plan: "premium" });
  const body = JSON.stringify({ id: 900, email: "u@t.com", line_items: [{ variant_id: 222 }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body)));
  expect(res.status).toBe(200);
  expect(activateShopifyPlan).toHaveBeenCalledWith("u@t.com", "premium", "monthly", false);
});

it("idempotenza atomica: INSERT in conflitto (0 righe) → duplicate, no grant", async () => {
  dbQueryStrict.mockResolvedValue([]); // ON CONFLICT DO NOTHING → nessuna riga = già preso
  const body = JSON.stringify({ id: 900, email: "u@t.com", line_items: [{ variant_id: 222 }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body)));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ duplicate: true });
  expect(activateShopifyPlan).not.toHaveBeenCalled();
});

// --- granularità del rimborso: non tutti i rimborsi spengono l'abbonamento ---

it("rimborso della Weekly Pick: NON spegne l'abbonamento", async () => {
  dbQueryStrict
    .mockResolvedValueOnce([]) // refund non visto
    .mockResolvedValueOnce([{ identifier: "u@t.com", variant_id: "333", amount: "12.99" }]);
  const body = JSON.stringify({ id: 7010, order_id: 910, transactions: [{ kind: "refund", amount: "12.99" }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body), "refunds/create"));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ manual: expect.stringContaining("Weekly Pick") });
  expect(revokeShopifyPlan).not.toHaveBeenCalled();
  expect(opsAlert).toHaveBeenCalled();
});

it("rimborso PARZIALE su un annuale: non azzera 12 mesi pagati", async () => {
  dbQueryStrict
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ identifier: "u@t.com", variant_id: "444", amount: "329.99" }]);
  const body = JSON.stringify({ id: 7011, order_id: 911, transactions: [{ kind: "refund", amount: "29.99" }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body), "refunds/create"));
  expect(await res.json()).toMatchObject({ manual: expect.stringContaining("parziale") });
  expect(revokeShopifyPlan).not.toHaveBeenCalled();
});

it("rimborso TOTALE di un piano: revoca", async () => {
  dbQueryStrict
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ identifier: "u@t.com", variant_id: "444", amount: "329.99" }]);
  revokeShopifyPlan.mockResolvedValue(true);
  const body = JSON.stringify({ id: 7012, order_id: 912, transactions: [{ kind: "refund", amount: "329.99" }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body), "refunds/create"));
  expect(await res.json()).toMatchObject({ revoked: true });
  expect(revokeShopifyPlan).toHaveBeenCalledWith("u@t.com");
});

// Se la revoca throwa NON si scrive l'idempotenza: altrimenti il rimborso
// risulterebbe gestito e l'utente resterebbe abbonato a spese nostre.
it("revoca fallita → 500, nessuna riga di idempotenza", async () => {
  dbQueryStrict
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ identifier: "u@t.com", variant_id: "111", amount: "14.99" }]);
  revokeShopifyPlan.mockRejectedValue(new Error("db down"));
  const body = JSON.stringify({ id: 7013, order_id: 913, transactions: [{ kind: "refund", amount: "14.99" }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body), "refunds/create"));
  expect(res.status).toBe(500);
  expect(dbExecute).not.toHaveBeenCalled();
});

it("l'ordine registra l'importo: senza, un rimborso parziale sarebbe indistinguibile", async () => {
  activateShopifyPlan.mockResolvedValue({ identifier: "u@t.com", name: null, plan: "base" });
  const body = JSON.stringify({ id: 920, email: "u@t.com", total_price: "14.99", line_items: [{ variant_id: 111 }] });
  const { POST } = await import("./route");
  await POST(req(body, sign(body)));
  // L'INSERT è ora il gate atomico (dbQueryStrict … RETURNING), non più dbExecute.
  const insert = dbQueryStrict.mock.calls.find((c) => String(c[0]).includes("INSERT INTO shopify_events"));
  expect(insert?.[1]).toEqual(["920", "u@t.com", "111", 14.99]);
});

// #SHOPIFY-CRYPTO-2 — LA guardia che regge tutto il rail crypto.
// L'ordine crypto lo marchiamo pagato NOI via Admin API dopo il callback
// PayGate, quindi orders/paid arriva SEMPRE su un piano già concesso:
// concederlo di nuovo qui regalerebbe altri 30 giorni per ogni pagamento.
it("ordine crypto: NON concede il piano (lo ha già fatto il callback PayGate)", async () => {
  const body = JSON.stringify({
    id: 930, email: "u@t.com", total_price: "14.99",
    payment_gateway_names: ["Crypto (USDT, BTC, ETH)"],
    line_items: [{ variant_id: 9111 }],
  });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body)));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ cryptoPaygate: true });
  expect(activateShopifyPlan).not.toHaveBeenCalled();
  expect(dbExecute).toHaveBeenCalledWith(expect.stringContaining("SET status = $2"), ["930", "crypto-paygate", null]);
});

// La stessa SKU one-off è pubblica sullo storefront: se qualcuno la paga con
// CARTA nessun callback PayGate arriverà, quindi il grant deve avvenire qui.
it("SKU one-off pagata con carta: concede 30 giorni come one-off", async () => {
  activateShopifyPlan.mockResolvedValue({ identifier: "u@t.com", name: null, plan: "base" });
  const body = JSON.stringify({
    id: 931, email: "u@t.com", total_price: "14.99",
    payment_gateway_names: ["shopify_payments"],
    line_items: [{ variant_id: 9111 }],
  });
  const { POST } = await import("./route");
  await POST(req(body, sign(body)));
  // 4o argomento true = one-off → plan_source 'shopify_oneoff', nessun contratto
  expect(activateShopifyPlan).toHaveBeenCalledWith("u@t.com", "base", "monthly", true);
});

// --- fix#1: race idempotenza (l'INSERT atomico è il gate) ---

it("race: due delivery concorrenti dello stesso ordine → UN solo grant", async () => {
  activateShopifyPlan.mockResolvedValue({ identifier: "u@t.com", name: null, plan: "premium" });
  // 1a delivery vince l'INSERT (1 riga), la 2a trova il conflitto (0 righe).
  dbQueryStrict.mockResolvedValueOnce([{ event_id: "940" }]).mockResolvedValueOnce([]);
  const body = JSON.stringify({ id: 940, email: "u@t.com", line_items: [{ variant_id: 222 }] });
  const { POST } = await import("./route");
  const r1 = await POST(req(body, sign(body)));
  const r2 = await POST(req(body, sign(body)));
  expect(r1.status).toBe(200);
  expect(r2.status).toBe(200);
  expect(await r2.json()).toMatchObject({ duplicate: true });
  // il cuore del fix: non due volte i giorni per un solo pagamento.
  expect(activateShopifyPlan).toHaveBeenCalledTimes(1);
});

// --- fix#2: whitelist topic (solo orders/paid concede) ---

it("topic non-paid (es. orders/create): ack senza grant", async () => {
  const body = JSON.stringify({ id: 950, email: "u@t.com", line_items: [{ variant_id: 222 }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body), "orders/create"));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ignored: "orders/create" });
  expect(activateShopifyPlan).not.toHaveBeenCalled();
});

it("header topic assente: NON concede (niente più default a orders/paid)", async () => {
  const body = JSON.stringify({ id: 951, email: "u@t.com", line_items: [{ variant_id: 222 }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body), null)); // header topic esplicitamente assente
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ignored: null });
  expect(activateShopifyPlan).not.toHaveBeenCalled();
});
