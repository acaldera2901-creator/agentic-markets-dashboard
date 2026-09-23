import { describe, expect, it } from "vitest";
import { crestInitials } from "./crest-initials";

describe("crestInitials", () => {
  it("una parola sola → le prime tre lettere", () => {
    expect(crestInitials("Arsenal")).toBe("ARS");
    expect(crestInitials("Inter")).toBe("INT");
  });

  it("più parole → una lettera per parola, massimo tre", () => {
    expect(crestInitials("Manchester United")).toBe("MU");
    expect(crestInitials("Paris Saint Germain")).toBe("PSG");
    expect(crestInitials("Borussia Monchengladbach")).toBe("BM");
  });

  it("scarta le sigle che non portano identità", () => {
    expect(crestInitials("FC Barcelona")).toBe("BAR");
    expect(crestInitials("AC Milan")).toBe("MIL");
    expect(crestInitials("Manchester City")).toBe("MC");
  });

  it("una sigla già maiuscola nel nome è l'identità", () => {
    expect(crestInitials("PSV Eindhoven")).toBe("PSV");
    expect(crestInitials("AZ Alkmaar")).toBe("AZ");
  });

  it("toglie i diacritici invece di perderli", () => {
    expect(crestInitials("Atlético Madrid")).toBe("AM");
    expect(crestInitials("Köln")).toBe("KOL");
  });

  it("i nomi di un tennista restano leggibili", () => {
    expect(crestInitials("Carlos Alcaraz")).toBe("CA");
    expect(crestInitials("Djokovic")).toBe("DJO");
  });

  it("niente da cui pescare → stringa vuota, non un placeholder inventato", () => {
    expect(crestInitials(null)).toBe("");
    expect(crestInitials("")).toBe("");
    expect(crestInitials("—")).toBe("");
  });

  it("Manchester United e Manchester City non collidono", () => {
    expect(crestInitials("Manchester United")).not.toBe(crestInitials("Manchester City"));
  });

  it("se TUTTE le parole sono rumore, si usa comunque il nome", () => {
    expect(crestInitials("FC AC")).toBe("FC");
  });

  it("è deterministica", () => {
    expect(crestInitials("Real Sociedad")).toBe(crestInitials("Real Sociedad"));
  });
});
