// #CLASSIC-CARD-1008 — la scheda Slab decide cosa può dire. Righe vere del board
// (now/data/joined-football.json, letto l'08/10 14:43 CEST), nessuna rete, nessun DB.
import { describe, expect, it } from "vitest";
import { classicFootballView, classicTennisView, differsBy as differsByOf, freshEnough, leadFromMarket, sheetValueAllowed, footballBooks, tennisBooks, tennisOddsFor, type ClassicBook } from "./card-view";
import { dedupeByPair, devigOne, fairFarFromBest, modelGuard, rawModelFromEstimate, saneMarketSet, tzAbbr } from "./guard";
import { normName } from "@/lib/odds-api";
import { playerKey } from "./fixdata3";

const book = (key: string, name: string, prices: (number | null)[]): ClassicBook => ({ key, name, url: `https://example.test/${key}`, prices });
const COMO_BOOKS = [book("fortuneplay", "FortunePlay", [2.51, 3.57, 2.69]), book("ybets", "YBets", [2.47, 3.5, 2.64])];
const VILLA_BOOKS = [book("fortuneplay", "FortunePlay", [2.65, 3.51, 2.58]), book("ybets", "YBets", [2.6, 3.45, 2.54])];
const BOLTON_BOOKS = [book("fortuneplay", "FortunePlay", [2.78, 3.34, 2.56]), book("ybets", "YBets", [2.67, 3.19, 2.46])];

describe("guard — il modello grezzo ricavato dalla stima servita", () => {
  it("inverte il blend 30/70", () => {
    // stima 0,41 con mercato 0,379 → modello (0,41 − 0,7·0,379)/0,3 = 0,4823
    expect(rawModelFromEstimate(0.41, 0.379)).toBeCloseTo(0.4823, 3);
    expect(rawModelFromEstimate(null, 0.4)).toBeNull();
    expect(rawModelFromEstimate(0.9, 0.1)).toBe(1); // dentro [0,1]
  });
  it("15/25 pp sul grezzo = 4,5/7,5 pp sulla stima", () => {
    const at = (gap: number) => modelGuard([{ model_p: rawModelFromEstimate(0.4 + gap, 0.4), market_p: 0.4 }]).level;
    expect(at(0.044)).toBe("ok");
    expect(at(0.046)).toBe("no_value");
    expect(at(0.076)).toBe("market_only");
  });
  it("prezzi assurdi non sono un mercato (N10)", () => {
    expect(saneMarketSet([45.71, 1.02])).toBe(true); // coppia possibile in sé (preso dal confronto coi book)
    expect(saneMarketSet([1.0, 3, 4])).toBe(false);
    expect(saneMarketSet([1.5, 1.5, 1.5])).toBe(false); // margine > 25%
    expect(devigOne(1.0, 0.05)).toBeNull();
  });
  it("dedup per coppia NON ordinata entro 48 h", () => {
    const rows = [
      { id: "a", h: "Colombia", a: "Peru", ko: "2026-10-07T03:00:00Z" },
      { id: "b", h: "Peru", a: "Colombia", ko: "2026-10-07T23:45:00Z" },
      { id: "c", h: "Colombia", a: "Peru", ko: "2026-10-12T03:00:00Z" },
    ];
    expect(dedupeByPair(rows, (r) => ({ a: r.h, b: r.a, at: r.ko }), normName).map((r) => r.id)).toEqual(["a", "c"]);
    const tn = [{ id: "x", p1: "Bai Zhuoxuan", p2: "Emerson Jones", ko: "2026-10-08T02:00:00Z" }, { id: "y", p1: "Emerson Jones", p2: "Zhuoxuan Bai", ko: "2026-10-08T05:00:00Z" }];
    expect(dedupeByPair(tn, (r) => ({ a: r.p1, b: r.p2, at: r.ko }), playerKey).map((r) => r.id)).toEqual(["x"]);
  });
  it("la sigla del fuso", () => {
    expect(tzAbbr("Europe/Rome", "en-GB", new Date("2026-10-08T12:00:00Z"))).toBe("CEST");
    expect(tzAbbr(undefined)).toBe("UTC");
  });
});

describe("calcio — riga aperta", () => {
  it("Como–Roma: protezione ok, stima, mercato, scarto col segno, best unico", () => {
    const v = classicFootballView({ started: false, est: [0.41, 0.27, 0.32], odds: [2.57, 3.55, 2.7], leadIdx: 0, books: COMO_BOOKS });
    expect(v.kind).toBe("estimate");
    expect(v.valueAllowed).toBe(true);
    expect(v.bigPct).toBeCloseTo(41, 5);
    expect(v.marketPct!).toBeGreaterThan(36);
    expect(v.gapPp!).toBeGreaterThan(0);
    expect(v.chips.map((c) => [c.name, c.price, c.best])).toEqual([["FortunePlay", 2.51, true], ["YBets", 2.47, false]]);
    expect(v.cta).toMatchObject({ name: "FortunePlay", price: 2.51 });
  });
  it("Aston Villa: oltre 25 pp sul grezzo → Market only (il numero è il mercato, niente scarto)", () => {
    const v = classicFootballView({ started: false, est: [0.462, 0.27, 0.268], odds: [2.66, 3.5, 2.6], leadIdx: 0, books: VILLA_BOOKS });
    expect(v.kind).toBe("market_only");
    expect(v.bigPct).toBe(v.marketPct);
    expect(v.gapPp).toBeNull();
    expect(v.valueAllowed).toBe(false);
  });
  it("Bolton: 15–25 pp → protetta, scarto sì, valore no", () => {
    const v = classicFootballView({ started: false, est: [0.392, 0.28, 0.328], odds: [2.84, 3.4, 2.6], leadIdx: 0, books: BOLTON_BOOKS });
    expect(v.kind).toBe("protected");
    expect(v.valueAllowed).toBe(false);
    expect(v.gapPp).not.toBeNull();
  });
  it("senza nessun mercato e numero recente (≤ 6 h) → Model only", () => {
    const v = classicFootballView({ started: false, est: [0.518, 0.25, 0.232], odds: [null, null, null], leadIdx: 0, books: [], modelAsOf: "2026-10-08T10:00:00Z", now: new Date("2026-10-08T14:00:00Z") });
    expect(v.kind).toBe("model_only");
    expect(v.marketPct).toBeNull();
    expect(v.gapPp).toBeNull();
    expect(v.cta).toBeNull();
  });
  it("senza nessun mercato e numero vecchio (o senza data) → No price yet, nessun numero", () => {
    const base = { started: false, est: [0.518, 0.25, 0.232] as [number, number, number], odds: [null, null, null] as [null, null, null], leadIdx: 0 as const, books: [] };
    // oldest_computed_at dell'08/10: 2026-10-03T20:02 — quasi 5 giorni
    const v = classicFootballView({ ...base, modelAsOf: "2026-10-03T20:02:07Z", now: new Date("2026-10-08T15:00:00Z") });
    expect(v.kind).toBe("no_price");
    expect([v.bigPct, v.marketPct, v.gapPp, v.marketFrom]).toEqual([null, null, null, null]);
    expect(v.valueAllowed).toBe(false);
    expect(classicFootballView(base).kind).toBe("no_price");
  });
  it("parità di prezzo: nessun «best»; un partner senza prezzo dice «Odds on partner site»", () => {
    const v = classicFootballView({
      started: false, est: [0.41, 0.27, 0.32], odds: [2.57, 3.55, 2.7], leadIdx: 0,
      books: [book("fortuneplay", "FortunePlay", [2.5, 3.5, 2.7]), book("ybets", "YBets", [2.5, 3.5, 2.7])],
      landing: [{ name: "BetScore", url: "https://example.test/bs" }],
    });
    expect(v.chips.map((c) => c.best)).toEqual([false, false, false]);
    expect(v.chips[2]).toMatchObject({ name: "BetScore", price: null });
  });
  it("partita iniziata: niente prezzi né bottone, i numeri restano", () => {
    const v = classicFootballView({ started: true, est: [0.41, 0.27, 0.32], odds: [2.57, 3.55, 2.7], leadIdx: 0, books: COMO_BOOKS });
    expect(v.chips).toEqual([]);
    expect(v.cta).toBeNull();
    expect(v.bigPct).toBeCloseTo(41, 5);
  });
  it("quote servite assurde → si usa il mercato dei book", () => {
    const v = classicFootballView({ started: false, est: [0.41, 0.27, 0.32], odds: [1.0, 1.01, 1.02], leadIdx: 0, books: COMO_BOOKS });
    expect(v.marketPct!).toBeCloseTo((1 / 2.51 / (1 / 2.51 + 1 / 3.57 + 1 / 2.69) + 1 / 2.47 / (1 / 2.47 + 1 / 3.5 + 1 / 2.64)) * 50, 1);
  });
});

describe("calcio — riga chiusa (il lato non si rivela)", () => {
  it("niente chip sul lato: il miglior prezzo per ogni esito", () => {
    const v = classicFootballView({ started: false, estLead: 0.41, oddsLead: 2.57, books: COMO_BOOKS });
    expect(v.chips).toEqual([]);
    expect(v.cells.map((c) => [c.label, c.price, c.bookName])).toEqual([["1", 2.51, "FortunePlay"], ["X", 3.57, "FortunePlay"], ["2", 2.69, "FortunePlay"]]);
    expect(v.kind).toBe("estimate");
  });
  it("Nantes (chiusa, 38% contro 3.50): Market only", () => {
    const v = classicFootballView({ started: false, estLead: 0.383, oddsLead: 3.5, books: [book("fortuneplay", "FortunePlay", [1.94, 3.17, 3.35])] });
    expect(v.kind).toBe("market_only");
  });
});

describe("calcio — mercato ricavato dai prezzi dei partner (#CLASSIC-FIX1-1008)", () => {
  // Augsburg–Bayern 10/10 (/api/predictions e /api/fortuneplay-odds pubblici, 08/10 15:05 UTC):
  // riga chiusa 71,17%, market_odds null; FortunePlay 9.80/9.20/1.19, YBets 9.40/8.70/1.18.
  const AUGSBURG = [book("fortuneplay", "FortunePlay", [9.8, 9.2, 1.19]), book("ybets", "YBets", [9.4, 8.7, 1.18])];
  const devig = (p: number[]) => { const s = p.reduce((a, x) => a + 1 / x, 0); return p.map((x) => 1 / x / s); };
  const mAway = (devig([9.8, 9.2, 1.19])[2] + devig([9.4, 8.7, 1.18])[2]) / 2;

  it("Augsburg–Bayern: niente più «Model only 71%» — mercato dai book, dichiarato, protezione applicata", () => {
    const v = classicFootballView({ started: false, estLead: 0.711728075383029, oddsLead: null, books: AUGSBURG });
    expect(v.marketFrom).toBe("partners");
    expect(v.marketPct!).toBeCloseTo(mAway * 100, 6);
    // nessuna quota servita = nessun blend: la stima è il modello, 71,2 contro 79,6 → 8,5 pp, protezione ok
    expect(v.kind).toBe("estimate");
    expect(v.gapPp!).toBeCloseTo(Math.round((71.1728 - mAway * 100) * 10) / 10, 6);
    expect(v.guard.delta_pp!).toBeLessThanOrEqual(15);
  });
  it("senza quote servite NON si inverte il blend (la stima è il modello grezzo)", () => {
    // 0,70 contro 0,7962: invertendo il 30/70 il «modello» sarebbe 0,47 (32 pp) → Market only per errore
    expect(modelGuard([{ model_p: rawModelFromEstimate(0.7, mAway), market_p: mAway }]).level).toBe("market_only");
    const v = classicFootballView({ started: false, estLead: 0.7, oddsLead: null, books: AUGSBURG });
    expect(v.kind).toBe("estimate");
    // 0,62: 17,6 pp dal mercato (protetta) ma prezzo equo 1,61 contro 1,19 (+35%) → Market only
    expect(classicFootballView({ started: false, estLead: 0.62, oddsLead: null, books: AUGSBURG }).priceFar).toBe(true);
  });
  it("oltre 25 pp dal mercato ricavato → Market only, il numero è quello dei book", () => {
    const v = classicFootballView({ started: false, estLead: 0.5, oddsLead: null, books: AUGSBURG });
    expect(v.kind).toBe("market_only");
    expect(v.bigPct).toBe(v.marketPct);
    expect(v.marketFrom).toBe("partners");
  });
  it("Palace–Forest (v3c N3): prezzo equo a > 25% dal miglior prezzo con link → Market only senza prezzo equo", () => {
    const books = [book("fortuneplay", "FortunePlay", [2.68, 3.35, 2.64])];
    const v = classicFootballView({ started: false, estLead: 0.59, oddsLead: null, books });
    expect(v.kind).toBe("market_only");
    expect(v.priceFar).toBe(true);
    expect(v.gapPp).toBeNull();
  });
  it("riga aperta senza quote servite: il mercato è dei book e la stima non si inverte", () => {
    const v = classicFootballView({ started: false, est: [0.08, 0.13, 0.79], odds: [null, null, null], leadIdx: 2, books: AUGSBURG });
    expect(v.kind).toBe("estimate");
    expect(v.marketFrom).toBe("partners");
  });
  it("se l'esito di punta non è il favorito dei book non si indovina: Model only/No price yet", () => {
    // 0,46 è più vicino all'esito X (0,45) che al favorito (0,48 sarebbe…): favorito e più vicino diversi
    expect(leadFromMarket(0.46, [0.48, 0.44, 0.08])).toBe(0);
    expect(leadFromMarket(0.43, [0.48, 0.44, 0.08])).toBeNull();
    expect(leadFromMarket(0.5, [0.4, 0.4, 0.2])).toBeNull(); // favorito non unico
    const books = [book("fortuneplay", "FortunePlay", [2.0, 2.2, 12])];
    expect(classicFootballView({ started: false, estLead: 0.43, oddsLead: null, books }).kind).toBe("no_price");
  });
  it("le quote servite restano la prima scelta: origine «served»", () => {
    const v = classicFootballView({ started: false, estLead: 0.41, oddsLead: 2.57, books: COMO_BOOKS });
    expect(v.marketFrom).toBe("served");
  });
  it("età del numero: ≤ 6 h", () => {
    const now = new Date("2026-10-08T15:00:00Z");
    expect(freshEnough("2026-10-08T09:00:00Z", now)).toBe(true);
    expect(freshEnough("2026-10-08T08:59:00Z", now)).toBe(false);
    expect(freshEnough(null, now)).toBe(false);
  });
  it("fairFarFromBest: i longshot (< 10%) non contano", () => {
    expect(fairFarFromBest(0.05, 14)).toBe(false);
    expect(fairFarFromBest(0.59, 2.64)).toBe(true);
    expect(fairFarFromBest(0.43, 2.64)).toBe(false);
  });
});

describe("tennis", () => {
  const NOW = new Date("2026-10-08T12:00:00Z");
  it("feed partner → Market only, stesso prezzo dai due partner = nessun best", () => {
    const v = classicTennisView({
      started: false, modelVersion: "partner-market-v1", tournament: "Partner feed", player1: "Abril Pajello", player2: "Fernanda Rain Contreras",
      p: [0.31, 0.69], odds: [3.1, 1.35], leadIdx: 1, eloAsOf: null, now: NOW,
      books: [book("fortuneplay", "FortunePlay", [3.1, 1.35]), book("ybets", "YBets", [3.1, 1.35])],
    });
    expect(v.kind).toBe("market_only");
    expect(v.chips.every((c) => !c.best)).toBe(true);
    expect(v.gapPp).toBeNull();
  });
  it("ATP con Elo fresco → Elo-based (0,1·Elo + 0,9·mercato), scarto attenuato, mai valore", () => {
    const v = classicTennisView({
      started: false, modelVersion: "elo_surface_v4_features_odds", tournament: "Rolex Shanghai Masters", player1: "Cameron Norrie", player2: "Dalibor Svrcina",
      p: [0.63, 0.37], odds: [1.65, 2.25], leadIdx: 0, eloAsOf: "2026-10-08T09:00:00Z", now: NOW, books: [],
    });
    expect(v.kind).toBe("elo_blend");
    expect(v.valueAllowed).toBe(false);
    const m = (1 / 1.65) / (1 / 1.65 + 1 / 2.25);
    expect(v.bigPct!).toBeCloseTo((0.1 * 0.63 + 0.9 * m) * 100, 1);
  });
  it("Elo più vecchio di 6 h, o Challenger → Market only", () => {
    const base = { started: false, modelVersion: "elo_surface_v4_features_odds", player1: "A B", player2: "C D", p: [0.63, 0.37] as [number, number], odds: [1.65, 2.25] as [number, number], leadIdx: 0 as const, now: NOW, books: [] };
    expect(classicTennisView({ ...base, tournament: "Rolex Shanghai Masters", eloAsOf: "2026-10-08T05:00:00Z" }).kind).toBe("market_only");
    expect(classicTennisView({ ...base, tournament: "ATP Challenger Braga", eloAsOf: "2026-10-08T11:00:00Z" }).kind).toBe("market_only");
  });
  it("Elo senza nessun mercato → No price yet: nessun numero, nessun tag", () => {
    const v = classicTennisView({ started: false, modelVersion: "elo_surface_v4_features_odds", tournament: "China Open", player1: "A", player2: "B", pLead: 0.87, oddsLead: null, eloAsOf: null, now: NOW, books: [] });
    expect(v.kind).toBe("no_price");
    expect([v.bigPct, v.marketPct, v.gapPp]).toEqual([null, null, null]);
    expect(v.valueAllowed).toBe(false);
    // anche con l'Elo fresco: senza mercato la stima Elo non esiste
    const fresh = classicTennisView({ started: false, modelVersion: "elo_surface_v4_features_odds", tournament: "China Open", player1: "A", player2: "B", pLead: 0.87, oddsLead: null, eloAsOf: "2026-10-08T11:00:00Z", now: NOW, books: [] });
    expect(fresh.kind).toBe("no_price");
  });
  it("Svitolina–Zheng 08/10 (Elo di 2 giorni, nessuna quota servita, book partner) → Market only dai partner", () => {
    // /api/tennis 08/10: model_prob 0,7303, market_odds null, computed_at 2026-10-07T11:45:12
    // FortunePlay e YBets: Svitolina 1.63, Zheng 2.07 (allineati a [player1, player2])
    const books = [book("fortuneplay", "FortunePlay", [1.63, 2.07]), book("ybets", "YBets", [1.63, 2.07])];
    const v = classicTennisView({ started: false, modelVersion: "elo_surface_v4_features_odds", tournament: "China Open", player1: "Elina Svitolina", player2: "Zheng Qinwen", pLead: 0.7303, oddsLead: null, eloAsOf: "2026-10-07T11:45:12", now: new Date("2026-10-08T15:00:00Z"), books });
    expect(v.kind).toBe("market_only");
    expect(v.marketFrom).toBe("partners");
    expect(v.bigPct).toBe(v.marketPct);
    expect(v.bigPct!).toBeCloseTo((1 / 1.63 / (1 / 1.63 + 1 / 2.07)) * 100, 6);
  });
  it("Elo fresco ma prezzo equo a > 25% dal miglior prezzo con link → Market only", () => {
    const v = classicTennisView({
      started: false, modelVersion: "elo_surface_v4_features_odds", tournament: "China Open", player1: "A B", player2: "C D",
      p: [0.9, 0.1], odds: [1.65, 2.25], leadIdx: 0, eloAsOf: "2026-10-08T11:00:00Z", now: NOW,
      books: [book("fortuneplay", "FortunePlay", [2.3, 1.6])],
    });
    expect(v.kind).toBe("market_only");
    expect(v.priceFar).toBe(true);
  });
});

describe("allineamento dei book", () => {
  it("calcio: inverte se il feed ha casa e ospite al contrario", () => {
    const fp = { homeKey: normName("AS Roma"), awayKey: normName("Como 1907"), oddsHome: 2.69, oddsDraw: 3.57, oddsAway: 2.51, matchUrl: "u", books: [{ key: "fortuneplay", name: "FortunePlay", oddsHome: 2.69, oddsDraw: 3.57, oddsAway: 2.51, matchUrl: "u" }] };
    expect(footballBooks(fp, "Como 1907", "AS Roma")[0].prices).toEqual([2.51, 3.57, 2.69]);
  });
  it("tennis: «Zheng Qinwen» = «Qinwen Zheng» (08/10: la scheda Elo diceva «No partner price» con FortunePlay in pagina)", () => {
    const entry = { homeKey: "qinwen zheng", awayKey: "elina svitolina", oddsHome: 2.07, oddsDraw: null, oddsAway: 1.63, matchUrl: "u", books: [{ key: "fortuneplay", name: "FortunePlay", oddsHome: 2.07, oddsDraw: null, oddsAway: 1.63, matchUrl: "u" }] };
    const fpOdds = { "2026-10-09:elina svitolina|qinwen zheng": entry, "2026-10-09:x|y": { ...entry, homeKey: "x", awayKey: "y" } };
    const fp = tennisOddsFor(fpOdds, "Elina Svitolina", "Zheng Qinwen", "2026-10-09T07:00:00Z");
    expect(fp).toBe(entry);
    expect(tennisBooks(fp, "Elina Svitolina", "Zheng Qinwen")[0].prices).toEqual([1.63, 2.07]);
    expect(tennisOddsFor(fpOdds, "Elina Svitolina", "Zheng Qinwen", "2026-10-11T07:00:00Z")).toBeNull();
  });
  it("tennis: nessun libro se i nomi non combaciano", () => {
    const fp = { homeKey: "x", awayKey: "y", oddsHome: 1.5, oddsDraw: null, oddsAway: 2.5, matchUrl: "u" };
    expect(tennisBooks(fp, "Cameron Norrie", "Dalibor Svrcina")).toEqual([]);
  });
});

describe("la fascia «differs most» e la scheda dicono la stessa cosa", () => {
  it("su righe chiuse, dentro la fascia ⇔ scheda «estimate» non in linea", () => {
    const rows: [number, number][] = [[0.618, 1.66], [0.443, 1.96], [0.412, 2.58], [0.39, 2.37], [0.805, 1.15], [0.57, 1.47], [0.383, 3.5]];
    for (const [est, odds] of rows) {
      const data = { sport: "football", startsAt: "2026-10-12T12:00:00Z", isLive: false, classic: { sport: "football", estLead: est, oddsLead: odds } };
      const card = classicFootballView({ started: false, estLead: est, oddsLead: odds, books: COMO_BOOKS });
      const inBand = (card.kind === "estimate" && !card.flat);
      expect(differsByOf(data) != null, `${est}@${odds}`).toBe(inBand);
    }
  });
});

describe("scheda partita: i tag «+X%» seguono la protezione", () => {
  const fpOf = (prices: [number, number, number]) => ({ homeKey: normName("H"), awayKey: normName("A"), oddsHome: prices[0], oddsDraw: prices[1], oddsAway: prices[2], matchUrl: "u" });
  it("Como ok → sì; Bolton protetta e Villa Market only → no; tennis → mai", () => {
    const row = (est: [number, number, number], odds: [number, number, number]) => ({ sport: "football", home: "H", away: "A", classic: { sport: "football", est, odds, leadIdx: 0 } });
    expect(sheetValueAllowed(row([0.41, 0.27, 0.32], [2.57, 3.55, 2.7]), fpOf([2.51, 3.57, 2.69]))).toBe(true);
    expect(sheetValueAllowed(row([0.392, 0.28, 0.328], [2.84, 3.4, 2.6]), fpOf([2.78, 3.34, 2.56]))).toBe(false);
    expect(sheetValueAllowed(row([0.462, 0.27, 0.268], [2.66, 3.5, 2.6]), fpOf([2.65, 3.51, 2.58]))).toBe(false);
    expect(sheetValueAllowed({ sport: "tennis", home: "a", away: "b", classic: { sport: "tennis" } }, null)).toBe(false);
  });
});
