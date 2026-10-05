import { describe, expect, it } from "vitest";
import { monogramCode, monogramFor } from "./monogram";

describe("v3c monogramma (cartellino squadra)", () => {
  it("usa la sigla scelta a mano, in maiuscolo, se sta in tre lettere", () => {
    expect(monogramCode({ name: "Genoa", code: "gen" })).toBe("GEN");
    expect(monogramCode({ name: "Union Berlin", code: "UNB" })).toBe("UNB");
  });

  it("altrimenti la ricava dal nome con la stessa regola dei crest", () => {
    expect(monogramCode({ name: "Genoa" })).toBe("GEN");
    expect(monogramCode({ name: "Rayo Vallecano" })).toBe("RV");
    expect(monogramCode({ name: "Carlos Alcaraz" })).toBe("CA");
    expect(monogramCode({ name: "Genoa", code: "GENOA" })).toBe("GEN");
  });

  it("non è mai vuota", () => {
    expect(monogramCode({ name: "" })).toBe("—");
  });

  it("calcio: banda con i due colori, dichiarati da verificare", () => {
    const m = monogramFor({ name: "Genoa", code: "GEN", colours: ["#A31E25", "#0F2140"] });
    expect(m.band).toEqual({ kind: "colours", c1: "#A31E25", c2: "#0F2140", verified: false });
    expect(m.title).toBe("Genoa · club colours, to verify");
  });

  it("colori verificati: il tooltip è solo il nome", () => {
    const m = monogramFor({ name: "Genoa", colours: ["#A31E25", "#0F2140"], coloursVerified: true });
    expect(m.band.kind).toBe("colours");
    expect(m.title).toBe("Genoa");
  });

  it("colori non validi → banda neutra, mai un colore inventato", () => {
    const m = monogramFor({ name: "Genoa", colours: ["red", "#0F2140"] });
    expect(m.band).toEqual({ kind: "neutral" });
  });

  it("tennis: iniziali + nazione, nessuna banda colorata anche se ci sono colori", () => {
    const m = monogramFor({ name: "Carlos Alcaraz", nation: "esp", colours: ["#A31E25", "#0F2140"] });
    expect(m.code).toBe("CA");
    expect(m.band).toEqual({ kind: "nation", label: "ESP" });
    expect(m.title).toBe("Carlos Alcaraz · ESP");
  });
});
