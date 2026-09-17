import { describe, it, expect } from "vitest";
import { CASEA_FALLBACK_URL, CASEA_GEO_URLS, GEO_LANDING_PARTNERS, LANDING_PARTNERS, landingPartnersFor, landingUrlOf } from "@/lib/affiliate";

// #PARTNERS-VELOBET-CASEA — questi sono i partner "solo landing" che finiscono nel
// menu "Piazza la scommessa" della scheda partita (football/tennis/World Cup).
// L'invariante era: chi ha un link SOLO per certe geo non compare altrove, perché
// lì non avremmo un link da aprire. Dal 17/09 è ROVESCIATA per decisione di Andrea
// (#GEO-PARTNERS-ALWAYS-0917 + #CASEA-ALWAYS-0917): ogni partner compare ovunque,
// e quella che resta è «esiste sempre un link vero da aprire, mai una voce morta».
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

  // #CASEA-ALWAYS-0917 (17/09, Andrea) — rovescia il fail-closed del 31/07. Casea
  // c'è ovunque; fuori dai suoi tre paesi apre il mid svizzero come FALLBACK
  // dichiarato. Il test presidia le due metà della decisione insieme: che la voce
  // ci sia, e che il link sia esattamente il fallback e non un mid a caso.
  it("Casea compare anche fuori NO/CH/FI e a geo ignota, col fallback dichiarato", () => {
    for (const cc of ["AT", "IE", "DK", "CA", "GB", "IT", "ES", "", null, undefined]) {
      const casea = landingPartnersFor(cc).find((p) => p.name === "Casea");
      expect(casea, `Casea manca in ${String(cc)}`).toBeDefined();
      expect(casea?.url, `fallback sbagliato in ${String(cc)}`).toBe(CASEA_FALLBACK_URL);
    }
    // il fallback è uno dei tre mid veri, non un URL inventato altrove
    expect(Object.values(CASEA_GEO_URLS)).toContain(CASEA_FALLBACK_URL);
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

  // #GEO-PARTNERS-ALWAYS-0917 (secondo giro, 17/09) — `landingUrlOf` sostituisce
  // `geoUrlsOf`: la vetrina /partners non filtra più per geo, quindi consuma il link
  // unico invece di una mappa cc→url. È la fonte di lib/partners: se divergesse, la
  // vetrina aprirebbe un link diverso da quello del menu piazza-scommessa.
  it("landingUrlOf dà l'unico link della rete, e undefined per un nome ignoto", () => {
    for (const p of GEO_LANDING_PARTNERS) expect(landingUrlOf(p.name)).toBe(p.url);
    expect(landingUrlOf("Nessuno")).toBeUndefined();
  });

  // #GEO-PARTNERS-ALWAYS-0917 + #CASEA-ALWAYS-0917: da oggi NESSUNA voce dipende
  // dalla geo per esistere — la geo decide solo QUALE link apre Casea. L'elenco ha
  // la stessa lunghezza in ogni paese, ed è la richiesta di Andrea scritta in numeri.
  it("stesso numero di voci in ogni geo: fisse + link-unico + Casea", () => {
    const atteso = LANDING_PARTNERS.length + GEO_LANDING_PARTNERS.length + 1;
    for (const cc of ["NO", "CH", "FI", "AT", "DE", "IT", "ES", "CA", "GB", "", null, undefined]) {
      expect(landingPartnersFor(cc), `lunghezza diversa in ${String(cc)}`).toHaveLength(atteso);
      expect(new Set(namesIn(cc)).size, `doppioni in ${String(cc)}`).toBe(atteso);
    }
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
