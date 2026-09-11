// #FIXTURES-SILENT-SKIP-0910 — questo file non esisteva. Il difetto che copre e'
// costato 106 righe non ricalcolate su 315 il 10/09, e i big match fermi a ore
// prima senza un allarme: un fallimento della fetch tornava `[]` esattamente
// come «nessuna partita in programma».
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchFixtures, fetchAllTodayMatches } from "./football-data";

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

// #NIGHT-GAP-0911 — la finestra parte da IERI, non da oggi.
describe("la finestra non perde le partite notturne UTC", () => {
  const urlDellaChiamata = async (code: string) => {
    let url = "";
    vi.stubGlobal("fetch", vi.fn(async (u: string | URL | Request) => {
      url = String(u);
      return risposta(200, UNA_PARTITA);
    }));
    await fetchFixtures(code);
    return new URL(url).searchParams;
  };

  it("chiede da IERI: una partita delle 02:30 UTC non esce a mezzanotte", async () => {
    // Il bug: `dateFrom` e' una data UTC, ma le 02:30 UTC sono la sera prima in
    // America. Allo scoccare della mezzanotte la partita usciva dalla finestra
    // e smetteva di essere ricalcolata con ore ancora da giocare. Misurato su
    // 20 giorni: il 90% dei kickoff 00:00-04:59 UTC aveva l'ultimo calcolo
    // prima di quella mezzanotte, contro il 18% delle diurne.
    const p = await urlDellaChiamata("SA");
    const ieri = new Date();
    ieri.setDate(ieri.getDate() - 1);
    expect(p.get("dateFrom")).toBe(ieri.toISOString().slice(0, 10));
  });

  it("l'orizzonte in avanti resta la finestra di pubblicazione", async () => {
    // Allargare all'indietro non deve allargare in avanti: #019 dice che non si
    // pubblica oltre l'orizzonte di servizio.
    const p = await urlDellaChiamata("PL");
    const giorni =
      (Date.parse(p.get("dateTo")!) - Date.parse(p.get("dateFrom")!)) / 86_400_000;
    expect(giorni).toBeGreaterThanOrEqual(11);
    expect(giorni).toBeLessThanOrEqual(12);
  });
});

describe("fetchAllTodayMatches: la finestra live include OGGI (#FD-DATETO-0911)", () => {
  // Su /v4/matches `dateTo` e' escluso dall'API. Con dateTo=oggi la funzione
  // rendeva solo le partite di ieri: misurato l'11/09 alle 20:53 UTC, 6 partite,
  // tutte del 10/09 — e in board 13 partite gia' giocate senza punteggio.
  const parametri = async () => {
    let url = "";
    vi.stubGlobal("fetch", vi.fn(async (u: string | URL | Request) => {
      url = String(u);
      return risposta(200, UNA_PARTITA);
    }));
    await fetchAllTodayMatches();
    return new URL(url);
  };

  it("dateTo e' DOMANI, cosi' l'estremo escluso non taglia le partite di oggi", async () => {
    const p = (await parametri()).searchParams;
    const domani = new Date();
    domani.setDate(domani.getDate() + 1);
    expect(p.get("dateTo")).toBe(domani.toISOString().slice(0, 10));
  });

  it("dateFrom resta IERI: le partite notturne americane non escono a mezzanotte", async () => {
    const p = (await parametri()).searchParams;
    const ieri = new Date();
    ieri.setDate(ieri.getDate() - 1);
    expect(p.get("dateFrom")).toBe(ieri.toISOString().slice(0, 10));
  });

  it("interroga l'endpoint cross-competizione con la lista delle leghe", async () => {
    const u = await parametri();
    expect(u.pathname).toBe("/v4/matches");
    expect(u.searchParams.get("competitions")).toContain("SA");
  });
});
