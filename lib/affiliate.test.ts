import { describe, it, expect } from "vitest";
import { CASEA_GEO_URLS, LANDING_PARTNERS, landingPartnersFor } from "@/lib/affiliate";

// #PARTNERS-VELOBET-CASEA — questi sono i partner "solo landing" che finiscono nel
// menu "Piazza la scommessa" della scheda partita (football/tennis/World Cup).
// L'invariante che conta: un partner che ha un link SOLO per certe geo non deve
// mai comparire altrove, perché lì non avremmo un link da aprire.
describe("landingPartnersFor(country)", () => {
  const namesIn = (cc: string | null | undefined) => landingPartnersFor(cc).map((p) => p.name);

  it("le voci a link unico ci sono in ogni geo", () => {
    for (const cc of ["NO", "CH", "FI", "AT", "CA", ""]) {
      expect(namesIn(cc)).toEqual(expect.arrayContaining(["BetScore", "FeliceBet", "VeloBet", "GG.BET"]));
    }
  });

  // #PARTNER-GGBET — le reti affiliate consegnano i link con dei macro da sostituire
  // (`sub_id={sub_id_1}`, `click_id={clickid}`). Verificato con curl che il sub_id
  // finisce dentro il tag di attribuzione: incollato con le graffe, il partner
  // riceverebbe "{sub_id_1}" come sorgente. Nessun link deve contenerne.
  it("nessun link contiene macro della rete non risolti", () => {
    for (const p of landingPartnersFor("NO")) {
      expect(p.url, `${p.name} ha un macro non risolto`).not.toMatch(/[{}]|%7B|%7D/i);
    }
  });

  it("Casea compare solo in NO/CH/FI, col mid di quel paese", () => {
    for (const [cc, url] of Object.entries(CASEA_GEO_URLS)) {
      const casea = landingPartnersFor(cc).find((p) => p.name === "Casea");
      expect(casea, `Casea manca in ${cc}`).toBeDefined();
      expect(casea?.url).toBe(url);
    }
  });

  it("Casea NON compare in una geo senza link, né a geo ignota (fail-closed)", () => {
    for (const cc of ["AT", "IE", "DK", "CA", "GB", "", null, undefined]) {
      expect(namesIn(cc), `Casea non deve comparire in ${String(cc)}`).not.toContain("Casea");
    }
  });

  // #PARTNER-WILDZ-BEAZT — sono partner di sola vetrina: il link della rete
  // atterra sulla home del casinò, non sul prematch, quindi offrirli come
  // destinazione di "Piazza la scommessa" manderebbe l'utente nel posto sbagliato.
  // Vivono in PARTNERS (pagina /partners + footer) e NON in LANDING_PARTNERS.
  // Se la rete ci darà un link sportsbook, la voce entra lì e questo test cambia.
  it("Beazt e Wildz restano fuori dal menu piazza-scommessa (solo vetrina)", () => {
    for (const cc of ["NO", "CH", "AT", "CA", ""]) {
      expect(namesIn(cc), `Beazt non deve comparire nel menu (${cc})`).not.toContain("Beazt");
      expect(namesIn(cc), `Wildz non deve comparire nel menu (${cc})`).not.toContain("Wildz");
    }
  });

  it("non duplica né perde voci: geo coperta = fisse + 1, geo scoperta = fisse", () => {
    expect(landingPartnersFor("NO")).toHaveLength(LANDING_PARTNERS.length + 1);
    expect(landingPartnersFor("AT")).toHaveLength(LANDING_PARTNERS.length);
    expect(new Set(namesIn("NO")).size).toBe(namesIn("NO").length);
  });

  it("ogni voce ha un url https e un nome non vuoto", () => {
    for (const p of landingPartnersFor("CH")) {
      expect(p.url).toMatch(/^https:\/\//);
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  it("i nomi combaciano col catalogo loghi (partnerLogoByName risolve per nome)", async () => {
    const { partnerLogoByName } = await import("@/lib/partners");
    for (const p of landingPartnersFor("NO")) {
      expect(partnerLogoByName(p.name), `nessun logo per ${p.name}`).toMatch(/^\/logos\//);
    }
  });
});
