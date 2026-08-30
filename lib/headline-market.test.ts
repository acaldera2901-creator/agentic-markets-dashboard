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

// #HEADLINE-BELOWFLOOR-0830 — la regola DEVE valere anche sulle righe senza
// favorito netto: sono esattamente quelle che l'hanno originata. La prima
// versione le escludeva, e il visual check in produzione ha mostrato SK Brann
// 39%, FC Andorra 39% e Molde 47% rimaste invariate.
describe("headlineRead sulle righe senza favorito netto", () => {
  it("alza anche le righe con confidenza bassa, che sono il caso originario", () => {
    // SK Brann e FC Andorra, visti in produzione il 30/08 a 39%
    const r = must(headlineRead({ pHome: 0.39, pDraw: 0.31, pAway: 0.30 }));
    expect(r.market).toBe("double_1x");
    expect(r.prob).toBeCloseTo(0.70, 5);
    expect(r.prob).toBeGreaterThan(0.5);
  });

  it("nessuna tripla valida produce una testata sotto il 50%", () => {
    // il caso peggiore possibile: tre esiti perfettamente equivalenti
    const r = must(headlineRead({ pHome: 1 / 3, pDraw: 1 / 3, pAway: 1 / 3 }));
    expect(r.prob).toBeGreaterThan(0.66);
    // e su qualunque tripla: max(1X, X2) >= 2/3 quando nessuno arriva a 0.5
    for (const [h, d, a] of [[0.4, 0.3, 0.3], [0.34, 0.33, 0.33], [0.45, 0.1, 0.45], [0.2, 0.45, 0.35]]) {
      const x = must(headlineRead({ pHome: h, pDraw: d, pAway: a }));
      expect(x.prob).toBeGreaterThanOrEqual(0.5);
    }
  });
});

// #HEADLINE-ODDS-0830 — la quota deve seguire il mercato mostrato. Visto in
// produzione: "Casa Pia o pareggio · 65%" accostato a 2,66, che e' il prezzo di
// "Casa Pia vince" (la doppia chance sta a ~1,35). Un accostamento falso.
describe("la quota segue il mercato in testata", () => {
  it("con la doppia chance porta la quota della doppia chance, non quella 1X2", () => {
    const r = must(headlineRead(casaPia, { home: 2.66, double_x2: 1.36 }));
    expect(r.market).toBe("double_x2");
    expect(r.odds).toBe(1.36);
    expect(r.odds).not.toBe(2.66); // la quota 1X2 non deve seguire il cambio
  });

  it("se il book non espone la doppia chance, nessuna quota: mai una derivata", () => {
    const r = must(headlineRead(casaPia, { home: 2.66, away: 2.74 }));
    expect(r.market).toBe("double_x2");
    expect(r.odds).toBeNull();
  });

  it("quando resta sull'1X2 la quota e' quella dell'esito scelto", () => {
    const r = must(headlineRead({ pHome: 0.72, pDraw: 0.18, pAway: 0.10 }, { home: 1.35, away: 8.0 }));
    expect(r.market).toBe("h2h");
    expect(r.odds).toBe(1.35);
  });
});
