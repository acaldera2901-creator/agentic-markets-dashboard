import { describe, it, expect } from "vitest";
import { compareUnlockedFirst } from "./board-order";

// La regola che rende visibile ciò che un piano gated ha davvero comprato.
// Senza, la board ordina per orario e le righe aperte finiscono sparse: misurato
// su produzione, con 3 sbloccate su 15, la prima era la sesta scheda.

const r = (locked: boolean, id = "x") => ({ locked, id });

describe("compareUnlockedFirst (#UNLOCKED-FIRST-0831)", () => {
  it("la sbloccata precede la coperta, in entrambi i versi", () => {
    expect(compareUnlockedFirst(r(false), r(true))).toBeLessThan(0);
    expect(compareUnlockedFirst(r(true), r(false))).toBeGreaterThan(0);
  });

  it("stessa parte del confine → 0, così decide il criterio successivo", () => {
    expect(compareUnlockedFirst(r(true), r(true))).toBe(0);
    expect(compareUnlockedFirst(r(false), r(false))).toBe(0);
  });

  it("`locked` assente vale come sbloccata (le righe aperte non portano il flag)", () => {
    expect(compareUnlockedFirst({}, r(true))).toBeLessThan(0);
    expect(compareUnlockedFirst({}, {})).toBe(0);
  });

  it("una board free: le 3 aperte salgono in testa, l'ordine interno non cambia", () => {
    // le sbloccate arrivano sparse, come le serve la board ordinata per orario
    const board = [
      r(true, "a"), r(true, "b"), r(true, "c"), r(false, "APERTA-1"),
      r(true, "d"), r(false, "APERTA-2"), r(true, "e"), r(false, "APERTA-3"),
    ];
    const ordinata = [...board].sort(compareUnlockedFirst).map((x) => x.id);
    expect(ordinata.slice(0, 3)).toEqual(["APERTA-1", "APERTA-2", "APERTA-3"]);
    // e fra le coperte l'ordine di partenza resta (sort stabile in ES2019+)
    expect(ordinata.slice(3)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("board tutta aperta (Pro) o tutta coperta (anonimo): nessun riordino", () => {
    const pro = [r(false, "1"), r(false, "2"), r(false, "3")];
    expect([...pro].sort(compareUnlockedFirst).map((x) => x.id)).toEqual(["1", "2", "3"]);
    const anon = [r(true, "1"), r(true, "2"), r(true, "3")];
    expect([...anon].sort(compareUnlockedFirst).map((x) => x.id)).toEqual(["1", "2", "3"]);
  });
});
