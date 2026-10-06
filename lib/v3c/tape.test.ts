// lib/v3c/tape.test.ts (#REDESIGN-V3C fidelity) — il tape della board: solo catture vere.
import { describe, expect, it } from "vitest";
import { buildTape, stepSample } from "./tape";

const H = 3_600_000;
const pts = (vs: number[]) => vs.map((v, i) => ({ t: i * H, v }));

describe("tape della board", () => {
  it("meno di due catture: nessun tape (mai un punto d'apertura inventato)", () => {
    expect(buildTape(undefined, 0.5, 0)).toBeNull();
    expect(buildTape({ points: pts([2.1]) }, 0.5, 0)).toBeNull();
  });

  it("primo e ultimo prezzo sono quelli catturati; la stima diventa un prezzo equo", () => {
    const t = buildTape({ points: pts([2.02, 2.05, 2.15]) }, 0.48, 2 * H)!;
    expect(t.from).toBe(2.02);
    expect(t.to).toBe(2.15);
    expect(t.n).toBe(3);
    expect(t.fair).toBe(2.08);
    expect(t.fairT).toBe(100);
    expect(t.pts.map((p) => p[0])).toEqual([0, 50, 100]);
  });

  it("senza stima nostra (tennis «market price only»): nessuna linea della stima", () => {
    expect(buildTape({ points: pts([1.4, 1.42]) }, null, 0)!.fair).toBeNull();
  });

  it("il campionamento tiene prima e ultima cattura e non supera il massimo", () => {
    const many = pts(Array.from({ length: 200 }, (_, i) => 2 + (i % 7) / 100));
    const s = stepSample(many, 16);
    expect(s.length).toBeLessThanOrEqual(16);
    expect(s[0]).toEqual(many[0]);
    expect(s[s.length - 1]).toEqual(many[many.length - 1]);
    for (let i = 1; i < s.length; i++) expect(s[i].t).toBeGreaterThan(s[i - 1].t);
  });
});
