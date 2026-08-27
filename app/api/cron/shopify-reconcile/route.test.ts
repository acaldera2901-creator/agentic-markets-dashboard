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

// ── Watchdog decadimenti (#SHOPIFY-LAPSE-WATCHDOG-0827) ─────────────────────
// Il caso reale del 27/08: il primo cliente carta paga il 25/07, il grant scade
// il 24/08, nessun rinnovo arriva, il profilo torna `free` e nessuno se ne
// accorge. Le due scansioni sopra non potevano vederlo: guardano pagamenti che
// NON hanno ancora concesso, qui il pagamento era andato a buon fine.
it("segnala un abbonamento carta scaduto senza rinnovo", async () => {
  dbQuery
    .mockResolvedValueOnce([]) // unresolved
    .mockResolvedValueOnce([]) // stale
    .mockResolvedValueOnce([{ identifier: "j@t.com", expired_at: "2026-08-24T19:28:57Z", amount: "14.99" }]);
  const { GET } = await import("./route");
  const body = await (await GET(req())).json();

  expect(body.lapsed).toBe(1);
  // Detection-only: non si ri-concede e non si tocca il piano dell'utente.
  expect(activateShopifyPlan).not.toHaveBeenCalled();
  const alert = vi.mocked(opsAlert).mock.calls[0];
  expect(alert[0]).toBe("shopify-reconcile");
  expect(String(alert[1])).toContain("j@t.com");
  expect(String(alert[1])).toContain("2026-08-24T19:28:57Z");
});

// Il cron gira ogni 10 minuti: senza marcatore lo stesso decadimento
// allerterebbe 144 volte al giorno e l'alert diventerebbe rumore da ignorare.
it("marca il decadimento su last_error, e NON declassa lo status", async () => {
  dbQuery
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ identifier: "j@t.com", expired_at: "2026-08-24T19:28:57Z", amount: null }]);
  const { GET } = await import("./route");
  await GET(req());

  const upd = vi.mocked(dbExecute).mock.calls.find((c) => /lapse-alerted/.test(String(c[0])));
  expect(upd).toBeTruthy();
  expect(upd![1]).toEqual(["j@t.com"]);
  // `status` deve restare 'granted': appena entra #REFERRAL-SHOPIFY-RAIL-0827
  // quello è il rail carta di countPayingInvitees (lib/referral-rewards.ts), e
  // declassarlo qui cancellerebbe in silenzio i premi referral dell'invitante.
  // Solo la clausola SET, non tutta la query: la WHERE contiene legittimamente
  // `status = 'granted'` come filtro.
  const setClause = String(upd![0]).split(/\bWHERE\b/)[0];
  expect(setClause).toMatch(/last_error\s*=/);
  expect(setClause).not.toMatch(/status\s*=/);
  // La stessa UPDATE esclude le righe già marcate: idempotente per definizione.
  expect(String(upd![0])).toMatch(/NOT LIKE 'lapse-alerted%'/);
  // Marca TUTTE le righe granted dell'utente, non solo quella selezionata: chi
  // ha già rinnovato ne ha più di una e una riga senza marcatore riallerterebbe.
  expect(String(upd![0])).toMatch(/WHERE identifier = \$1/);
});

it("un decadimento già marcato non ri-allerta (la query lo esclude)", async () => {
  const { GET } = await import("./route");
  const body = await (await GET(req())).json();
  expect(body.lapsed).toBe(0);
  expect(opsAlert).not.toHaveBeenCalled();
});

// Shopify può fatturare il rinnovo con qualche ora di ritardo: un allarme che
// urla su un rinnovo lento verrebbe ignorato, e allora tanto vale non averlo.
it("la query concede una grace prima di allertare e guarda solo il rail carta", async () => {
  dbQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  const { GET } = await import("./route");
  await GET(req());
  const sql = String(vi.mocked(dbQuery).mock.calls[2][0]);
  expect(sql).toMatch(/plan_expires_at < NOW\(\) - INTERVAL '6 hours'/);
  expect(sql).toMatch(/plan_source = 'shopify'/);
  // Solo pagamenti andati a buon fine: 'pending'/'unresolved'/'stale' sono
  // gli altri due rami, non decadimenti.
  expect(sql).toMatch(/e\.status = 'granted'/);
});
