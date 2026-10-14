// #SPLIT-0201 — la riga di scomposizione del totale per fonte.
import { it, expect } from "vitest";
import { sourceBreakdownLine } from "./track-record-copy";

const b = { model: { winRate: "75.0%", n: 40 }, partner: { winRate: "57.1%", n: 35 } };

it("modello e partner, ciascuno con la sua percentuale e la sua n", () => {
  expect(sourceBreakdownLine("it", b)).toBe("Modello: 75.0% su 40 · Quote di mercato del partner: 57.1% su 35");
  expect(sourceBreakdownLine("en", b)).toBe("Model: 75.0% on 40 · Partner market prices: 57.1% on 35");
  expect(sourceBreakdownLine("fr", b)).toBe("Modèle : 75.0% sur 40 · Cotes de marché du partenaire : 57.1% sur 35");
  for (const l of ["es", "ru"]) {
    const s = sourceBreakdownLine(l, b);
    expect(s).toContain("75.0%");
    expect(s).toContain("57.1%");
  }
  expect(sourceBreakdownLine("xx", b)).toBe(sourceBreakdownLine("en", b));
});

it("sotto soglia: solo il numero di pick; partner senza pick: non compare", () => {
  expect(sourceBreakdownLine("it", { model: b.model, partner: { winRate: null, n: 3 } }))
    .toBe("Modello: 75.0% su 40 · Quote di mercato del partner: 3 pick");
  expect(sourceBreakdownLine("en", { model: b.model, partner: { winRate: null, n: 0 } }))
    .toBe("Model: 75.0% on 40");
});

// #COPY-LEDGER-1007 — la nota sul cambio di popolazione, solo a flag acceso.
import { sealedCohortFrom, sealedPopulationNote } from "./track-record-copy";
import { sealedGradingConfig } from "./ledger-sealed-grading";

const ON = sealedGradingConfig({ LEDGER_SEALED_GRADING: "1", LEDGER_SEALED_FROM: "2026-10-26T00:00:00Z" });
const statsOn = { sealed_grading: { from: ON.from } };

it("flag spento (o data illeggibile): nessuna nota", () => {
  for (const env of [{}, { LEDGER_SEALED_GRADING: "1" }, { LEDGER_SEALED_GRADING: "1", LEDGER_SEALED_FROM: "domani" },
    { LEDGER_SEALED_GRADING: "0", LEDGER_SEALED_FROM: "2026-10-26T00:00:00Z" }]) {
    const cfg = sealedGradingConfig(env);
    // la route emette sealed_grading solo con cfg.enabled && cfg.from
    const stats = cfg.enabled && cfg.from ? { sealed_grading: { from: cfg.from } } : {};
    for (const l of ["it", "en", "es", "fr", "ru"]) expect(sealedPopulationNote(l, stats)).toBeNull();
  }
  expect(sealedPopulationNote("it", null)).toBeNull();
  expect(sealedPopulationNote("it", { sealed_grading: { from: "non-una-data" } })).toBeNull();
  expect(sealedCohortFrom(undefined)).toBeNull();
});

it("flag acceso: il testo approvato in italiano, con la data da LEDGER_SEALED_FROM", () => {
  expect(sealedPopulationNote("it", statsOn)).toBe(
    "Dal 26/10/2026 il track record conta solo le pick registrate prima del calcio d'inizio e le valuta su quella pick. Le pick mostrate senza registrazione, quasi tutte sotto soglia, non entrano più nel conteggio: per questo la percentuale non è confrontabile con il periodo precedente.",
  );
});

it("flag acceso: ogni lingua ha la sua data e il suo testo", () => {
  expect(sealedPopulationNote("en", statsOn)).toMatch(/^From 26 October 2026, the track record only counts picks recorded before kick-off/);
  expect(sealedPopulationNote("es", statsOn)).toMatch(/^Desde el 26 de octubre de 2026, el track record solo cuenta/);
  expect(sealedPopulationNote("fr", statsOn)).toMatch(/^À partir du 26 octobre 2026, le track record ne compte que/);
  expect(sealedPopulationNote("ru", statsOn)).toMatch(/^С 26 октября 2026 г\. track record учитывает только/);
  // la data segue la variabile, non e' scritta nel testo
  expect(sealedPopulationNote("it", { sealed_grading: { from: "2026-11-03T00:00:00.000Z" } })).toMatch(/^Dal 03\/11\/2026 /);
  // lingua sconosciuta → inglese; ISO diretto accettato
  expect(sealedPopulationNote("xx", statsOn)).toBe(sealedPopulationNote("en", statsOn));
  expect(sealedPopulationNote("it", ON.from!)).toBe(sealedPopulationNote("it", statsOn));
});
