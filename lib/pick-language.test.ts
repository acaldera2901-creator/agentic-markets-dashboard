import { describe, it, expect } from "vitest";
import { pickLanguage } from "./pick-language";

const PARLATE = ["en", "it", "es", "fr", "ru"];

describe("pickLanguage", () => {
  it("prende la prima preferenza che l'app parla", () => {
    expect(pickLanguage(["it-IT", "en-US"], PARLATE)).toBe("it");
  });

  it("salta le lingue che l'app non parla", () => {
    expect(pickLanguage(["nl-NL", "de-DE", "fr-FR"], PARLATE)).toBe("fr");
  });

  it("normalizza la regione e il maiuscolo", () => {
    expect(pickLanguage(["ES-419"], PARLATE)).toBe("es");
  });

  it("ripiega su en se nessuna preferenza è parlata", () => {
    expect(pickLanguage(["zh-CN", "ja"], PARLATE)).toBe("en");
  });

  it("ripiega su en con lista vuota o valori sporchi", () => {
    expect(pickLanguage([], PARLATE)).toBe("en");
    expect(pickLanguage(["", "  ", "-"], PARLATE)).toBe("en");
  });
});
