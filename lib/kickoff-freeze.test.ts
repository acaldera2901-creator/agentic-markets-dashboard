// #FREEZE-KICKOFF-0911 — i casi che contano sono i due bordi: una partita
// appena iniziata va congelata, e un ORARIO FINTO non deve congelare niente.
import { describe, it, expect } from "vitest";
import { pronosticoDaCongelare } from "./kickoff-freeze";

const ORA = Date.parse("2026-09-11T15:00:00Z");

describe("pronosticoDaCongelare", () => {
  it("partita gia' iniziata: si congela", () => {
    expect(pronosticoDaCongelare("2026-09-11T14:00:00Z", ORA)).toBe(true);
  });

  it("partita futura: si continua a ricalcolare", () => {
    expect(pronosticoDaCongelare("2026-09-11T16:00:00Z", ORA)).toBe(false);
  });

  it("l'istante esatto del fischio conta come iniziata", () => {
    expect(pronosticoDaCongelare("2026-09-11T15:00:00Z", ORA)).toBe(true);
  });

  it("un minuto prima NON e' iniziata", () => {
    expect(pronosticoDaCongelare("2026-09-11T15:01:00Z", ORA)).toBe(false);
  });

  it("il segnaposto T00:00:00 non congela MAI, nemmeno se e' nel passato", () => {
    // E' il caso che rende il guard pericoloso se scritto ingenuamente:
    // football-data usa mezzanotte quando l'orario e' ignoto (8 partite nella
    // finestra misurata), ed e' nel passato per quasi tutta la giornata.
    // Congelarla zittirebbe una partita che non e' ancora cominciata.
    expect(pronosticoDaCongelare("2026-09-11T00:00:00Z", ORA)).toBe(false);
    expect(pronosticoDaCongelare("2026-09-10T00:00:00Z", ORA)).toBe(false);
  });

  it("ma mezzanotte NON e' speciale se l'orario e' reale (secondi diversi)", () => {
    expect(pronosticoDaCongelare("2026-09-11T00:00:01Z", ORA)).toBe(true);
  });

  it("data illeggibile, vuota o assente: nessun congelamento (si resta a prima)", () => {
    for (const brutta of ["", "non-una-data", null, undefined]) {
      expect(pronosticoDaCongelare(brutta, ORA)).toBe(false);
    }
  });

  it("senza `adesso` esplicito usa l'ora corrente", () => {
    const fraUnOra = new Date(Date.now() + 3_600_000).toISOString();
    const unOraFa = new Date(Date.now() - 3_600_000).toISOString();
    expect(pronosticoDaCongelare(fraUnOra)).toBe(false);
    expect(pronosticoDaCongelare(unOraFa)).toBe(true);
  });
});
