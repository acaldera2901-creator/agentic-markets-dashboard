import { describe, it, expect } from "vitest";
import { CASEA_GEO_URLS, GEO_LANDING_PARTNERS, LANDING_PARTNERS, geoUrlsOf, landingPartnersFor } from "@/lib/affiliate";

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

  // #PARTNERS-N1-0915 → #GEO-PARTNERS-ALWAYS-0917 (17/09, Andrea) — questi quattro
  // hanno UN link valido ovunque, non un link per paese come Casea: le `geos` erano
  // il perimetro COMMERCIALE del deal, e Andrea l'ha tolto. Il test che presidiava
  // l'esclusione fuori NO+DACH ora presidia l'opposto — la stessa invariante di
  // Beazt/Wildz: chi ha un link neutro sta nel menu in ogni geo, anche ignota.
  it("i partner a link unico compaiono in OGNI geo, con l'unico link della rete", () => {
    for (const cc of ["NO", "DE", "AT", "CH", "IT", "ES", "FI", "CA", "GB", "", null, undefined]) {
      for (const p of GEO_LANDING_PARTNERS) {
        const found = landingPartnersFor(cc).find((x) => x.name === p.name);
        expect(found, `${p.name} manca in ${String(cc)}`).toBeDefined();
        expect(found?.url).toBe(p.url);
      }
    }
  });

  // Il caso della richiesta di Andrea, scritto per nome: una geo mai coperta dal deal
  // deve vedere tutti e quattro nel menu.
  it("in IT e ES ci sono RollXO, Hollywin, N1 Bet, Stonevegas", () => {
    for (const cc of ["IT", "ES"]) {
      expect(namesIn(cc)).toEqual(expect.arrayContaining(["RollXO", "Hollywin", "N1 Bet", "Stonevegas"]));
    }
  });

  // `geoUrls` in lib/partners è derivato da qui. #GEO-PARTNERS-ALWAYS-0917: da oggi
  // le due superfici DIVERGONO di proposito — il menu li mostra ovunque, la vetrina
  // /partners resta sul perimetro del deal finché Andrea non decide anche per quella.
  // `geos` è la fonte di quella seconda superficie e deve restare esatta.
  it("geoUrlsOf copre esattamente le geo del deal, con lo stesso url", () => {
    for (const p of GEO_LANDING_PARTNERS) {
      expect(Object.keys(geoUrlsOf(p.name)).sort()).toEqual([...p.geos].sort());
      expect(new Set(Object.values(geoUrlsOf(p.name)))).toEqual(new Set([p.url]));
    }
    expect(geoUrlsOf("Nessuno")).toEqual({});
  });

  // #GEO-PARTNERS-ALWAYS-0917: l'unica voce che ancora dipende dalla geo è Casea.
  // Tutto il resto è una costante: fisse + quelle a link unico, in ogni paese.
  it("non duplica né perde voci: NO = fisse + link-unico + Casea, IT = fisse + link-unico", () => {
    const base = LANDING_PARTNERS.length + GEO_LANDING_PARTNERS.length;
    expect(landingPartnersFor("NO")).toHaveLength(base + 1);
    expect(landingPartnersFor("AT")).toHaveLength(base);
    expect(landingPartnersFor("IT")).toHaveLength(base);
    expect(landingPartnersFor("")).toHaveLength(base);
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
