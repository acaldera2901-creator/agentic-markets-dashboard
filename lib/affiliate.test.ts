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
      expect(namesIn(cc)).toEqual(expect.arrayContaining(["BetScore", "FeliceBet", "VeloBet", "GG.BET", "Beazt", "Wildz"]));
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

  // #PARTNER-WILDZ-BEAZT (02/09, scelta di Andrea) — stanno nel menu "Piazza la
  // scommessa" di tutte e 3 le superfici (football/tennis desk + World Cup), che lo
  // costruiscono spargendo `landingPartnersFor(geoCountry)` nei `books`. Nessuna geo
  // li esclude: il link della rete è unico. Il test presidia la scelta perché il
  // loro link atterra sulla lobby del casinò e non sul prematch — cioè la ragione
  // per cui qualcuno, un domani, potrebbe pensare di togliermeli "per coerenza".
  it("Beazt e Wildz sono nel menu piazza-scommessa in ogni geo", () => {
    for (const cc of ["NO", "CH", "AT", "CA", "", null, undefined]) {
      expect(namesIn(cc), `Beazt manca nel menu (${String(cc)})`).toContain("Beazt");
      expect(namesIn(cc), `Wildz manca nel menu (${String(cc)})`).toContain("Wildz");
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
