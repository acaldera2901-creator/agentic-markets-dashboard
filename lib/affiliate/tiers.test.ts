// #AFFILIATE-TIERS-1021 — scala sui rinnovi: parsing fail-safe e posizione.
import { describe, it, expect } from "vitest";
import { DEFAULT_TIERS, parseTiers, payingReferredSql, renewalRateFor, tierFor } from "./tiers";

describe("parseTiers", () => {
  it("env assente o vuota → la scala di default (10 % da 5, 15 % da 15)", () => {
    expect(parseTiers(undefined)).toEqual([...DEFAULT_TIERS]);
    expect(parseTiers("  ")).toEqual([...DEFAULT_TIERS]);
    expect(DEFAULT_TIERS).toEqual([{ min: 5, rate: 0.1 }, { min: 15, rate: 0.15 }]);
  });

  it("none/off → nessuno scaglione (solo il tasso base)", () => {
    expect(parseTiers("none")).toEqual([]);
    expect(parseTiers(" OFF ")).toEqual([]);
  });

  it("una scala valida si legge così com'è", () => {
    expect(parseTiers("3:0.08, 10:0.12,25:0.2")).toEqual([
      { min: 3, rate: 0.08 },
      { min: 10, rate: 0.12 },
      { min: 25, rate: 0.2 },
    ]);
  });

  it("malformata, minimo 0, tasso > 1, non crescente → default, mai un valore inventato", () => {
    for (const bad of ["5:", "5:0.1,abc", "0:0.1", "5:1.5", "5:0.1,5:0.2", "5:0.2,10:0.1", "5;0.1"]) {
      expect(parseTiers(bad), bad).toEqual([...DEFAULT_TIERS]);
    }
  });
});

describe("tierFor / renewalRateFor", () => {
  const T = [...DEFAULT_TIERS];

  it("sotto il primo minimo: livello 0, tasso base, prossimo gradino = il primo", () => {
    expect(tierFor(0, 0.07, T)).toEqual({ level: 0, rate: 0.07, payingReferred: 0, next: { min: 5, rate: 0.1 } });
    expect(tierFor(4, 0.07, T)).toMatchObject({ level: 0, rate: 0.07, payingReferred: 4 });
  });

  it("al 5° referito pagante scatta il 10 %, al 15° il 15 %, poi nessun gradino successivo", () => {
    expect(tierFor(5, 0.07, T)).toEqual({ level: 1, rate: 0.1, payingReferred: 5, next: { min: 15, rate: 0.15 } });
    expect(tierFor(14, 0.07, T)).toMatchObject({ level: 1, rate: 0.1 });
    expect(tierFor(15, 0.07, T)).toEqual({ level: 2, rate: 0.15, payingReferred: 15, next: null });
    expect(renewalRateFor(99, 0.07, T)).toBe(0.15);
  });

  it("gli scaglioni alzano soltanto: un gradino sotto la base non la abbassa", () => {
    expect(renewalRateFor(10, 0.12, [{ min: 5, rate: 0.1 }])).toBe(0.12);
  });

  it("scala vuota → sempre il tasso base; conteggi negativi o NaN → 0", () => {
    expect(tierFor(50, 0.07, [])).toEqual({ level: 0, rate: 0.07, payingReferred: 50, next: null });
    expect(tierFor(-3, 0.07, T).payingReferred).toBe(0);
    expect(tierFor(Number.NaN, 0.07, T).payingReferred).toBe(0);
  });
});

describe("payingReferredSql", () => {
  it("in live le righe shadow NON contano; in shadow sì; reversed/void mai", () => {
    const live = payingReferredSql("live").sql;
    expect(live).toMatch(/COUNT\(DISTINCT referred_identifier\)/);
    expect(live).not.toMatch(/'shadow'/);
    expect(live).not.toMatch(/'reversed'|'void'/);
    expect(payingReferredSql("shadow").sql).toMatch(/'shadow'/);
    expect(live).toMatch(/affiliate_id = \$1/);
  });
});
