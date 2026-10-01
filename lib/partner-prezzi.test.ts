import { it, expect, vi, beforeEach, afterEach } from "vitest";

const dbExecute = vi.fn();
const fetchAllBooks = vi.fn();
vi.mock("./db", () => ({ dbExecute }));
vi.mock("./betconstruct-feed", () => ({ fetchAllBooks }));

const ADESSO = Date.parse("2026-10-01T10:00:00Z");

function partite(n: number) {
  const map = new Map();
  for (let i = 0; i < n; i++) {
    map.set(`m${i}`, {
      teamPairKey: `k${i}`, sport: "tennis", homeName: `A${i}`, awayName: `B${i}`,
      startTime: new Date(ADESSO + 3_600_000).toISOString(),
      oddsHome: 1.8, oddsAway: 2.1, oddsDraw: null,
    });
  }
  return [{ book: { key: "fp" }, map }];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(ADESSO);
  dbExecute.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

it("scrive a blocchi: 250 righe = 3 INSERT multi-riga, non 250", async () => {
  fetchAllBooks.mockResolvedValue(partite(250));
  const { registraPrezziPartner } = await import("./partner-prezzi");
  const esito = await registraPrezziPartner(ADESSO);
  expect(dbExecute).toHaveBeenCalledTimes(3);
  expect(dbExecute.mock.calls[0][1]).toHaveLength(100 * 10);
  expect(esito).toMatchObject({ candidati: 250, scritti: 250, falliti: 0, saltati: 0 });
});

it("scadenza passata a meta': si ferma pulito e conta le righe saltate", async () => {
  fetchAllBooks.mockResolvedValue(partite(250));
  // Il primo blocco "costa" 5 minuti: dopo, la scadenza e' alle spalle.
  dbExecute.mockImplementationOnce(async () => { vi.setSystemTime(ADESSO + 300_000); return []; });
  const { registraPrezziPartner } = await import("./partner-prezzi");
  const esito = await registraPrezziPartner(ADESSO, ADESSO + 60_000);
  expect(dbExecute).toHaveBeenCalledTimes(1);
  expect(esito).toMatchObject({ candidati: 250, scritti: 100, saltati: 150 });
});

it("un blocco che fallisce conta tutte le sue righe, gli altri restano scritti", async () => {
  fetchAllBooks.mockResolvedValue(partite(150));
  dbExecute.mockRejectedValueOnce(new Error("boom"));
  const { registraPrezziPartner } = await import("./partner-prezzi");
  const esito = await registraPrezziPartner(ADESSO);
  expect(esito).toMatchObject({ candidati: 150, falliti: 100, scritti: 50 });
});

it("quote non finite vengono scartate, non rompono il blocco", async () => {
  const books = partite(2);
  [...books[0].map.values()][0].oddsHome = Number.NaN;
  fetchAllBooks.mockResolvedValue(books);
  const { registraPrezziPartner } = await import("./partner-prezzi");
  const esito = await registraPrezziPartner(ADESSO);
  expect(esito).toMatchObject({ candidati: 1, scartati: 1, scritti: 1 });
  expect(dbExecute.mock.calls[0][0]).not.toContain("NaN");
});
