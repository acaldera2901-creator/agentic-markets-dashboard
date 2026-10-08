// #CLASSIC-CARD-1008 — parità delle 11 lingue e lessico vietato (REGOLE-CLASSIC).
import { describe, expect, it } from "vitest";
import { CLASSIC_COPY, CLASSIC_LANGS, classicCopy, fill } from "./copy";

const BANNED = /guarantee|garantit|\block\b|sure win|easy money|crush the book|\btips?\b|hit rate|high edge|\+EV/i;

describe("classic copy", () => {
  it("11 lingue, ogni chiave presente e non vuota, stessi segnaposto dell'inglese", () => {
    expect(CLASSIC_LANGS).toHaveLength(11);
    const keys = Object.keys(CLASSIC_COPY.en) as (keyof typeof CLASSIC_COPY.en)[];
    for (const l of CLASSIC_LANGS) {
      const c = CLASSIC_COPY[l];
      expect(Object.keys(c).sort(), l).toEqual([...keys].sort());
      for (const k of keys) {
        expect(c[k].trim().length, `${l}.${k}`).toBeGreaterThan(0);
        const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
        expect(ph(c[k]), `${l}.${k}`).toBe(ph(CLASSIC_COPY.en[k]));
      }
    }
  });
  it("nessuna parola vietata", () => {
    for (const l of CLASSIC_LANGS) for (const v of Object.values(CLASSIC_COPY[l])) expect(BANNED.test(v), `${l}: ${v}`).toBe(false);
  });
  it("fallback inglese dichiarato per un codice sconosciuto", () => {
    expect(classicCopy("xx").ourEstimate).toBe("Our estimate");
    expect(classicCopy("it-IT").ourEstimate).toBe("La nostra stima");
    expect(fill(classicCopy("en").blendInfo, { m: 30, k: 70 })).toBe("Our estimate = 30% model + 70% market");
  });
});
