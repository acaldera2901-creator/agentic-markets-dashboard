import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionPlan = vi.fn();
const dbQueryStrict = vi.fn();
const promoEligibility = vi.fn();
const hasWeeklyPick = vi.fn();
vi.mock("@/lib/auth", () => ({ getSessionPlan }));
vi.mock("@/lib/db", () => ({ dbQuery: vi.fn(), dbQueryStrict, dbExecute: vi.fn() }));
vi.mock("@/lib/creator-promo", () => ({ promoEligibility }));
vi.mock("@/lib/weekly-pick-server", () => ({ hasWeeklyPick }));

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://x/api/shopify/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHOPIFY_SHOP_DOMAIN = "gvfgra-sp.myshopify.com";
  process.env.SHOPIFY_VARIANT_BASE = "54401918337361";
  process.env.SHOPIFY_VARIANT_PREMIUM = "54401929904465";
  process.env.SHOPIFY_VARIANT_WEEKLY = "54404245815633";
  delete process.env.SHOPIFY_VARIANT_BASE_ANNUAL;
  delete process.env.SHOPIFY_VARIANT_PREMIUM_ANNUAL;
  delete process.env.SHOPIFY_SELLING_PLAN_ANNUAL;
  delete process.env.SHOPIFY_SELLING_PLAN_BASE;
  delete process.env.SHOPIFY_SELLING_PLAN_PREMIUM;
  delete process.env.LAUNCH_PROMO_ENABLED;
  delete process.env.LAUNCH_PROMO_DEADLINE;
  process.env.WEEKLY_PICK_ENABLED = "true";
  promoEligibility.mockResolvedValue({ firstPaidOrder: false });
  hasWeeklyPick.mockResolvedValue(false);
  getSessionPlan.mockResolvedValue({
    identifier: "u@t.com",
    plan: "free",
    name: null,
    plan_expires_at: null,
  });
  dbQueryStrict.mockResolvedValue([{ plan_source: null }]);
});

it("401 senza sessione", async () => {
  getSessionPlan.mockResolvedValue(null);
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly" }))).status).toBe(401);
});

it("400 su requested_plan non valido", async () => {
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "gold", period: "monthly" }))).status).toBe(400);
});

it("ritorna l'URL con variant, email e identifier dalla sessione", async () => {
  const { POST } = await import("./route");
  const res = await POST(req({ requested_plan: "premium", period: "monthly" }));
  expect(res.status).toBe(200);
  const { url } = (await res.json()) as { url: string };
  expect(url).toContain("https://gvfgra-sp.myshopify.com/cart/clear?");
  const inner = new URLSearchParams(
    new URL(url).searchParams.get("return_to")!.split("?")[1]
  );
  expect(inner.get("id")).toBe("54401929904465");
  expect(inner.get("attributes[identifier]")).toBe("u@t.com");
  expect(inner.get("return_to")).toContain("checkout%5Bemail%5D=u%40t.com");
});

it("503 se lo store non è configurato → il client resta su PayGate", async () => {
  delete process.env.SHOPIFY_SHOP_DOMAIN;
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly" }))).status).toBe(503);
});

it("annuale: usa il prodotto annuale, non quello mensile", async () => {
  process.env.SHOPIFY_VARIANT_BASE_ANNUAL = "99001";
  process.env.SHOPIFY_SELLING_PLAN_ANNUAL = "99002";
  const { POST } = await import("./route");
  const res = await POST(req({ requested_plan: "base", period: "annual" }));
  expect(res.status).toBe(200);
  const { url } = (await res.json()) as { url: string };
  const inner = new URLSearchParams(new URL(url).searchParams.get("return_to")!.split("?")[1]);
  expect(inner.get("id")).toBe("99001");
  expect(inner.get("selling_plan")).toBe("99002");
});

it("503 sull'annuale se i prodotti annuali non sono configurati → fallback PayGate", async () => {
  delete process.env.SHOPIFY_VARIANT_BASE_ANNUAL;
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "annual" }))).status).toBe(503);
});

it("400 su periodo non valido", async () => {
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "weekly" }))).status).toBe(400);
});

it("409 per l'abbonato PayGate ancora attivo (grandfather)", async () => {
  dbQueryStrict.mockResolvedValue([{ plan_source: "paygate" }]);
  getSessionPlan.mockResolvedValue({
    identifier: "u@t.com",
    plan: "base",
    name: null,
    plan_expires_at: new Date(Date.now() + 10 * 86400_000).toISOString(),
  });
  const { POST } = await import("./route");
  const res = await POST(req({ requested_plan: "premium", period: "monthly" }));
  expect(res.status).toBe(409);
});

it("consente l'upgrade a chi ha un piano PayGate già scaduto", async () => {
  dbQueryStrict.mockResolvedValue([{ plan_source: "paygate" }]);
  getSessionPlan.mockResolvedValue({
    identifier: "u@t.com",
    plan: "free",
    name: null,
    plan_expires_at: new Date(Date.now() - 86400_000).toISOString(),
  });
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly" }))).status).toBe(200);
});

it("409 tier-guard: premium attivo non può comprare base", async () => {
  getSessionPlan.mockResolvedValue({
    identifier: "u@t.com",
    plan: "premium",
    name: null,
    plan_expires_at: new Date(Date.now() + 10 * 86400_000).toISOString(),
  });
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly" }))).status).toBe(409);
});

it("500 fail-closed se la lettura di plan_source fallisce (mai un pagamento orfano)", async () => {
  dbQueryStrict.mockRejectedValue(new Error("db down"));
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly" }))).status).toBe(500);
});

it("503 sui piani quando la promo di lancio sconta l'ordine (prezzo Shopify fisso)", async () => {
  process.env.LAUNCH_PROMO_ENABLED = "true";
  process.env.LAUNCH_PROMO_DEADLINE = new Date(Date.now() + 86400_000).toISOString();
  promoEligibility.mockResolvedValue({ firstPaidOrder: true });
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly" }))).status).toBe(503);
});

it("weekly: acquisto one-off, senza selling_plan", async () => {
  process.env.SHOPIFY_SELLING_PLAN_BASE = "999";
  const { POST } = await import("./route");
  const res = await POST(req({ requested_plan: "weekly" }));
  expect(res.status).toBe(200);
  const { url } = (await res.json()) as { url: string };
  const inner = new URLSearchParams(
    new URL(url).searchParams.get("return_to")!.split("?")[1]
  );
  expect(inner.get("id")).toBe("54404245815633");
  expect(inner.get("selling_plan")).toBe(null);
});

it("weekly: 404 col flag WEEKLY_PICK_ENABLED spento", async () => {
  process.env.WEEKLY_PICK_ENABLED = "false";
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "weekly" }))).status).toBe(404);
});

it("weekly: 409 se è già inclusa nel piano premium", async () => {
  getSessionPlan.mockResolvedValue({
    identifier: "u@t.com",
    plan: "premium",
    name: null,
    plan_expires_at: new Date(Date.now() + 10 * 86400_000).toISOString(),
  });
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "weekly" }))).status).toBe(409);
});

it("weekly: 409 se l'ha già comprata questa settimana", async () => {
  hasWeeklyPick.mockResolvedValue(true);
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "weekly" }))).status).toBe(409);
});

it("weekly: 500 fail-closed se non riusciamo a sapere se l'ha già comprata", async () => {
  hasWeeklyPick.mockRejectedValue(new Error("db down"));
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "weekly" }))).status).toBe(500);
});

it("weekly: 503 con promo di lancio attiva (prezzo Shopify fisso a 12.99)", async () => {
  process.env.LAUNCH_PROMO_ENABLED = "true";
  process.env.LAUNCH_PROMO_DEADLINE = new Date(Date.now() + 86400_000).toISOString();
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "weekly" }))).status).toBe(503);
});

it("403 su richiesta cross-site", async () => {
  const { POST } = await import("./route");
  const res = await POST(
    req({ requested_plan: "base", period: "monthly" }, { "sec-fetch-site": "cross-site" })
  );
  expect(res.status).toBe(403);
});
