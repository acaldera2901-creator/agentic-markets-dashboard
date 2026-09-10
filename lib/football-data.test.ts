// #FIXTURES-SILENT-SKIP-0910 — questo file non esisteva. Il difetto che copre e'
// costato 106 righe non ricalcolate su 315 il 10/09, e i big match fermi a ore
// prima senza un allarme: un fallimento della fetch tornava `[]` esattamente
// come «nessuna partita in programma».
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchFixtures } from "./football-data";

const UNA_PARTITA = {
  matches: [
    {
      id: 1,
      utcDate: "2026-09-11T18:45:00Z",
      homeTeam: { name: "Venezia FC" },
      awayTeam: { name: "ACF Fiorentina" },
      status: "TIMED",
      score: { fullTime: { home: null, away: null } },
    },
  ],
};

const risposta = (stato: number, corpo: unknown = {}) =>
  ({ ok: stato >= 200 && stato < 300, status: stato, json: async () => corpo }) as Response;

let avvisi: string[];

beforeEach(() => {
  process.env.FOOTBALL_DATA_ORG_API_KEY = "chiave-di-test";
  process.env.FD_RETRY_MS = "0"; // niente attesa vera nei test
  avvisi = [];
  vi.spyOn(console, "warn").mockImplementation((m) => { avvisi.push(String(m)); });
  vi.spyOn(console, "log").mockImplementation((m) => { avvisi.push(String(m)); });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.FD_RETRY_MS;
});

describe("il 429 e' transitorio: si ritenta", () => {
  it("un 429 seguito da 200 restituisce le partite", async () => {
    const fetchFinto = vi.fn()
      .mockResolvedValueOnce(risposta(429))
      .mockResolvedValueOnce(risposta(200, UNA_PARTITA));
    vi.stubGlobal("fetch", fetchFinto);

    const partite = await fetchFixtures("SA");
    expect(fetchFinto).toHaveBeenCalledTimes(2);
    expect(partite.length).toBe(1);
    expect(partite[0].homeTeam).toBe("Venezia FC");
    expect(avvisi.some((a) => a.includes("429"))).toBe(true);
  });

  it("due 429 di fila: array vuoto MA il fallimento e' dichiarato", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(risposta(429)));
    const partite = await fetchFixtures("BL1");
    expect(partite).toEqual([]);
    // il punto del difetto: non si torna vuoti IN SILENZIO
    expect(avvisi.some((a) => a.includes("SALTATA"))).toBe(true);
  });
});

describe("un errore non si confonde piu' con un calendario vuoto", () => {
  it("HTTP 200 con zero partite: nessun avviso di lega saltata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(risposta(200, { matches: [] })));
    const partite = await fetchFixtures("DED");
    expect(partite).toEqual([]);
    expect(avvisi.some((a) => a.includes("SALTATA"))).toBe(false);
    expect(avvisi.some((a) => a.includes("0 partite"))).toBe(true);
  });

  it("HTTP 403 (chiave/piano): lega saltata e dichiarata, senza ritentativo", async () => {
    const fetchFinto = vi.fn().mockResolvedValue(risposta(403));
    vi.stubGlobal("fetch", fetchFinto);
    const partite = await fetchFixtures("PD");
    expect(partite).toEqual([]);
    expect(fetchFinto).toHaveBeenCalledTimes(1); // solo il 429 si ritenta
    expect(avvisi.some((a) => a.includes("403") && a.includes("SALTATA"))).toBe(true);
  });

  it("errore di rete: dichiarato, non silenzioso", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const partite = await fetchFixtures("FL1");
    expect(partite).toEqual([]);
    expect(avvisi.some((a) => a.includes("errore di rete") && a.includes("SALTATA"))).toBe(true);
  });
});

describe("senza chiave non si chiama nessuno", () => {
  it("torna vuoto senza toccare la rete", async () => {
    delete process.env.FOOTBALL_DATA_ORG_API_KEY;
    const fetchFinto = vi.fn();
    vi.stubGlobal("fetch", fetchFinto);
    expect(await fetchFixtures("SA")).toEqual([]);
    expect(fetchFinto).not.toHaveBeenCalled();
  });
});
