// lib/tools/save-state.test.ts — #TOOLS-SAVE-0810
// Il corpo della POST /api/tools/saves arriva da un browser: parseSaveState è
// l'unico punto in cui si decide che forma ha. Qui si verifica che rifiuti, non
// che accetti — un validatore che dice sempre sì è peggio di nessun validatore.

import { describe, it, expect } from "vitest";
import {
  MAX_INPUTS,
  MAX_INPUT_LEN,
  MAX_SUMMARY_LEN,
  parseSaveState,
  parseSummary,
} from "./save-state";

describe("parseSaveState", () => {
  it("accetta la forma attesa e la restituisce normalizzata", () => {
    expect(parseSaveState({ inputs: ["2.50", "55"], groups: [0, -1] })).toEqual({
      inputs: ["2.50", "55"],
      groups: [0, -1],
    });
  });

  it("accetta un calcolatore senza segmentati (groups vuoto)", () => {
    expect(parseSaveState({ inputs: ["1.90"], groups: [] })).toEqual({
      inputs: ["1.90"],
      groups: [],
    });
  });

  it("ignora le chiavi in più invece di propagarle nel JSONB", () => {
    const out = parseSaveState({ inputs: ["1"], groups: [], evil: "DROP TABLE" });
    expect(out).toEqual({ inputs: ["1"], groups: [] });
  });

  for (const [label, value] of [
    ["null", null],
    ["una stringa", "inputs=1"],
    ["un array al posto dell'oggetto", [["1"]]],
    ["inputs mancante", { groups: [] }],
    ["groups mancante", { inputs: ["1"] }],
    ["inputs non array", { inputs: "1", groups: [] }],
    ["inputs vuoto", { inputs: [], groups: [] }],
    ["un input non stringa", { inputs: [1.9], groups: [] }],
    ["un input troppo lungo", { inputs: ["9".repeat(MAX_INPUT_LEN + 1)], groups: [] }],
    ["troppi input", { inputs: Array(MAX_INPUTS + 1).fill("1"), groups: [] }],
    ["troppi gruppi", { inputs: ["1"], groups: [0, 0, 0, 0, 0, 0, 0] }],
    ["un indice di gruppo non intero", { inputs: ["1"], groups: [0.5] }],
    ["un indice di gruppo sotto -1", { inputs: ["1"], groups: [-2] }],
    ["un indice di gruppo assurdo", { inputs: ["1"], groups: [999] }],
    ["un indice di gruppo NaN", { inputs: ["1"], groups: [Number.NaN] }],
  ] as [string, unknown][]) {
    it(`rifiuta ${label}`, () => {
      expect(parseSaveState(value)).toBeNull();
    });
  }
});

describe("parseSummary", () => {
  it("collassa gli spazi e taglia alla lunghezza massima", () => {
    expect(parseSummary("  40.00%   ·  Implied\nprobability ")).toBe("40.00% · Implied probability");
    expect(parseSummary("x".repeat(MAX_SUMMARY_LEN + 40))).toHaveLength(MAX_SUMMARY_LEN);
  });

  it("rifiuta il vuoto e ciò che non è una stringa", () => {
    expect(parseSummary("")).toBeNull();
    expect(parseSummary("   \n ")).toBeNull();
    expect(parseSummary(42)).toBeNull();
    expect(parseSummary(null)).toBeNull();
  });
});
