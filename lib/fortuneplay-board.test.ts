// #YBETS-COVERAGE-0916 — mergeBooksToResponse copre l'UNIONE dei book, non il
// solo primario.
//
// Prima, una partita quotata dal solo secondario non generava alcuna entry: la
// card restava "solo modello" pur avendo il prezzo in casa. Misurato sui feed
// vivi il 16/09: 827 partite in comune, 14 solo FortunePlay, 22 solo YBets
// (21 di calcio, fra cui Brighton–Manchester United).
//
// Il secondo presidio è su `detailBook`: gli id BetConstruct sono PER-OPERATORE
// (verificato sui due feed: 0 id in comune su 50+50, mentre 14 slug coincidevano
// con id diversi). Senza sapere di chi è l'id, la scheda chiederebbe i mercati
// di quella partita al feed sbagliato e ne mostrerebbe un'ALTRA.
import { describe, it, expect } from "vitest";
import { mergeBooksToResponse } from "@/lib/fortuneplay-board";
import { bookByKey } from "@/lib/betconstruct-books";
import type { FpMatch } from "@/lib/fortuneplay-live";
import type { BookBoard } from "@/lib/betconstruct-feed";

const fpBook = bookByKey("fortuneplay")!;
const ybBook = bookByKey("ybets")!;
const LANDING = "https://mediaroosters.com/aacugmydl8";

function match(over: Partial<FpMatch> & { teamPairKey: string }): FpMatch {
  return {
    homeKey: "milan",
    awayKey: "internazionale",
    homeName: "AC Milan",
    awayName: "FC Internazionale",
    startTime: "2026-09-16T18:45:00Z",
    sport: "soccer",
    slug: "milan-inter",
    id: 42,
    urnId: "bc:match:9",
    oddsHome: 2.1,
    oddsDraw: 3.2,
    oddsAway: 3.6,
    totalLine: 2.5,
    totalOver: 1.9,
    totalUnder: 1.95,
    ...over,
  };
}

const boards = (fp: FpMatch[], yb: FpMatch[]): BookBoard[] => [
  { book: fpBook, map: new Map(fp.map((m) => [m.teamPairKey, m])) },
  { book: ybBook, map: new Map(yb.map((m) => [m.teamPairKey, m])) },
];

const merge = (b: BookBoard[]) => mergeBooksToResponse(b, { locale: "it", landingUrl: LANDING });

describe("mergeBooksToResponse — copertura", () => {
  it("genera un'entry anche per una partita che sta SOLO nel book secondario", () => {
    const soloYb = match({ teamPairKey: "2026-09-16:brighton|manchester united", homeKey: "brighton", awayKey: "manchester united", slug: "brighton-manutd", id: 527642926, totalLine: 3.5, totalOver: 1.8, totalUnder: 2.01 });
    const res = merge(boards([], [soloYb]));
    const e = res[soloYb.teamPairKey];
    expect(e).toBeTruthy();
    // i mercati extra della card nascono da questi tre campi: senza entry, niente gruppo Gol
    expect(e.totalLine).toBe(3.5);
    expect(e.totalOver).toBe(1.8);
    expect(e.oddsHome).toBe(2.1);
    expect(e.books?.map((b) => b.key)).toEqual(["ybets"]);
  });

  it("l'id del dettaglio viaggia col book che l'ha emesso", () => {
    const soloYb = match({ teamPairKey: "k-yb", id: 528029037 });
    const soloFp = match({ teamPairKey: "k-fp", id: 90595163 });
    const res = merge(boards([soloFp], [soloYb]));
    expect(res["k-yb"].detailBook).toBe("ybets");
    expect(res["k-yb"].id).toBe(528029037);
    expect(res["k-fp"].detailBook).toBe("fortuneplay");
    expect(res["k-fp"].id).toBe(90595163);
  });

  it("quando entrambi hanno la partita il riferimento resta il primario", () => {
    const fp = match({ teamPairKey: "k", id: 1 });
    const yb = match({ teamPairKey: "k", id: 999, oddsHome: 2.4 });
    const e = merge(boards([fp], [yb]))["k"];
    expect(e.id).toBe(1);
    expect(e.detailBook).toBe("fortuneplay");
    // e la CTA principale resta il deep-link FortunePlay
    expect(e.matchUrl).toBe(`https://www.fortuneplay.com/it/sports/soccer/milan-inter-m-1?stag=${fpBook.stag}`);
    expect(e.prefilled).toBe(true);
  });

  it("il best-price continua a pescare dal book migliore, anche quando è il secondario", () => {
    const fp = match({ teamPairKey: "k", oddsHome: 2.1, oddsDraw: 3.2, oddsAway: 3.6 });
    const yb = match({ teamPairKey: "k", id: 999, oddsHome: 2.4, oddsDraw: 3.1, oddsAway: 3.9 });
    const e = merge(boards([fp], [yb]))["k"];
    expect(e.oddsHome).toBe(2.4);
    expect(e.oddsDraw).toBe(3.2);
    expect(e.oddsAway).toBe(3.9);
    expect(e.bestBook).toEqual({ home: "ybets", draw: "fortuneplay", away: "ybets" });
  });

  it("su una partita solo-secondaria il bestBook nomina il secondario, mai il primario assente", () => {
    const yb = match({ teamPairKey: "k", id: 999 });
    const e = merge(boards([], [yb]))["k"];
    expect(e.bestBook).toEqual({ home: "ybets", draw: "ybets", away: "ybets" });
  });

  it("YBets non ha deep-link di partita → link alla sua landing e prefilled FALSO", () => {
    // Il vecchio confronto era con la landing del PRIMARIO: la landing YBets è
    // diversa, quindi sarebbe passata per un deep-link che non è.
    const yb = match({ teamPairKey: "k", id: 999 });
    const e = merge(boards([], [yb]))["k"];
    expect(e.matchUrl).toBe(ybBook.landing);
    expect(e.prefilled).toBe(false);
  });

  it("lati invertiti nel secondario: le quote si allineano al riferimento", () => {
    const fp = match({ teamPairKey: "k", homeKey: "milan", awayKey: "internazionale", oddsHome: 2.1, oddsAway: 3.6 });
    const yb = match({ teamPairKey: "k", id: 999, homeKey: "internazionale", awayKey: "milan", oddsHome: 9, oddsAway: 1.1 });
    const e = merge(boards([fp], [yb]))["k"];
    // 9 è la quota di "internazionale", che dal lato del riferimento è AWAY
    expect(e.oddsAway).toBe(9);
    expect(e.oddsHome).toBe(2.1);
  });

  it("nessun board → nessuna entry (e nessun crash)", () => {
    expect(merge([])).toEqual({});
    expect(merge(boards([], []))).toEqual({});
  });
});
