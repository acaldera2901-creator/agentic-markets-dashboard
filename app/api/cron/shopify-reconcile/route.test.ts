import { it, expect, vi, beforeEach } from "vitest";

const dbQuery = vi.fn();
const dbExecute = vi.fn();
const activateShopifyPlan = vi.fn();
const opsAlert = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery, dbExecute, dbQueryStrict: vi.fn() }));
vi.mock("@/lib/plan-grant", () => ({ activateShopifyPlan }));
vi.mock("@/lib/ops-alert", () => ({ opsAlert }));
// Il mock deve guardare l'HEADER, non solo il secret: altrimenti il test del 401
// passerebbe per finta (verifyBearer tornerebbe true anche senza authorization).
vi.mock("@/lib/admin-auth", () => ({
  verifyBearer: (r: Request, s?: string) => Boolean(s) && r.headers.get("authorization") === `Bearer ${s}`,
}));

function req() {
  return new Request("https://x/api/cron/shopify-reconcile", {
    headers: { authorization: "Bearer sekret" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "sekret";
  process.env.SHOPIFY_VARIANT_BASE = "111";
  process.env.SHOPIFY_VARIANT_PREMIUM_ANNUAL = "444";
  dbQuery.mockResolvedValue([]);
});

it("401 senza cron secret", async () => {
  const { GET } = await import("./route");
  const res = await GET(new Request("https://x/api/cron/shopify-reconcile"));
  expect(res.status).toBe(401);
});

it("recupera il pagamento rimasto senza piano e lo segna granted", async () => {
  dbQuery.mockResolvedValueOnce([{ event_id: "900", identifier: "u@t.com", variant_id: "111" }]);
  activateShopifyPlan.mockResolvedValue({ identifier: "u@t.com", name: null, plan: "base" });
  const { GET } = await import("./route");
  const body = await (await GET(req())).json();
  expect(activateShopifyPlan).toHaveBeenCalledWith("u@t.com", "base", "monthly");
  expect(body.granted).toBe(1);
  expect(dbExecute).toHaveBeenCalledWith(expect.stringContaining("status = 'granted'"), ["900"]);
});

it("rispetta il periodo annuale anche in recupero (365 giorni, non 30)", async () => {
  dbQuery.mockResolvedValueOnce([{ event_id: "901", identifier: "u@t.com", variant_id: "444" }]);
  activateShopifyPlan.mockResolvedValue({ identifier: "u@t.com", name: null, plan: "premium" });
  const { GET } = await import("./route");
  await GET(req());
  expect(activateShopifyPlan).toHaveBeenCalledWith("u@t.com", "premium", "annual");
});

it("se il profilo ancora non esiste lascia l'evento da ritentare e allerta", async () => {
  dbQuery.mockResolvedValueOnce([{ event_id: "902", identifier: "nuovo@t.com", variant_id: "111" }]);
  activateShopifyPlan.mockResolvedValue(null); // profilo inesistente
  const { GET } = await import("./route");
  const body = await (await GET(req())).json();
  expect(body.granted).toBe(0);
  expect(body.stillUnresolved).toBe(1);
  expect(dbExecute).not.toHaveBeenCalled(); // NON marcare granted
  expect(opsAlert).toHaveBeenCalled();
});

it("non tenta nulla su variant non nostro e non chiama il grant", async () => {
  dbQuery.mockResolvedValueOnce([{ event_id: "903", identifier: "u@t.com", variant_id: "999" }]);
  const { GET } = await import("./route");
  const body = await (await GET(req())).json();
  expect(activateShopifyPlan).not.toHaveBeenCalled();
  expect(body.stillUnresolved).toBe(1);
});

it("niente da fare → nessun alert", async () => {
  const { GET } = await import("./route");
  const body = await (await GET(req())).json();
  expect(body).toMatchObject({ scanned: 0, granted: 0, stillUnresolved: 0 });
  expect(opsAlert).not.toHaveBeenCalled();
});

// Blocker go-live: la riga di idempotenza viene scritta PRIMA del grant. Se la
// function muore lì in mezzo l'ordine resta 'pending' per sempre e il retry di
// Shopify lo scarta come duplicato: pagamento incassato, piano mai concesso.
it("segnala l'ordine 'pending' bloccato a metà senza ri-concedere il piano", async () => {
  dbQuery
    .mockResolvedValueOnce([]) // nessun unresolved
    .mockResolvedValueOnce([{ event_id: "950", identifier: "u@t.com" }]); // stale
  const { GET } = await import("./route");
  const body = await (await GET(req())).json();
  expect(body.stale).toBe(1);
  // NON si ri-tenta: activateShopifyPlan stacca il residuo → regalerebbe un mese.
  expect(activateShopifyPlan).not.toHaveBeenCalled();
  expect(dbExecute).toHaveBeenCalledWith(expect.stringContaining("status = 'stale'"), ["950"]);
  expect(opsAlert).toHaveBeenCalledWith("shopify-reconcile", expect.anything());
});

it("l'ordine marcato 'stale' non ri-allerta al giro dopo", async () => {
  // La UPDATE ... WHERE status = 'pending' lo porta fuori dalla scansione.
  const { GET } = await import("./route");
  const body = await (await GET(req())).json();
  expect(body.stale).toBe(0);
  expect(opsAlert).not.toHaveBeenCalled();
});
