import { describe, it, expect } from "vitest";
import { wilson95, formatWilson } from "./wilson";

describe("wilson95", () => {
  it("non esce MAI da [0,1], nemmeno a p=1 su campione minimo", () => {
    // È il motivo per cui non usiamo l'intervallo normale: qui darebbe
    // 100% ± 0 su n=1 e 100%+x su n piccoli, cioè un numero impubblicabile.
    for (const [s, n] of [[1, 1], [4, 4], [0, 1], [0, 5], [9, 10], [1, 3]]) {
      const w = wilson95(s, n)!;
      expect(w.low).toBeGreaterThanOrEqual(0);
      expect(w.high).toBeLessThanOrEqual(1);
      expect(w.low).toBeLessThanOrEqual(w.high);
    }
  });

  it("stringe l'intervallo al crescere del campione, a proporzione uguale", () => {
    const piccolo = wilson95(3, 4)!;
    const grande = wilson95(750, 1000)!;
    expect(piccolo.p).toBeCloseTo(grande.p, 10); // entrambi 75%
    const ampiezza = (w: { low: number; high: number }) => w.high - w.low;
    expect(ampiezza(piccolo)).toBeGreaterThan(ampiezza(grande) * 5);
  });

  it("il valore osservato sta dentro l'intervallo", () => {
    const w = wilson95(1054, 1616)!; // il nostro numero reale del 10/09
    expect(w.p).toBeGreaterThan(w.low);
    expect(w.p).toBeLessThan(w.high);
    expect(w.p).toBeCloseTo(0.6523, 3);
  });

  it("sul campione reale l'intervallo è di ±2,3 punti circa", () => {
    const w = wilson95(1054, 1616)!;
    expect((w.high - w.low) * 100).toBeGreaterThan(3);
    expect((w.high - w.low) * 100).toBeLessThan(6);
  });

  it("rifiuta input impossibili invece di inventare un numero", () => {
    expect(wilson95(0, 0)).toBeNull();
    expect(wilson95(5, 4)).toBeNull();
    expect(wilson95(-1, 10)).toBeNull();
    expect(wilson95(NaN, 10)).toBeNull();
    expect(wilson95(1, Infinity)).toBeNull();
  });

  it("formatWilson pubblica percentuale E intervallo, mai la nuda", () => {
    expect(formatWilson(wilson95(1054, 1616))).toMatch(
      /^65\.2% \(6\d\.\d–6\d\.\d%\)$/
    );
    expect(formatWilson(null)).toBeNull();
  });
});
