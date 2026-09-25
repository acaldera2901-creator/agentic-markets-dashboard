// lib/track-record-cutover.test.ts — #TRE-LIVELLI-0925-CUTOVER
//
// Quello che va provato rompendolo non e' la data: e' che una riga PRIMA del
// cutover non possa MAI finire sotto il gate nuovo, qualunque cosa succeda
// dopo (cambio di floor, ricalcolo, bug). Il cutover e' un confine nel tempo,
// non una soglia che si puo' aggirare con altri dati sulla riga.
import { describe, it, expect } from "vitest";
import {
  FOOTBALL_FLOOR_CUTOVER_AT,
  isBeforeFootballFloorCutover,
  outcomeTally,
} from "./track-record";

describe("isBeforeFootballFloorCutover", () => {
  it("una riga con starts_at prima del cutover e' PRIMA (regola vecchia)", () => {
    expect(isBeforeFootballFloorCutover("2026-09-01T12:00:00Z")).toBe(true);
  });

  it("una riga con starts_at dopo il cutover NON e' prima (regola nuova)", () => {
    expect(isBeforeFootballFloorCutover("2026-10-01T12:00:00Z")).toBe(false);
  });

  it("il cutover stesso conta come DOPO (il confine e' inclusivo per il gate nuovo)", () => {
    expect(isBeforeFootballFloorCutover(FOOTBALL_FLOOR_CUTOVER_AT)).toBe(false);
  });

  it("un istante prima del cutover resta PRIMA", () => {
    const unMillisecondoPrima = new Date(new Date(FOOTBALL_FLOOR_CUTOVER_AT).getTime() - 1).toISOString();
    expect(isBeforeFootballFloorCutover(unMillisecondoPrima)).toBe(true);
  });

  it("accetta anche un oggetto Date, non solo una stringa", () => {
    expect(isBeforeFootballFloorCutover(new Date("2026-09-01T00:00:00Z"))).toBe(true);
    expect(isBeforeFootballFloorCutover(new Date("2026-10-01T00:00:00Z"))).toBe(false);
  });

  it("fail-safe: starts_at assente o non parsabile resta PRIMA del cutover", () => {
    // Una riga di cui non si puo' leggere la data non deve poter essere
    // retroattivamente esclusa da un gate nuovo.
    expect(isBeforeFootballFloorCutover(null)).toBe(true);
    expect(isBeforeFootballFloorCutover(undefined)).toBe(true);
    expect(isBeforeFootballFloorCutover("non-una-data")).toBe(true);
  });
});

describe("outcomeTally", () => {
  it("conta solo le righe DECISE: void, pending e null non entrano", () => {
    const t = outcomeTally([
      { result: "won" }, { result: "won" }, { result: "lost" },
      { result: "void" }, { result: "pending" }, { result: null },
    ]);
    expect(t.n).toBe(3);
    expect(t.won).toBe(2);
    expect(t.lost).toBe(1);
  });

  it("sotto MIN_DECIDED_FOR_RATE la percentuale resta null", () => {
    const t = outcomeTally(Array.from({ length: 14 }, () => ({ result: "won" })));
    expect(t.win_rate).toBeNull();
  });

  it("raggiunta la soglia, la percentuale compare", () => {
    const t = outcomeTally(Array.from({ length: 15 }, () => ({ result: "won" })));
    expect(t.win_rate).toBe(100);
  });

  it("lista vuota: niente eccezione, tutto a zero", () => {
    expect(outcomeTally([])).toEqual({ n: 0, won: 0, lost: 0, win_rate: null });
  });
});
