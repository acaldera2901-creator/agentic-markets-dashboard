// lib/ancora-prezzi.test.ts — #ANCORA-CHIUSURA-0917
//
// Il pezzo che va provato rompendolo non e' la scrittura: e' la DISCIPLINA DI
// COSTO. Questo giro parte ogni 10 minuti; se chiama l'Odds API quando non
// serve, o una volta per partita invece che per lega, il costo si moltiplica in
// silenzio e nessuno se ne accorge finche' la quota non finisce.
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock e' issato in cima al file: i doppi vanno creati con vi.hoisted,
// altrimenti la factory li legge prima che esistano.
const { quoteFinte, dbFinto } = vi.hoisted(() => ({
  quoteFinte: vi.fn(),
  dbFinto: vi.fn(),
}));

vi.mock("@/lib/odds-api", async (originale) => {
  const vero = await originale<typeof import("./odds-api")>();
  return { ...vero, fetchOdds: quoteFinte };
});
vi.mock("@/lib/db", () => ({ dbQuery: dbFinto }));

import { registraPrezzoAncora, FINESTRA_MIN } from "./ancora-prezzi";

const ADESSO = Date.parse("2026-09-17T12:00:00Z");
const FRA_30 = new Date(ADESSO + 30 * 60_000).toISOString();

const partita = (over: Partial<Record<string, string>> = {}) => ({
  league: "PD",
  home_team: "Real Betis Balompié",
  away_team: "Getafe CF",
  starts_at: FRA_30,
  ...over,
});

const quota = (over = {}) => ({
  homeNorm: "real betis balompie",
  awayNorm: "getafe",
  oddsHome: 1.9, oddsDraw: 3.4, oddsAway: 4.2,
  bookmaker: "pinnacle", margin: 0.021, extra: {},
  ...over,
});

beforeEach(() => {
  quoteFinte.mockReset();
  dbFinto.mockReset();
});

/** dbQuery serve sia per la SELECT delle partite sia per gli INSERT. */
function conPartite(partite: unknown[]) {
  let primo = true;
  dbFinto.mockImplementation(async () => {
    if (primo) { primo = false; return partite; }
    return [];
  });
}

describe("disciplina di costo", () => {
  it("nessuna partita imminente: NON chiama l'Odds API", async () => {
    conPartite([]);
    const esito = await registraPrezzoAncora(ADESSO);
    expect(quoteFinte).not.toHaveBeenCalled();
    expect(esito.chiamateOddsApi).toBe(0);
    expect(esito.scritte).toBe(0);
  });

  it("due partite della STESSA lega costano una sola chiamata", async () => {
    conPartite([
      partita(),
      partita({ home_team: "Málaga CF", away_team: "Villarreal CF" }),
    ]);
    quoteFinte.mockResolvedValue([quota()]);
    const esito = await registraPrezzoAncora(ADESSO);
    expect(quoteFinte).toHaveBeenCalledTimes(1);
    expect(esito.legheInterrogate).toBe(1);
  });

  it("una lega senza chiave Odds API non viene interrogata", async () => {
    conPartite([partita({ league: "LEGA-CHE-NON-ESISTE" })]);
    const esito = await registraPrezzoAncora(ADESSO);
    expect(quoteFinte).not.toHaveBeenCalled();
    expect(esito.legheInterrogate).toBe(0);
  });

  it("la finestra dichiarata e' quella usata nella query", async () => {
    conPartite([]);
    await registraPrezzoAncora(ADESSO);
    const [, parametri] = dbFinto.mock.calls[0];
    const da = Date.parse(parametri[0]);
    const a = Date.parse(parametri[1]);
    expect(Math.round((a - da) / 60_000)).toBe(FINESTRA_MIN);
  });
});

describe("abbinamento e riga scritta", () => {
  it("scrive la riga con chiave, minuti al via e book", async () => {
    conPartite([partita()]);
    quoteFinte.mockResolvedValue([quota()]);
    const esito = await registraPrezzoAncora(ADESSO);

    expect(esito.abbinate).toBe(1);
    expect(esito.scritte).toBe(1);
    const insert = dbFinto.mock.calls.find(([sql]) =>
      String(sql).includes("anchor_price_history")
    );
    expect(insert).toBeTruthy();
    const p = insert![1] as unknown[];
    expect(p[0]).toBe("2026-09-17:getafe|real betis balompie"); // ordinata
    expect(p[4]).toBe("pinnacle");
    expect(p[11]).toBe(30); // minuti al via (12 parametri, indici 0-11)
  });

  it("abbina anche se il book inverte casa e ospite", async () => {
    conPartite([partita()]);
    quoteFinte.mockResolvedValue([
      quota({ homeNorm: "getafe", awayNorm: "real betis balompie" }),
    ]);
    const esito = await registraPrezzoAncora(ADESSO);
    expect(esito.abbinate).toBe(1);
  });

  it("una partita che il book non ha non produce righe inventate", async () => {
    conPartite([partita()]);
    quoteFinte.mockResolvedValue([
      quota({ homeNorm: "altra squadra", awayNorm: "un'altra ancora" }),
    ]);
    const esito = await registraPrezzoAncora(ADESSO);
    expect(esito.abbinate).toBe(0);
    expect(esito.scritte).toBe(0);
  });

  it("un INSERT che fallisce e' contato, non nascosto", async () => {
    let chiamata = 0;
    dbFinto.mockImplementation(async () => {
      chiamata += 1;
      if (chiamata === 1) return [partita()];
      throw new Error("DB giu'");
    });
    quoteFinte.mockResolvedValue([quota()]);
    const esito = await registraPrezzoAncora(ADESSO);
    expect(esito.fallite).toBe(1);
    expect(esito.scritte).toBe(0);
  });

  it("l'Odds API che esplode non fa cadere il giro", async () => {
    conPartite([partita()]);
    quoteFinte.mockRejectedValue(new Error("502"));
    const esito = await registraPrezzoAncora(ADESSO);
    expect(esito.scritte).toBe(0);
    expect(esito.partiteImminenti).toBe(1);
  });

  it("la SELECT che esplode non fa cadere il giro", async () => {
    dbFinto.mockRejectedValue(new Error("timeout"));
    const esito = await registraPrezzoAncora(ADESSO);
    expect(esito).toMatchObject({ partiteImminenti: 0, scritte: 0 });
  });
});
