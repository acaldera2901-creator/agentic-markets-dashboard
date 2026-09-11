// #CALIB-4 — la guardia sul numero che decide le percentuali mostrate.
//
// Perche' questo file esiste: `CALIBRATION_TAU` non era pinnato da nessun test,
// quindi il suo valore poteva cambiare in silenzio — e non e' un dettaglio
// interno, e' il fattore che decide la percentuale che l'utente legge sulla
// scheda. Il gemello `tests/market-blend.test.ts` fa lo stesso per alpha, e ha
// intercettato in CI un cambio che localmente sembrava verde.
import { describe, it, expect } from "vitest";
import { CALIBRATION_TAU, applyTemperature } from "./calibration";

const p = { pHome: 0.62, pDraw: 0.23, pAway: 0.15 };
const somma = (t: { pHome: number; pDraw: number; pAway: number }) =>
  t.pHome + t.pDraw + t.pAway;

describe("CALIBRATION_TAU", () => {
  it("vale 1.0: la correzione stimata su understat 2021-2024 e' rimossa", () => {
    // Misurato il 10/09 su prediction_log (1.254 partite, un match per riga):
    // a tau=1.20 il segmento >=55% dichiara 63.9% e realizza 71.4% (+7.5pt,
    // z=+2.96, sotto-confidente); a tau=1.00 dichiara 66.1% e realizza 66.5%
    // (+0.3pt, z=+0.15). Se questo torna sopra 1, quel divario torna con lui.
    expect(CALIBRATION_TAU).toBe(1.0);
  });

  it("a tau=1.0 e' l'identita' ESATTA, che e' la leva di rollback", () => {
    const out = applyTemperature(p, 1.0);
    expect(out).toEqual(p);
  });
});

describe("applyTemperature: il verso della temperatura", () => {
  it("tau > 1 SCHIACCIA: la probabilita' alta scende", () => {
    const out = applyTemperature(p, 1.2);
    expect(out.pHome).toBeLessThan(p.pHome);
    expect(somma(out)).toBeCloseTo(1, 10);
  });

  it("tau < 1 ACUISCE: la probabilita' alta sale", () => {
    const out = applyTemperature(p, 0.86);
    expect(out.pHome).toBeGreaterThan(p.pHome);
    expect(somma(out)).toBeCloseTo(1, 10);
  });

  it("normalizza sempre a 1, anche partendo da una terna non normalizzata", () => {
    const out = applyTemperature({ pHome: 1.2, pDraw: 0.6, pAway: 0.4 }, 1.3);
    expect(somma(out)).toBeCloseTo(1, 10);
  });

  it("un tau invalido non altera nulla invece di produrre NaN", () => {
    for (const cattivo of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(applyTemperature(p, cattivo)).toEqual(p);
    }
  });

  it("l'ordine dei tre esiti non cambia mai: la temperatura e' monotona", () => {
    for (const t of [0.7, 0.86, 1.0, 1.2, 1.5]) {
      const o = applyTemperature(p, t);
      expect(o.pHome).toBeGreaterThan(o.pDraw);
      expect(o.pDraw).toBeGreaterThan(o.pAway);
    }
  });
});
