// #WEEKLY-PICK-FOOTBALL-0910 — da quando il track record della weekly pick conta.
//
// Il 10/09 il prodotto è cambiato in modo sostanziale: 3 gambe invece di 5, e il
// calcio che torna candidabile (prima la sua probabilità si leggeva da un campo
// JSON vuoto su OGNI riga, quindi 8 schedine su 10 erano al 100% tennis per
// esclusione, non per scelta). Attribuire quelle settimane al prodotto attuale
// lo rappresenta male in entrambe le direzioni.
//
// LA REGOLA CHE QUESTI TEST DIFENDONO: si taglia per DATA, mai per esito.
// Mostrare alcune settimane scelte fra le passate produrrebbe una percentuale
// costruita — e le gambe di quelle settimane sono tutte in /api/v2/history,
// verificate una per una, quindi un track record che non torna con loro si
// smonta al primo controllo di chiunque.
import { describe, it, expect } from "vitest";
import { WEEKLY_PICK_TRACK_RECORD_FROM } from "./weekly-pick";

type Settimana = { week_start: string; outcome: "won" | "lost" | "live" };

/** Specchio del filtro in app/api/weekly-pick/history/route.ts. */
function visibili(tutte: Settimana[], settimanaCorrente: string): Settimana[] {
  return tutte.filter(
    (w) => w.week_start < settimanaCorrente && w.week_start >= WEEKLY_PICK_TRACK_RECORD_FROM
  );
}

// Le 10 settimane reali, con l'esito reale misurato il 10/09.
const STORICO: Settimana[] = [
  { week_start: "2026-09-07", outcome: "live" },
  { week_start: "2026-08-31", outcome: "won" },
  { week_start: "2026-08-24", outcome: "lost" },
  { week_start: "2026-08-17", outcome: "won" },
  { week_start: "2026-08-10", outcome: "lost" },
  { week_start: "2026-08-03", outcome: "lost" },
  { week_start: "2026-07-27", outcome: "won" },
  { week_start: "2026-07-20", outcome: "lost" },
  { week_start: "2026-07-13", outcome: "lost" },
  { week_start: "2026-07-06", outcome: "won" },
];

describe("il taglio dello storico", () => {
  it("nessuna settimana della regola vecchia e' visibile", () => {
    const v = visibili(STORICO, "2026-09-14");
    expect(v.every((w) => w.week_start >= "2026-09-07")).toBe(true);
    // Nessuna delle 9 settimane prodotte dalla regola a 5 gambe.
    expect(v.map((w) => w.week_start)).not.toContain("2026-07-06");
    expect(v.map((w) => w.week_start)).not.toContain("2026-08-31");
  });

  it("la settimana del cambio di regola E' visibile, una volta chiusa", () => {
    const v = visibili(STORICO, "2026-09-14");
    expect(v.map((w) => w.week_start)).toContain("2026-09-07");
  });

  it("la settimana CORRENTE non entra nello storico", () => {
    // Lo storico sono le settimane chiuse: la corrente sta nel riquadro in alto.
    expect(visibili(STORICO, "2026-09-07")).toHaveLength(0);
  });

  it("il taglio e' per DATA e non guarda l'esito", () => {
    // Il test che impedisce la cherry-pick: se si invertissero tutti gli esiti,
    // l'insieme visibile non deve cambiare di una riga.
    const invertito = STORICO.map((w) => ({
      ...w,
      outcome: (w.outcome === "won" ? "lost" : "won") as "won" | "lost",
    }));
    expect(visibili(invertito, "2026-09-14").map((w) => w.week_start))
      .toEqual(visibili(STORICO, "2026-09-14").map((w) => w.week_start));
  });

  it("non si mostra un sottoinsieme scelto delle settimane vecchie", () => {
    // La richiesta a cui questo test dice no: «tienine una vinta e una persa».
    // Due settimane su dieci scelte a mano pubblicano un 50% costruito.
    const v = visibili(STORICO, "2026-09-14");
    const vecchie = v.filter((w) => w.week_start < WEEKLY_PICK_TRACK_RECORD_FROM);
    expect(vecchie).toHaveLength(0);
  });

  it("la data di partenza e' quella del cambio di regola", () => {
    expect(WEEKLY_PICK_TRACK_RECORD_FROM).toBe("2026-09-07");
  });
});
