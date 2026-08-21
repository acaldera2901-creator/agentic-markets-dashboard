import { describe, it, expect } from "vitest";
import { teamNeedleFromSlug, teamSlug, canonTeamSlug } from "./world-cup";

// #WC-SLUG-ROT-0821 — due pagine squadra del Mondiale rispondevano 404 a un
// utente che le cliccava dal hub. Trovate strisciando i link interni di
// produzione: 2 rotti su 94. Le cause erano opposte fra loro.
describe("slug delle squadre del Mondiale", () => {
  it("cape-verde NON deve essere aliasato: il dataset dice 'Cape Verde'", () => {
    // L'alias puntava a "cabo verde" — la vecchia grafia del dataset. Da quando
    // il dataset dice "Cape Verde", l'alias faceva cercare un nome inesistente.
    expect(teamNeedleFromSlug("cape-verde")).toBe("cape verde");
  });

  it("congo-dr deve essere aliasato: ESPN dice 'Congo DR', il dataset 'DR Congo'", () => {
    expect(teamNeedleFromSlug("congo-dr")).toBe("dr congo");
  });

  it("gli altri sette alias restano quelli verificati a DB", () => {
    expect(teamNeedleFromSlug("turkiye")).toBe("turkey");
    expect(teamNeedleFromSlug("bosnia-herzegovina")).toBe("bosnia and herzegovina");
    expect(teamNeedleFromSlug("czechia")).toBe("czech republic");
    expect(teamNeedleFromSlug("curacao")).toBe("curaçao");
    expect(teamNeedleFromSlug("usa")).toBe("united states");
    expect(teamNeedleFromSlug("korea-republic")).toBe("south korea");
    expect(teamNeedleFromSlug("ir-iran")).toBe("iran");
  });

  it("uno slug senza alias diventa il nome con gli spazi", () => {
    expect(teamNeedleFromSlug("costa-rica")).toBe("costa rica");
  });

  it("i metacaratteri LIKE dell'URL restano scappati", () => {
    // senza escape, /world-cup/a%25 diventerebbe un jolly su squadre casuali
    expect(teamNeedleFromSlug("a%_b")).toBe("a\\%\\_b");
  });

  it("teamSlug e canonTeamSlug restano coerenti sui casi aliasati", () => {
    expect(teamSlug("DR Congo")).toBe("dr-congo");
    expect(canonTeamSlug("Congo DR")).toBe("dr-congo");
    expect(canonTeamSlug("USA")).toBe("united-states");
  });
});
