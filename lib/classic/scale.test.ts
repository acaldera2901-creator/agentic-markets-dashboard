// lib/classic/scale.test.ts — #CLASSIC-CARD-1008: i casi puri di betredge/v3c-fixq:lib/v3c/scale.test.ts (senza gapText/eur/signedPct, copy v3c non portato).
import { describe, expect, it } from "vitest";
import { describeScale, formatSigned, gapPp, isFlat, positionIn, scaleWindow } from "./scale";

describe("v3c nastro — scala a due punti", () => {
  it("Genoa 44/48 → finestra 30–60, tick ogni 5", () => {
    const w = scaleWindow(44, 48);
    expect(w).toEqual({ lo: 30, hi: 60, ticks: [30, 35, 40, 45, 50, 55, 60] });
  });

  it("resta dentro 0–100", () => {
    expect(scaleWindow(78, 75).hi).toBe(90);
    expect(scaleWindow(3, 5).lo).toBe(0);
    expect(scaleWindow(95, 98).hi).toBe(100);
  });

  it("mai più stretta di due passi", () => {
    const w = scaleWindow(50, 50, 0, 5);
    expect(w.hi - w.lo).toBe(10);
  });

  it("posizione lineare nella finestra, bloccata a 0–100", () => {
    const w = scaleWindow(44, 48);
    expect(positionIn(30, w)).toBe(0);
    expect(positionIn(45, w)).toBeCloseTo(50);
    expect(positionIn(60, w)).toBe(100);
    expect(positionIn(70, w)).toBe(100);
  });

  it("gap = stima − mercato; «in linea» sotto 1.5 pp", () => {
    expect(gapPp(44, 48)).toBe(4);
    expect(isFlat(gapPp(29, 28))).toBe(true);
    expect(isFlat(4)).toBe(false);
    expect(isFlat(-1.5)).toBe(false);
  });

  it("segno sempre scritto, meno U+2212, ±0", () => {
    expect(formatSigned(4)).toBe("+4");
    expect(formatSigned(-1)).toBe("−1");
    expect(formatSigned(0)).toBe("±0");
    expect(formatSigned(3.25)).toBe("+3.3");
    expect(formatSigned(-2.5, 2)).toBe("−2.50");
  });

  it("zero negativo: il segno si decide dopo l'arrotondamento (mai «−0.0»)", () => {
    expect(formatSigned(0, 1)).toBe("±0.0");
    expect(formatSigned(-0, 1)).toBe("±0.0");
    expect(formatSigned(-0.04, 1)).toBe("±0.0");
    expect(formatSigned(0.04, 1)).toBe("±0.0");
    expect(formatSigned(-0.05, 1)).toBe("−0.1");
    expect(formatSigned(-0.5, 1)).toBe("−0.5");
    expect(formatSigned(-0.004)).toBe("±0.0");
  });

  it("descrizione accessibile completa", () => {
    expect(describeScale(44, 48)).toBe("Market 44 percent, estimate 48 percent, gap +4 points. Scale 30 to 60 percent.");
  });
});
