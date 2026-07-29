import { it, expect, vi, beforeEach } from "vitest";

const getSessionPlan = vi.fn();
const dbExecute = vi.fn();
// #CRYPTO-ADDR-REGISTRY-0729 — non più `vi.fn()` anonimo dentro la factory: il
// gate sull'indirizzo di deposito legge il risultato di questa query, quindi il
// mock deve poter rispondere caso per caso.
const dbQueryStrict = vi.fn();
const promoEligibility = vi.fn();
const convertUsdToCoin = vi.fn();
const coinMinimum = vi.fn();
const createCryptoDeposit = vi.fn();
const hasWeeklyPickStrict = vi.fn();

vi.mock("@/lib/auth", () => ({ getSessionPlan }));
vi.mock("@/lib/db", () => ({ dbExecute, dbQuery: vi.fn(), dbQueryStrict }));
vi.mock("@/lib/creator-promo", () => ({ promoEligibility }));
vi.mock("@/lib/crypto-api", () => ({ convertUsdToCoin, coinMinimum, createCryptoDeposit }));
vi.mock("@/lib/activation", () => ({ siteOrigin: () => "https://www.betredge.com" }));
vi.mock("@/lib/weekly-pick-server", () => ({ hasWeeklyPickStrict }));

function req(body: unknown) {
  return new Request("https://x/api/crypto/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PAYGATE_PAYOUT_WALLET = "0x72e348d948e984c7d57d8ccb93fdd52710e47fa2";
  process.env.CRYPTO_COINS_ENABLED = "polygon-usdc,polygon-usdt";
  delete process.env.LAUNCH_PROMO_ENABLED;
  delete process.env.PAYGATE_TEST_ENABLED;
  process.env.WEEKLY_PICK_ENABLED = "true";
  getSessionPlan.mockResolvedValue({ identifier: "u@t.com", plan: "free", name: null, plan_expires_at: null });
  promoEligibility.mockResolvedValue({ firstPaidOrder: false });
  convertUsdToCoin.mockResolvedValue(15.01);
  coinMinimum.mockResolvedValue(0.665);
  createCryptoDeposit.mockResolvedValue({ addressIn: "0xdeposit", ipnToken: "ipn" });
  hasWeeklyPickStrict.mockResolvedValue(false);
  // Caso normale: l'indirizzo è nuovo, il registro lo accetta e restituisce la
  // riga inserita. I casi di conflitto lo ri-mockano a [].
  dbQueryStrict.mockResolvedValue([{ address: "0xdeposit" }]);
});

it("crea l'ordine con moneta, importo atteso e indirizzo di deposito", async () => {
  const { POST } = await import("./route");
  const res = await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ coin: "polygon-usdc", address: "0xdeposit", amount_coin: 15.01, amount_usd: 14.99 });

  const ins = dbExecute.mock.calls.find((c) => String(c[0]).includes("INSERT INTO paygate_orders"));
  // expected_value_coin e crypto_address_in sono ciò con cui si verificherà il
  // pagamento: se non finiscono in DB, l'ordine non è verificabile.
  expect(ins?.[1]).toEqual([
    expect.any(String), "u@t.com", "base", "monthly", 14.99, expect.any(String), "ipn",
    "polygon-usdc", 15.01, "0xdeposit",
  ]);
});

// Sotto il minimo di rete PayGate non inoltra: l'utente pagherebbe e i fondi
// resterebbero bloccati. Va rifiutato PRIMA di dare un indirizzo.
it("409 se l'importo è sotto il minimo della moneta, senza creare nulla", async () => {
  coinMinimum.mockResolvedValue(13.3); // il minimo di USDT TRC20
  convertUsdToCoin.mockResolvedValue(12.99); // Weekly Pick
  const { POST } = await import("./route");
  const res = await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdt" }));
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ error: "amount below coin minimum", minimum: 13.3 });
  expect(createCryptoDeposit).not.toHaveBeenCalled();
  expect(dbExecute).not.toHaveBeenCalled();
});

it("400 su moneta non abilitata (o inventata)", async () => {
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "trc20-usdt" }))).status).toBe(400);
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "../etc/passwd" }))).status).toBe(400);
});

it("401 senza sessione: l'ordine è legato all'account", async () => {
  getSessionPlan.mockResolvedValue(null);
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }))).status).toBe(401);
});

// Stessa tier-guard del rail carte: rinnovare Pro al prezzo di Base è arbitraggio.
it("409 se un premium attivo tenta di comprare base", async () => {
  getSessionPlan.mockResolvedValue({ identifier: "u@t.com", plan: "premium", name: null, plan_expires_at: null });
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }))).status).toBe(409);
});

it("503 senza wallet di payout: PayGate inoltrerebbe a nessuno", async () => {
  delete process.env.PAYGATE_PAYOUT_WALLET;
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }))).status).toBe(503);
});

// Se non sappiamo quanto far inviare, non si apre un ordine "a occhio".
it("502 se la quote PayGate non risponde", async () => {
  convertUsdToCoin.mockRejectedValue(new Error("timeout"));
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }))).status).toBe(502);
  expect(dbExecute).not.toHaveBeenCalled();
});

it("GET elenca solo le monete abilitate", async () => {
  process.env.CRYPTO_COINS_ENABLED = "polygon-usdc";
  const { GET } = await import("./route");
  const body = await (await GET()).json();
  expect(body.coins).toEqual([{ id: "polygon-usdc", label: "USDC · Polygon" }]);
});

// Porta di prova: pagamento REALE da $5 per validare la catena senza spendere
// 15 o 30 dollari. Stessa porta già presente sul rail carte.
it("piano 'test' con flag ON: ordine da $5 sul percorso reale", async () => {
  process.env.PAYGATE_TEST_ENABLED = "1";
  convertUsdToCoin.mockResolvedValue(5.01);
  const { POST } = await import("./route");
  const res = await POST(req({ requested_plan: "test", period: "monthly", coin: "polygon-usdc" }));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ amount_usd: 5, amount_coin: 5.01 });
  // in DB resta un ordine 'base' normale: il grant a pagamento avvenuto è quello vero
  const ins = dbExecute.mock.calls.find((c) => String(c[0]).includes("INSERT INTO paygate_orders"));
  expect(ins?.[1]?.[2]).toBe("base");
  expect(ins?.[1]?.[4]).toBe(5);
  expect(convertUsdToCoin).toHaveBeenCalledWith(expect.anything(), 5);
});

// Senza la env il piano di prova non esiste: si spegne togliendo la variabile,
// senza deploy.
it("piano 'test' con flag OFF: 400 come qualunque piano sconosciuto", async () => {
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "test", period: "monthly", coin: "polygon-usdc" }))).status).toBe(400);
  expect(dbExecute).not.toHaveBeenCalled();
});

// Il test serve a provare la catena, non a vendere: come sul rail carte bypassa
// la tier-guard, altrimenti da un account premium non si potrebbe provare.
it("il piano di prova bypassa la tier-guard", async () => {
  process.env.PAYGATE_TEST_ENABLED = "1";
  getSessionPlan.mockResolvedValue({ identifier: "u@t.com", plan: "premium", name: null, plan_expires_at: null });
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "test", period: "monthly", coin: "polygon-usdc" }))).status).toBe(200);
});

// ───────── Weekly Pick sullo stesso rail (#WEEKLY-CRYPTO-DIRECT-1) ─────────

it("weekly: ordine in weekly_pick_orders, con settimana e importo del server", async () => {
  convertUsdToCoin.mockResolvedValue(13.01);
  const { POST } = await import("./route");
  const res = await POST(req({ requested_plan: "weekly", coin: "polygon-usdc" }));
  expect(res.status).toBe(200);
  // `kind` serve al client per interrogare lo status nella tabella giusta.
  expect(await res.json()).toMatchObject({ kind: "weekly", amount_usd: 12.99, amount_coin: 13.01 });

  // NON deve finire in paygate_orders: là plan/period sono NOT NULL e la prima
  // passata del reconcile lo concederebbe come abbonamento.
  expect(dbExecute.mock.calls.some((c) => String(c[0]).includes("INSERT INTO paygate_orders"))).toBe(false);
  const ins = dbExecute.mock.calls.find((c) => String(c[0]).includes("INSERT INTO weekly_pick_orders"));
  expect(ins?.[1]).toEqual([
    expect.any(String), "u@t.com", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), 12.99,
    expect.any(String), "ipn", "polygon-usdc", 13.01, "0xdeposit",
  ]);
  // Il prezzo va anche a PayGate: se chiedessimo la quote su un altro importo,
  // l'utente invierebbe una cifra che la verifica poi rifiuta.
  expect(convertUsdToCoin).toHaveBeenCalledWith(expect.anything(), 12.99);
});

// Nessun periodo nel body: la weekly non è un abbonamento. Se la route lo
// pretendesse, il pannello non riuscirebbe mai ad aprire l'ordine.
it("weekly: non richiede period", async () => {
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "weekly", coin: "polygon-usdc" }))).status).toBe(200);
});

it("weekly: 404 col flag spento", async () => {
  process.env.WEEKLY_PICK_ENABLED = "false";
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "weekly", coin: "polygon-usdc" }))).status).toBe(404);
  expect(dbExecute).not.toHaveBeenCalled();
});

// Chi ce l'ha inclusa nel Pro non deve poterla pagare a parte.
it("weekly: 409 se inclusa nel piano attivo", async () => {
  getSessionPlan.mockResolvedValue({ identifier: "u@t.com", plan: "premium", name: null, plan_expires_at: null });
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "weekly", coin: "polygon-usdc" }))).status).toBe(409);
  expect(createCryptoDeposit).not.toHaveBeenCalled();
});

it("weekly: 409 se l'ha già comprata questa settimana", async () => {
  hasWeeklyPickStrict.mockResolvedValue(true);
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "weekly", coin: "polygon-usdc" }))).status).toBe(409);
  expect(dbExecute).not.toHaveBeenCalled();
});

// LA guardia che evita di farla pagare due volte: se la lettura fallisce non
// sappiamo se l'ha già, quindi non si vende (fail-closed, non fail-open).
it("weekly: 500 fail-closed se la lettura DB fallisce", async () => {
  hasWeeklyPickStrict.mockRejectedValue(new Error("db down"));
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "weekly", coin: "polygon-usdc" }))).status).toBe(500);
  expect(createCryptoDeposit).not.toHaveBeenCalled();
});

// ───────── Registro indirizzi di deposito (#CRYPTO-ADDR-REGISTRY-0729) ─────────
//
// `checkIncoming` somma TUTTI i trasferimenti confermati verso un indirizzo e
// nessuna transazione è legata a un ordine: un indirizzo riusato è un pagamento
// che ne salda due. Il registro è l'unico punto in cui l'unicità vale anche fra
// `paygate_orders` e `weekly_pick_orders`, che hanno claim atomici separati.

it("registra l'indirizzo PRIMA di creare l'ordine, con la chiave in minuscolo", async () => {
  createCryptoDeposit.mockResolvedValue({ addressIn: "0xAbCdEf", ipnToken: "ipn" });
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }))).status).toBe(200);

  const reg = dbQueryStrict.mock.calls.find((c) => String(c[0]).includes("crypto_deposit_addresses"));
  expect(reg, "il checkout deve passare dal registro").toBeTruthy();
  // Gli explorer EVM restituiscono lo stesso indirizzo in checksum-case o tutto
  // minuscolo: senza normalizzare, due grafie dello stesso posto passerebbero
  // entrambe il vincolo.
  expect(reg?.[1]?.[0]).toBe("0xabcdef");
  expect(reg?.[1]?.[2]).toBe("plan");
  // ON CONFLICT DO NOTHING + RETURNING = gate atomico, non SELECT-poi-INSERT.
  expect(String(reg?.[0])).toMatch(/ON CONFLICT \(address\) DO NOTHING/);
  expect(String(reg?.[0])).toMatch(/RETURNING address/);
});

it("weekly: il registro riceve order_kind 'weekly' — è l'altra metà del vincolo", async () => {
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "weekly", coin: "polygon-usdc" }))).status).toBe(200);
  const reg = dbQueryStrict.mock.calls.find((c) => String(c[0]).includes("crypto_deposit_addresses"));
  expect(reg?.[1]?.[2]).toBe("weekly");
});

// Il caso che la UNIQUE parziale "solo pending" NON copre: l'indirizzo è già
// stato usato (anche da un ordine ormai pagato e chiuso). Senza gate, il nuovo
// ordine nascerebbe saldato dalla transazione vecchia.
it("409 e NESSUN ordine creato se l'indirizzo è già registrato", async () => {
  dbQueryStrict.mockResolvedValue([]); // ON CONFLICT ha scartato l'INSERT
  const { POST } = await import("./route");
  const res = await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }));
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ error: "deposit address unavailable" });
  expect(dbExecute).not.toHaveBeenCalled();
});

it("409 anche sul rail weekly: nessun ordine su un indirizzo già preso", async () => {
  dbQueryStrict.mockResolvedValue([]);
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "weekly", coin: "polygon-usdc" }))).status).toBe(409);
  expect(dbExecute).not.toHaveBeenCalled();
});

// Fail-closed: se il registro non risponde non sappiamo se l'indirizzo è libero.
// Fallire una vendita è recuperabile, concedere due volte lo stesso pagamento no.
it("500 fail-closed se il registro non è raggiungibile, senza creare l'ordine", async () => {
  dbQueryStrict.mockRejectedValue(new Error("db down"));
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }))).status).toBe(500);
  expect(dbExecute).not.toHaveBeenCalled();
});
