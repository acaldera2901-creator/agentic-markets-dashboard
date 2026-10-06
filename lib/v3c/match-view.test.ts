// lib/v3c/match-view.test.ts (#REDESIGN-V3C F4)
import { describe, expect, it } from "vitest";
import type { V3BookPrice, V3LineSeries } from "./contracts";
import { bookList, checkPrices, checkedAt, cleanMatchId, fairPrice, gapDirection, matchHref, parsePrice, priceAxis, readBookLinks, readLineEvents, tapeLines, tapeSummary, toolStrip, topPriced } from "./match-view";
import { matchCopyFor, V3C_MATCH_COPY } from "./match-copy";

const bp = (bookmaker: string, name: string, price: number, at = "2026-10-05T23:10:15.445Z"): V3BookPrice => ({ bookmaker, name, price, captured_at: at, source: "live_feed", url: `https://example.test/${bookmaker}` });

describe("id e URL della partita", () => {
  it("gli id con «:» e spazi fanno andata e ritorno", () => {
    for (const id of ["oddsapi:0d9f", "tennis:partner:2026-10-05_brock anderson|constantinos djakouris"]) {
      const href = matchHref(id);
      expect(href.startsWith("/match/")).toBe(true);
      expect(cleanMatchId(href.slice("/match/".length))).toBe(id);
    }
  });
  it("rifiuta vuoto, troppo lungo e percent-encoding rotto", () => {
    expect(cleanMatchId("")).toBeNull();
    expect(cleanMatchId("x".repeat(201))).toBeNull();
    expect(cleanMatchId("%E0%A4%A")).toBeNull();
  });
});

describe("i book: quota oppure «Odds on site»", () => {
  it("prima i prezzi dal più alto, poi i link senza quota; un book una volta", () => {
    const list = bookList([bp("ybets", "YBets", 2.1), bp("fortuneplay", "FortunePlay", 2.19)], [
      { bookmaker: "ybets", name: "YBets", url: "https://x.test" },
      { bookmaker: "wildz", name: "Wildz", url: "https://w.test" },
      { bookmaker: "betscore", name: "BetScore", url: "https://b.test" },
    ]);
    expect(list.map((b) => [b.name, b.price])).toEqual([
      ["FortunePlay", 2.19],
      ["YBets", 2.1],
      ["BetScore", null],
      ["Wildz", null],
    ]);
  });
  it("il campo opzionale more_books si legge in difesa", () => {
    expect(readBookLinks({})).toEqual([]);
    expect(readBookLinks({ more_books: "x" })).toEqual([]);
    expect(readBookLinks({ more_books: [{ bookmaker: "a", name: "A", url: "javascript:alert(1)" }, { bookmaker: "b", name: "B", url: "https://b.test" }, { name: "C" }] })).toEqual([{ bookmaker: "b", name: "B", url: "https://b.test" }]);
  });
  it("l'ora del controllo è la cattura più recente", () => {
    expect(checkedAt(bookList([bp("a", "A", 2, "2026-10-05T10:00:00Z"), bp("b", "B", 2, "2026-10-05T11:00:00Z")]))).toBe("2026-10-05T11:00:00.000Z");
    expect(checkedAt([])).toBeNull();
  });
});

const series: V3LineSeries[] = [
  {
    market: "1X2",
    source: "partner_price_history",
    bookmaker: "ybets",
    points: [{ t: "2026-10-04T02:00:00Z", price: { home: 2.66, draw: null, away: 2.29 }, market_p: null, margin: null }],
    coverage: { n_points: 1, first_at: null, last_at: null, median_interval_min: null, max_gap_min: null },
  },
  {
    market: "1X2",
    source: "partner_price_history",
    bookmaker: "fortuneplay",
    points: [
      { t: "2026-10-04T00:00:00Z", price: { home: 2.66, draw: 3.75, away: 2.29 }, market_p: null, margin: null },
      { t: "2026-10-05T22:00:00Z", price: { home: 2.84, draw: 3.69, away: 2.19 }, market_p: null, margin: null },
    ],
    coverage: { n_points: 2, first_at: null, last_at: null, median_interval_min: 120, max_gap_min: 120 },
  },
  { market: "AH", source: "ah_odds_history", bookmaker: "x", points: [{ t: "2026-10-04T00:00:00Z", line: -0.5, price: { home: 1.9, away: 1.9 } }], coverage: { n_points: 1, first_at: null, last_at: null, median_interval_min: null, max_gap_min: null } },
];

describe("il nastro: solo le catture vere", () => {
  it("una linea per book, la più lunga prima, AH ignorata", () => {
    const l = tapeLines(series, "away");
    expect(l.map((x) => x.bookmaker)).toEqual(["fortuneplay", "ybets"]);
    expect(l[0].points.map((p) => p.v)).toEqual([2.29, 2.19]);
  });
  it("un punto senza prezzo si salta, non si riempie", () => {
    const l = tapeLines(series, "draw");
    expect(l.map((x) => x.bookmaker)).toEqual(["fortuneplay"]);
  });
  it("riassunto: da, a, quante catture; nessuna serie = null", () => {
    expect(tapeSummary(tapeLines(series, "home"))).toMatchObject({ from: 2.66, to: 2.84, n: 2 });
    expect(tapeSummary(tapeLines([], "home"))).toBeNull();
    expect(tapeLines(series, "p1")).toEqual([]);
  });
  it("le notizie si mostrano solo se il dato esiste e ha un'ora", () => {
    expect(readLineEvents({ contract: "v3.line_movement.2" })).toEqual([]);
    expect(readLineEvents({ events: [{ t: "bad", label: "x" }, { t: "2026-10-05T11:40:00Z", label: " Kean out ", url: "ftp://x" }] })).toEqual([{ t: Date.parse("2026-10-05T11:40:00Z"), label: "Kean out", url: null }]);
  });
  it("l'asse copre i valori con un passo leggibile", () => {
    const a = priceAxis([2.19, 2.29, 2.31]);
    expect(a.lo).toBeLessThanOrEqual(2.19);
    expect(a.hi).toBeGreaterThanOrEqual(2.31);
    expect(a.ticks.length).toBeGreaterThanOrEqual(3);
  });
});

describe("il price check", () => {
  it("implicita, margine, margine tolto e gap (stesse formule della board)", () => {
    const r = checkPrices([2.98, 4.0, 2.34], [32.33, 24.33, 43.34]);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.sum).toBeCloseTo(101.29, 1);
    expect(r.margin).toBeCloseTo(1.29, 1);
    expect(r.noVig.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    expect(r.noVig[2]).toBeCloseTo(42.19, 1);
    expect(r.lead).toBe(2);
    expect(r.gaps[2]).toBeCloseTo(1.15, 2);
  });
  it("senza stime: niente gap, lead sul primo", () => {
    const r = checkPrices([1.9, 1.9]);
    expect(r?.gaps).toEqual([null, null]);
    expect(r?.margin).toBeCloseTo(5.26, 2);
  });
  it("un prezzo non valido → null, mai NaN", () => {
    expect(checkPrices([2.1, null, 3])).toBeNull();
    expect(checkPrices([2.1, 1, 3])).toBeNull();
    expect(checkPrices([2.1])).toBeNull();
    expect(parsePrice(" 2,15 ")).toBe(2.15);
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("abc")).toBeNull();
  });
  it("direzione e prezzo equo", () => {
    expect(gapDirection(4)).toBe("longer");
    expect(gapDirection(-3)).toBe("shorter");
    expect(gapDirection(1.1)).toBe("flat");
    expect(fairPrice(0.5)).toBe(2);
    expect(fairPrice(null)).toBeNull();
    expect(fairPrice(1)).toBeNull();
  });
});

describe("la striscia di tool", () => {
  it("risultati delle formule dei tool e link con gli stessi input", () => {
    const [ev, , margin] = toolStrip([
      { slug: "ev-calculator", values: { price: 2.15, prob: 48 } },
      { slug: "kelly-criterion", values: { price: 2.15, prob: 48, bank: 500 } },
      { slug: "margin-calculator", values: { p1: 2.15, p2: 3.2, p3: 3.5 } },
    ]);
    expect(ev.result?.value).toBe("+3.2%");
    expect(ev.href).toBe("/tools/ev-calculator?price=2.15&prob=48");
    expect(margin.result?.value).toBe("6.3%");
  });
});

describe("copy", () => {
  it("EN e IT hanno le stesse chiavi; le altre lingue cadono sull'inglese", () => {
    const keys = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v).map((x) => `${k}.${x}`) : [k])).sort();
    expect(keys(V3C_MATCH_COPY.it)).toEqual(keys(V3C_MATCH_COPY.en));
    expect(matchCopyFor("fr")).toBe(V3C_MATCH_COPY.en);
  });
  it("nessuna parola vietata", () => {
    const text = JSON.stringify(V3C_MATCH_COPY.en) + Object.values(V3C_MATCH_COPY.en).filter((v) => typeof v === "function").map(String).join(" ");
    expect(text).not.toMatch(/\bguarantee|\block\b|sure win|easy money|crush|\bROI\b|hit.rate|\bCLV\b|beat the market/i);
  });
});

// polish: «best» solo con un prezzo STRETTAMENTE più alto
describe("topPriced", () => {
  it("one book above the rest = one best", () => {
    const l = bookList([bp("fortuneplay", "FortunePlay", 1.67), bp("ybets", "YBets", 1.6)]);
    expect(topPriced(l).map((b) => b.bookmaker)).toEqual(["fortuneplay"]);
  });
  it("same price to the cent = shared, no single best", () => {
    const l = bookList([bp("fortuneplay", "FortunePlay", 1.52), bp("ybets", "YBets", 1.52)]);
    expect(topPriced(l)).toHaveLength(2);
  });
  it("books without a price never count", () => {
    const l = bookList([], [{ bookmaker: "ggbet", name: "GG.BET", url: "https://x.test" }]);
    expect(topPriced(l)).toEqual([]);
  });
});
