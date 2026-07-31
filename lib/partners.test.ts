import { describe, it, expect } from "vitest";
import { PARTNERS, PARTNERS_COPY, PARTNER_TAGLINES, partnersFor, pickPartnersLang } from "@/lib/partners";
import { CASEA_GEO_URLS } from "@/lib/affiliate";

const LANGS = ["it", "en", "es", "fr", "ru"] as const;

describe("partners catalog", () => {
  it("has exactly the approved partners, no Stake/Roobet", () => {
    const ids = PARTNERS.map((p) => p.id).sort();
    expect(ids).toEqual(["betscore", "casea", "felicebet", "fortuneplay", "slotsbonus", "velobet", "ybets"]);
  });

  // #PARTNERS-NO-FEATURED (2026-07-29, Andrea): sono tutti partner, nessuno
  // sportsbook va in evidenza sopra gli altri. Sostituisce l'asserzione
  // precedente ("FortunePlay è l'unico featured").
  it("marks no partner as featured", () => {
    expect(PARTNERS.filter((p) => p.featured).map((p) => p.id)).toEqual([]);
  });

  // #PARTNER-FELICEBET: il logo può essere raster se è così che lo fornisce il
  // partner (felicebet.png) — l'invariante è che punti dentro /logos, non il formato.
  it("every partner has a logo in /logos, a valid category and exactly one link shape", () => {
    for (const p of PARTNERS) {
      expect(p.logo).toMatch(/^\/logos\/.+\.(svg|png)$/);
      expect(["sportsbook", "casino"]).toContain(p.category);
      // #PARTNERS-VELOBET-CASEA: o un link unico, o una mappa per paese — mai
      // entrambi (ambiguo su quale vince) e mai nessuno dei due (partner morto).
      expect(Boolean(p.url) !== Boolean(p.geoUrls)).toBe(true);
      for (const u of p.url ? [p.url] : Object.values(p.geoUrls ?? {})) {
        expect(u).toMatch(/^https:\/\//);
      }
    }
  });

  // #PARTNERS-VELOBET-CASEA — Casea ha SOLO i link per paese che ci ha dato il
  // partner (NO/CH/FI) e nessun link neutro: fuori da quelle geo non esiste.
  // Fail-closed anche su geo ignota, come tutto il resto del gate.
  describe("partnersFor(country) — partner geo-ristretti", () => {
    const idsIn = (cc: string | null | undefined) => partnersFor(cc).map((p) => p.id);

    it("mostra Casea solo nei paesi con un link dedicato, col link di quel paese", () => {
      for (const [cc, url] of Object.entries(CASEA_GEO_URLS)) {
        const casea = partnersFor(cc).find((p) => p.id === "casea");
        expect(casea, `Casea manca in ${cc}`).toBeDefined();
        expect(casea?.url).toBe(url);
      }
      // i 3 mid sono diversi tra loro: sono campagne SEO per paese, non un alias
      expect(new Set(Object.values(CASEA_GEO_URLS)).size).toBe(Object.keys(CASEA_GEO_URLS).length);
    });

    it("non mostra Casea in una geo senza link dedicato né a geo ignota", () => {
      for (const cc of ["AT", "IE", "DK", "CA", "us", "", null, undefined]) {
        expect(idsIn(cc), `Casea non deve comparire in ${String(cc)}`).not.toContain("casea");
      }
    });

    it("il paese è case/space-insensitive (l'header arriva già ISO-2, ma non ci fidiamo)", () => {
      expect(idsIn(" no ")).toContain("casea");
      expect(partnersFor("no").find((p) => p.id === "casea")?.url).toBe(CASEA_GEO_URLS.NO);
    });

    it("i partner NON geo-ristretti compaiono in ogni geo, VeloBet incluso", () => {
      const always = ["fortuneplay", "ybets", "betscore", "felicebet", "slotsbonus", "velobet"];
      for (const cc of ["NO", "AT", ""]) {
        for (const id of always) expect(idsIn(cc), `${id} manca in "${cc}"`).toContain(id);
      }
    });

    it("ogni partner risolto ha un url https (niente stringhe vuote in uscita)", () => {
      for (const p of partnersFor("NO")) expect(p.url).toMatch(/^https:\/\//);
    });
  });

  it("has page chrome copy in all 5 languages", () => {
    for (const l of LANGS) {
      expect(PARTNERS_COPY[l].title.length).toBeGreaterThan(0);
      expect(PARTNERS_COPY[l].subtitle.length).toBeGreaterThan(0);
      expect(PARTNERS_COPY[l].unavailableTitle.length).toBeGreaterThan(0);
    }
  });

  it("has a tagline for every partner in every language", () => {
    for (const p of PARTNERS) {
      for (const l of LANGS) {
        expect(PARTNER_TAGLINES[p.id]?.[l]?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("pickPartnersLang falls back to en for unknown languages", () => {
    expect(pickPartnersLang("de")).toBe("en");
    expect(pickPartnersLang("it")).toBe("it");
  });
});
