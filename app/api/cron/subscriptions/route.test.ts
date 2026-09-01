import { it, expect, vi, beforeEach } from "vitest";

// #RENEWAL-SILENCE-0822 — un abbonamento che non si rinnova era muto: nessun
// webhook arriva, quindi niente si "rompe", e questo cron declassava a free in
// silenzio. Questi test tengono in piedi la distinzione che conta: chi PAGAVA
// genera un avviso, chi aveva una concessione gratuita no (altrimenti l'avviso
// diventa rumore e nessuno lo legge).

const dbQuery = vi.fn();
const dbExecute = vi.fn();
const opsAlert = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery, dbExecute, dbQueryStrict: vi.fn() }));
vi.mock("@/lib/ops-alert", () => ({ opsAlert }));
// Il mock guarda l'HEADER, non solo il secret: altrimenti il test del 401
// passerebbe per finta.
vi.mock("@/lib/admin-auth", () => ({
  verifyBearer: (r: Request, s?: string) => Boolean(s) && r.headers.get("authorization") === `Bearer ${s}`,
}));

function req() {
  return new Request("https://x/api/cron/subscriptions", {
    headers: { authorization: "Bearer sekret" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "sekret";
  dbQuery.mockResolvedValue([]);
  dbExecute.mockResolvedValue(undefined);
});

it("401 senza cron secret", async () => {
  const { GET } = await import("./route");
  const res = await GET(new Request("https://x/api/cron/subscriptions"));
  expect(res.status).toBe(401);
  expect(dbExecute).not.toHaveBeenCalled();
});

it("avvisa quando scade un abbonamento PAGANTE senza rinnovo", async () => {
  dbQuery.mockResolvedValue([
    { identifier: "cliente@example.com", plan: "premium", plan_source: "shopify" },
  ]);
  const { GET } = await import("./route");
  const res = await GET(req());
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, downgraded: 1 });
  expect(opsAlert).toHaveBeenCalledTimes(1);
  const [sorgente, messaggi] = opsAlert.mock.calls[0];
  expect(sorgente).toBe("abbonamento-scaduto");
  expect(messaggi[0]).toContain("cliente@example.com");
  expect(messaggi[0]).toContain("shopify");
});

it("avvisa anche per paygate, paypal e shopify_oneoff", async () => {
  dbQuery.mockResolvedValue([
    { identifier: "a@x.com", plan: "premium", plan_source: "paygate" },
    { identifier: "b@x.com", plan: "base", plan_source: "paypal" },
    { identifier: "c@x.com", plan: "premium", plan_source: "shopify_oneoff" },
  ]);
  const { GET } = await import("./route");
  await GET(req());
  expect(opsAlert).toHaveBeenCalledTimes(1);
  expect(opsAlert.mock.calls[0][1]).toHaveLength(3);
});

it("NON avvisa per le concessioni gratuite: scadono per disegno", async () => {
  dbQuery.mockResolvedValue([
    { identifier: "omaggio@x.com", plan: "premium", plan_source: "manual" },
    { identifier: "invitato@x.com", plan: "premium", plan_source: "referral" },
    { identifier: "senza@x.com", plan: "base", plan_source: null },
  ]);
  const { GET } = await import("./route");
  const res = await GET(req());
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ downgraded: 3 }); // declassati comunque
  expect(opsAlert).not.toHaveBeenCalled();
});

it("il declassamento resta l'effetto autorevole, anche senza nessuno scaduto", async () => {
  dbQuery.mockResolvedValue([]);
  const { GET } = await import("./route");
  await GET(req());
  expect(dbExecute).toHaveBeenCalledTimes(1);
  expect(opsAlert).not.toHaveBeenCalled();
});
