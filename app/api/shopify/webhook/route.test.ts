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
function req(body: string, hmac: string | null, topic?: string) {
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
  dbQueryStrict.mockResolvedValue([]); // non ancora visto
});

it("ordine ANNUALE: concede 365 giorni, non 30", async () => {
  activateShopifyPlan.mockResolvedValue({ identifier: "u@t.com", name: null, plan: "premium" });
  const body = JSON.stringify({ id: 903, email: "u@t.com", line_items: [{ variant_id: 555 }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body)));
  expect(res.status).toBe(200);
  expect(activateShopifyPlan).toHaveBeenCalledWith("u@t.com", "premium", "annual");
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
  expect(activateShopifyPlan).toHaveBeenCalledWith("u@t.com", "premium", "monthly");
});

it("è idempotente: evento già visto → no grant", async () => {
  dbQueryStrict.mockResolvedValue([{ event_id: "900" }]);
  const body = JSON.stringify({ id: 900, email: "u@t.com", line_items: [{ variant_id: 222 }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body)));
  expect(res.status).toBe(200);
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
  const insert = dbExecute.mock.calls.find((c) => String(c[0]).includes("INSERT INTO shopify_events"));
  expect(insert?.[1]).toEqual(["920", "u@t.com", "111", 14.99]);
});
