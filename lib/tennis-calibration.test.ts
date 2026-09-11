// #CURSE-ANCHORED-0911 — la guardia sulla correzione MIRATA.
//
// Il caso che conta non e' «la temperatura funziona» ma «si applica solo a chi
// ne ha bisogno»: una correzione uniforme e' stata misurata e ROMPE il gruppo
// sano (modello nostro da +3,5 a +6,5pt, z=+2,33). Se un giorno qualcuno
// togliesse la distinzione, questi test devono diventare rossi.
import { describe, it, expect } from "vitest";
import {
  TENNIS_ANCHORED_TAU,
  applyTennisTemperature,
  probabilitaMostrata,
} from "./tennis-calibration";

describe("TENNIS_ANCHORED_TAU", () => {
  it("vale 1.68, stimato DENTRO la griglia e non al suo bordo", () => {
    // Un primo tentativo con griglia fino a 1.60 si era fermato esattamente li':
    // una stima al bordo non e' una stima, e' un «almeno». Allargata a 2.40,
    // l'ottimo cade a 1.68 con margine da entrambe le parti.
    expect(TENNIS_ANCHORED_TAU).toBe(1.68);
    expect(TENNIS_ANCHORED_TAU).toBeGreaterThan(0.8);
    expect(TENNIS_ANCHORED_TAU).toBeLessThan(2.4);
  });
});

describe("probabilitaMostrata: la correzione va SOLO dove serve", () => {
  it("riga market-anchored (senza edge): la probabilita' SCENDE", () => {
    const p = 0.726; // il dichiarato medio misurato sul holdout
    const out = probabilitaMostrata(p, false);
    expect(out).toBeLessThan(p);
    // l'ordine di grandezza e' quello misurato: -6,30pt in media
    expect(100 * (out - p)).toBeLessThan(-3);
    expect(100 * (out - p)).toBeGreaterThan(-12);
  });

  it("riga col NOSTRO edge: invariata, bit per bit", () => {
    // E' l'asserzione piu' importante del file. Il gruppo col nostro modello e'
    // calibrato (+3,5pt, entro il rumore): toccarlo lo peggiorerebbe.
    for (const p of [0.55, 0.62, 0.726, 0.81, 0.93]) {
      expect(probabilitaMostrata(p, true)).toBe(p);
    }
  });

  it("i due percorsi divergono davvero (non e' un ramo morto)", () => {
    const p = 0.75;
    expect(probabilitaMostrata(p, false)).not.toBe(probabilitaMostrata(p, true));
  });
});

describe("applyTennisTemperature", () => {
  it("schiaccia verso il 50% sopra, e alza sotto: simmetrica", () => {
    expect(applyTennisTemperature(0.75)).toBeLessThan(0.75);
    expect(applyTennisTemperature(0.75)).toBeGreaterThan(0.5);
    expect(applyTennisTemperature(0.25)).toBeGreaterThan(0.25);
    expect(applyTennisTemperature(0.25)).toBeLessThan(0.5);
  });

  it("il 50% resta 50%: nessun lato viene favorito", () => {
    expect(applyTennisTemperature(0.5)).toBeCloseTo(0.5, 10);
  });

  it("p e il complemento restano complementari (somma 1)", () => {
    for (const p of [0.55, 0.62, 0.74, 0.88, 0.93]) {
      expect(applyTennisTemperature(p) + applyTennisTemperature(1 - p)).toBeCloseTo(1, 10);
    }
  });

  it("MONOTONA: non puo' mai invertire il favorito", () => {
    // Il lato si sceglie PRIMA. Se non fosse monotona, correggerebbe DI CHI
    // siamo sicuri invece di QUANTO.
    let prec = -1;
    for (let p = 0.01; p < 0.99; p += 0.01) {
      const out = applyTennisTemperature(p);
      expect(out).toBeGreaterThan(prec);
      prec = out;
      if (p > 0.5) expect(out).toBeGreaterThan(0.5);
      if (p < 0.5) expect(out).toBeLessThan(0.5);
    }
  });

  it("a tau = 1.0 e' l'identita' esatta (la leva di rollback)", () => {
    for (const p of [0.3, 0.5, 0.77]) {
      expect(applyTennisTemperature(p, 1.0)).toBe(p);
    }
  });

  it("estremi e valori impossibili passano invariati, senza NaN", () => {
    for (const p of [0, 1, -0.5, 1.5, Number.POSITIVE_INFINITY]) {
      expect(applyTennisTemperature(p)).toBe(p);
    }
    expect(Number.isNaN(applyTennisTemperature(Number.NaN))).toBe(true);
  });

  it("un tau invalido non altera nulla invece di produrre NaN", () => {
    for (const cattivo of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(applyTennisTemperature(0.7, cattivo)).toBe(0.7);
    }
  });
});
