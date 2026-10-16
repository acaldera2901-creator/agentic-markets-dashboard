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

// Registro indirizzi in memoria: PRIMARY KEY su address, ON CONFLICT DO NOTHING.
type RegRow = { order_id: string; order_kind: string; coin: string | null; created_at: string };
const registry = new Map<string, RegRow>();
async function fakeExecute(sql: string, params: unknown[] = []): Promise<unknown[]> {
  if (sql.includes("INSERT INTO crypto_deposit_addresses")) {
    const [address, order_id, order_kind, coin] = params as string[];
    if (!registry.has(address)) registry.set(address, { order_id, order_kind, coin, created_at: "now" });
  }
  return []; // exec_sql: nessuna riga da una scrittura, RETURNING compreso
}
async function fakeQueryStrict(sql: string, params: unknown[] = []): Promise<unknown[]> {
  if (/^\s*INSERT|UPDATE|DELETE/i.test(sql)) return fakeExecute(sql, params);
  if (sql.includes("FROM crypto_deposit_addresses")) {
    const row = registry.get(String(params[0]));
    return row ? [row] : [];
  }
  return [];
}

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
  // #CRYPTO-409-1016: DB finto con la semantica REALE della RPC exec_sql — le
  // scritture non restituiscono MAI righe, nemmeno con RETURNING. Il vecchio mock
  // `[{ address }]` simulava un RETURNING che in produzione non esiste, e così
  // nascondeva il bug che mandava in 409 ogni checkout crypto.
  registry.clear();
  dbExecute.mockImplementation(fakeExecute);
  dbQueryStrict.mockImplementation(fakeQueryStrict);
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

  const calls = dbExecute.mock.calls.map((c) => String(c[0]));
  const regIdx = calls.findIndex((q) => q.includes("INSERT INTO crypto_deposit_addresses"));
  const ordIdx = calls.findIndex((q) => q.includes("INSERT INTO paygate_orders"));
  expect(regIdx, "il checkout deve passare dal registro").toBeGreaterThanOrEqual(0);
  expect(regIdx).toBeLessThan(ordIdx);
  const reg = dbExecute.mock.calls[regIdx];
  // Gli explorer EVM restituiscono lo stesso indirizzo in checksum-case o tutto
  // minuscolo: senza normalizzare, due grafie dello stesso posto passerebbero
  // entrambe il vincolo.
  expect(reg[1][0]).toBe("0xabcdef");
  expect(reg[1][2]).toBe("plan");
  expect(String(reg[0])).toMatch(/ON CONFLICT \(address\) DO NOTHING/);
  // exec_sql non restituisce RETURNING: affidarcisi è il bug #CRYPTO-409-1016.
  expect(String(reg[0])).not.toMatch(/RETURNING/);
});

it("weekly: il registro riceve order_kind 'weekly' — è l'altra metà del vincolo", async () => {
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "weekly", coin: "polygon-usdc" }))).status).toBe(200);
  const reg = dbExecute.mock.calls.find((c) => String(c[0]).includes("INSERT INTO crypto_deposit_addresses"));
  expect(reg?.[1]?.[2]).toBe("weekly");
});

const orderInserts = () =>
  dbExecute.mock.calls.filter((c) => /INSERT INTO (paygate_orders|weekly_pick_orders)/.test(String(c[0])));

// #CRYPTO-409-1016 — il caso che in produzione falliva SEMPRE: indirizzo nuovo,
// l'INSERT passa ma (come exec_sql reale) non restituisce righe.
it("caso felice con la semantica reale di exec_sql: INSERT [] + SELECT proprio ordine → 200", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const { POST } = await import("./route");
  const res = await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(registry.get("0xdeposit")?.order_id).toBe(body.order);
  expect(orderInserts()).toHaveLength(1);
  expect(log.mock.calls.map((c) => String(c[0])).find((s) => s.includes("[crypto/checkout] OK"))).toContain("address=0xdeposit");
  log.mockRestore();
});

// Il caso che la UNIQUE parziale "solo pending" NON copre: l'indirizzo è già
// stato usato (anche da un ordine ormai pagato e chiuso). Senza gate, il nuovo
// ordine nascerebbe saldato dalla transazione vecchia.
it("409 e NESSUN ordine creato se l'indirizzo è di un altro ordine; il log dice moneta e proprietario", async () => {
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  registry.set("0xdeposit", { order_id: "old-order", order_kind: "plan", coin: "polygon-usdc", created_at: "2026-07-29" });
  const { POST } = await import("./route");
  const res = await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }));
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ error: "deposit address unavailable" });
  expect(orderInserts()).toHaveLength(0);
  expect(registry.get("0xdeposit")?.order_id).toBe("old-order"); // il registro non si sovrascrive
  const line = err.mock.calls.map((c) => String(c[0])).find((s) => s.includes("GIÀ REGISTRATO"));
  expect(line).toContain("coin=polygon-usdc");
  expect(line).toContain("proprietario order=old-order kind=plan");
  err.mockRestore();
});

it("409 anche sul rail weekly: nessun ordine su un indirizzo già preso", async () => {
  registry.set("0xdeposit", { order_id: "old-order", order_kind: "plan", coin: "polygon-usdc", created_at: "x" });
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "weekly", coin: "polygon-usdc" }))).status).toBe(409);
  expect(orderInserts()).toHaveLength(0);
});

it("409 se il proprietario non è leggibile (riga assente dopo l'INSERT)", async () => {
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  dbQueryStrict.mockResolvedValue([]);
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }))).status).toBe(409);
  expect(orderInserts()).toHaveLength(0);
  expect(err.mock.calls.map((c) => String(c[0])).join("\n")).toContain("proprietario non leggibile");
  err.mockRestore();
});

// Fail-closed: se il registro non risponde non sappiamo se l'indirizzo è libero.
// Fallire una vendita è recuperabile, concedere due volte lo stesso pagamento no.
it("500 fail-closed se l'INSERT nel registro fallisce, senza creare l'ordine", async () => {
  dbExecute.mockRejectedValue(new Error("db down"));
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }))).status).toBe(500);
  // L'unica scrittura tentata è l'INSERT del registro, rifiutata: nessun ordine.
  expect(dbExecute).toHaveBeenCalledTimes(1);
  expect(orderInserts()).toHaveLength(0);
});

it("500 fail-closed se la rilettura del proprietario fallisce, senza creare l'ordine", async () => {
  dbQueryStrict.mockRejectedValue(new Error("db down"));
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }))).status).toBe(500);
  expect(orderInserts()).toHaveLength(0);
});

it("due checkout concorrenti sullo stesso indirizzo: ne passa uno solo", async () => {
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  const { POST } = await import("./route");
  const [a, b] = await Promise.all([
    POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" })),
    POST(req({ requested_plan: "premium", period: "monthly", coin: "polygon-usdc" })),
  ]);
  expect([a.status, b.status].sort()).toEqual([200, 409]);
  expect(orderInserts()).toHaveLength(1);
  const winner = (await (a.status === 200 ? a : b).json()).order;
  expect(registry.get("0xdeposit")?.order_id).toBe(winner);
  err.mockRestore();
});
