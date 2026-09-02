import { describe, it, expect } from "vitest";
import { BET_MENU_ORDER, PARTNERS, PARTNERS_COPY, PARTNER_TAGLINES, partnerLogoByName, partnersFor, pickPartnersLang, sortBooksForMenu } from "@/lib/partners";
import { CASEA_GEO_URLS } from "@/lib/affiliate";

const LANGS = ["it", "en", "es", "fr", "ru"] as const;

describe("partners catalog", () => {
  it("has exactly the approved partners, no Stake/Roobet", () => {
    const ids = PARTNERS.map((p) => p.id).sort();
    expect(ids).toEqual(["beazt", "betscore", "casea", "felicebet", "fortuneplay", "ggbet", "slotsbonus", "velobet", "wildz", "ybets"]);
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
      const always = ["fortuneplay", "ybets", "betscore", "felicebet", "slotsbonus", "velobet", "ggbet", "beazt", "wildz"];
      for (const cc of ["NO", "AT", ""]) {
        for (const id of always) expect(idsIn(cc), `${id} manca in "${cc}"`).toContain(id);
      }
    });

    it("ogni partner risolto ha un url https (niente stringhe vuote in uscita)", () => {
      for (const p of partnersFor("NO")) expect(p.url).toMatch(/^https:\/\//);
    });
  });

  // #BET-MENU-ORDER (2026-08-06, Andrea): ordine deciso da lui per il menu della
  // scheda prediction. I book arrivano da due fonti diverse e in ordine arbitrario
  // → l'ordine è una scelta di presentazione, applicata al render.
  describe("sortBooksForMenu — ordine del menu 'Piazza la scommessa'", () => {
    const names = (bs: { name: string }[]) => sortBooksForMenu(bs).map((b) => b.name);

    it("mette i partner nell'ordine deciso da Andrea, qualunque sia quello d'arrivo", () => {
      const arrivo = ["Wildz", "YBets", "GG.BET", "FortunePlay", "Beazt", "FeliceBet", "BetScore", "VeloBet"].map((name) => ({ name }));
      expect(names(arrivo)).toEqual(["FortunePlay", "BetScore", "VeloBet", "FeliceBet", "GG.BET", "YBets", "Beazt", "Wildz"]);
    });

    it("chi non è nell'ordine (Casea, geo-ristretta) va in coda senza sparire", () => {
      const bs = [{ name: "Casea" }, { name: "YBets" }, { name: "FortunePlay" }].map((b) => b);
      expect(names(bs)).toEqual(["FortunePlay", "YBets", "Casea"]);
    });

    it("più sconosciuti restano nell'ordine d'arrivo (sort stabile), tutti in coda", () => {
      const bs = [{ name: "Zeta" }, { name: "GG.BET" }, { name: "Alfa" }];
      expect(names(bs)).toEqual(["GG.BET", "Zeta", "Alfa"]);
    });

    it("non perde né duplica voci e non muta l'array in ingresso", () => {
      const bs = [{ name: "YBets" }, { name: "FortunePlay" }, { name: "Casea" }];
      const copia = [...bs];
      const out = sortBooksForMenu(bs);
      expect(out).toHaveLength(bs.length);
      expect(new Set(out.map((b) => b.name)).size).toBe(bs.length);
      expect(bs).toEqual(copia);
    });

    it("il match sul nome è case/space-insensitive (i nomi arrivano da fonti diverse)", () => {
      expect(names([{ name: "ybets" }, { name: " fortuneplay " }])).toEqual([" fortuneplay ", "ybets"]);
    });

    it("ogni partner del menu è nel catalogo loghi (l'ordine non inventa nomi)", () => {
      for (const n of BET_MENU_ORDER) expect(partnerLogoByName(n), `nessun logo per ${n}`).toMatch(/^\/logos\//);
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
