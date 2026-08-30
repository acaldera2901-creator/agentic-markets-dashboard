// #HEADLINE-MARKET-0830
import { describe, it, expect } from "vitest";
import { headlineRead, HEADLINE_MIN_PROB } from "./headline-market";

/** headlineRead puo' restituire null (probabilita' mancanti): nei casi validi non deve. */
function must<T>(v: T | null): T {
  expect(v).not.toBeNull();
  return v as T;
}

// Casa Pia v Moreirense, Primeira Liga 30/08/2026 — il caso che ha originato il
// lavoro. Quote Pinnacle devigate: 33,9% / 30,8% / 35,4%. La card mostrava
// "Casa Pia 35%", che e' corretto ma non e' una convinzione.
const casaPia = { pHome: 0.339, pDraw: 0.308, pAway: 0.354 };

describe("headlineRead", () => {
  it("su una partita equilibrata alza il numero passando alla doppia chance", () => {
    const r = must(headlineRead(casaPia));
    expect(r.market).toBe("double_x2"); // Moreirense o pareggio: il piu' probabile
    expect(r.prob).toBeCloseTo(0.662, 3);
    expect(r.prob).toBeGreaterThan(0.6);
  });

  it("il numero mostrato non e' mai inferiore a quello di prima", () => {
    const r = must(headlineRead(casaPia));
    const favorito = Math.max(casaPia.pHome, casaPia.pDraw, casaPia.pAway);
    expect(r.prob).toBeGreaterThanOrEqual(favorito);
  });

  it("con un favorito netto resta sull'1X2, come oggi", () => {
    const r = must(headlineRead({ pHome: 0.72, pDraw: 0.18, pAway: 0.10 }));
    expect(r.market).toBe("h2h");
    expect(r.selection).toBe("HOME");
    expect(r.prob).toBeCloseTo(0.72, 5);
  });

  it("esattamente alla soglia resta sull'1X2 (la soglia e' inclusiva)", () => {
    const r = must(headlineRead({ pHome: HEADLINE_MIN_PROB, pDraw: 0.3, pAway: 0.2 }));
    expect(r.market).toBe("h2h");
  });

  it("un soffio sotto la soglia passa alla doppia chance", () => {
    const r = must(headlineRead({ pHome: 0.499, pDraw: 0.3, pAway: 0.201 }));
    expect(r.market).toBe("double_1x");
    expect(r.prob).toBeCloseTo(0.799, 3);
  });

  it("sceglie la doppia chance piu' probabile fra 1X e X2", () => {
    // 1X = 0.62, X2 = 0.58 -> vince 1X
    const r = must(headlineRead({ pHome: 0.42, pDraw: 0.20, pAway: 0.38 }));
    expect(r.market).toBe("double_1x");
    expect(r.prob).toBeCloseTo(0.62, 5);
  });

  it("NON usa il 12: e' il numero piu' alto ma non nomina nessuna squadra", () => {
    // su Casa Pia il 12 varrebbe 69,3%, piu' di X2 (66,2%). Deve restare fuori.
    const r = must(headlineRead(casaPia));
    expect(r.market).not.toBe("double_12");
    expect(r.selection).toBe("X2");
  });

  it("porta la quota reale quando c'e', e nessuna quota quando manca", () => {
    const conQuota = must(headlineRead(casaPia, { double_x2: 1.36 }));
    expect(conQuota.odds).toBe(1.36);
    const senzaQuota = must(headlineRead(casaPia, {}));
    expect(senzaQuota.odds).toBeNull(); // mai una quota derivata
  });

  it("la selezione e' per PROBABILITA', mai per edge (#PICK-FAVOURITE-0812)", () => {
    // X2 e' piu' probabile (0.662) ma 1X avrebbe l'edge migliore con questa quota.
    // Deve comunque vincere la probabilita'.
    const r = must(headlineRead(casaPia, { double_1x: 3.0, double_x2: 1.30 }));
    expect(r.market).toBe("double_x2");
  });

  it("con la soglia a 0 il comportamento e' identico a quello attuale", () => {
    const r = must(headlineRead(casaPia, {}, 0));
    expect(r.market).toBe("h2h");
    expect(r.selection).toBe("AWAY"); // il favorito 1X2
  });

  it("regge probabilita' mancanti senza inventare nulla", () => {
    expect(headlineRead({ pHome: null, pDraw: null, pAway: null })).toBeNull();
    expect(headlineRead({ pHome: 0.4, pDraw: null, pAway: 0.35 })).toBeNull();
  });

  it("l'etichetta del mercato e' sempre presente: un numero nudo sarebbe fuorviante", () => {
    for (const t of [casaPia, { pHome: 0.72, pDraw: 0.18, pAway: 0.10 }]) {
      const r = must(headlineRead(t));
      expect(r).not.toBeNull();
      expect(r!.market).toBeTruthy();
      expect(["h2h", "double_1x", "double_x2"]).toContain(r!.market);
    }
  });
});
