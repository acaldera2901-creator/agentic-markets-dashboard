import { describe, it, expect } from "vitest";
import { BET_MENU_ORDER, PARTNERS, PARTNERS_COPY, PARTNER_TAGLINES, partnerLogoByName, partnersFor, pickPartnersLang, sortBooksForMenu } from "@/lib/partners";
import { CASEA_FALLBACK_URL, CASEA_GEO_URLS, GEO_LANDING_PARTNERS } from "@/lib/affiliate";

const LANGS = ["it", "en", "es", "fr", "ru"] as const;

describe("partners catalog", () => {
  it("has exactly the approved partners, no Stake/Roobet", () => {
    const ids = PARTNERS.map((p) => p.id).sort();
    expect(ids).toEqual(["beazt", "betscore", "casea", "felicebet", "fortuneplay", "ggbet", "hollywin", "n1bet", "rollxo", "slotsbonus", "stonevegas", "velobet", "wildz", "ybets"]);
  });

  // #PARTNERS-NO-FEATURED (2026-07-29, Andrea): sono tutti partner, nessuno
  // sportsbook va in evidenza sopra gli altri. Sostituisce l'asserzione
  // precedente ("FortunePlay è l'unico featured").
  it("marks no partner as featured", () => {
    expect(PARTNERS.filter((p) => p.featured).map((p) => p.id)).toEqual([]);
  });

  // #PARTNER-FELICEBET: il logo può essere raster se è così che lo fornisce il
  // partner (felicebet.png) — l'invariante è che punti dentro /logos, non il formato.
  it("every partner has a logo in /logos, a valid category and a default https link", () => {
    for (const p of PARTNERS) {
      expect(p.logo).toMatch(/^\/logos\/.+\.(svg|png)$/);
      expect(["sportsbook", "casino"]).toContain(p.category);
      // #GEO-PARTNERS-ALWAYS-0917 — l'invariante era XOR (o `url` o `geoUrls`, mai
      // entrambi). Da oggi `url` è OBBLIGATORIO su tutti: nessun partner è più
      // geo-ristretto, quindi in ogni paese deve esserci un link da aprire.
      // `geoUrls` resta un affinamento facoltativo sopra `url`, non un'alternativa.
      expect(p.url, `${p.id} senza link di default`).toMatch(/^https:\/\//);
      for (const u of Object.values(p.geoUrls ?? {})) expect(u).toMatch(/^https:\/\//);
    }
  });

  // #GEO-PARTNERS-ALWAYS-0917 / #CASEA-ALWAYS-0917 (17/09, Andrea) — la vetrina
  // (/partners + riga loghi del footer) non nasconde più nessun partner per geo,
  // esattamente come il menu "Piazza la scommessa" dal giro precedente dello stesso
  // giorno. La geo decide solo QUALE link apre Casea, l'unica con un mid per paese.
  describe("partnersFor(country) — nessuno sparisce, la geo sceglie solo il link", () => {
    const idsIn = (cc: string | null | undefined) => partnersFor(cc).map((p) => p.id);

    it("mostra Casea col mid dedicato nei tre paesi che ce l'hanno", () => {
      for (const [cc, url] of Object.entries(CASEA_GEO_URLS)) {
        const casea = partnersFor(cc).find((p) => p.id === "casea");
        expect(casea, `Casea manca in ${cc}`).toBeDefined();
        expect(casea?.url).toBe(url);
      }
      // i 3 mid sono diversi tra loro: sono campagne SEO per paese, non un alias
      expect(new Set(Object.values(CASEA_GEO_URLS)).size).toBe(Object.keys(CASEA_GEO_URLS).length);
    });

    it("mostra Casea anche fuori da NO/CH/FI e a geo ignota, col fallback dichiarato", () => {
      for (const cc of ["AT", "IE", "DK", "CA", "us", "IT", "ES", "", null, undefined]) {
        const casea = partnersFor(cc).find((p) => p.id === "casea");
        expect(casea, `Casea manca in ${String(cc)}`).toBeDefined();
        expect(casea?.url, `fallback sbagliato in ${String(cc)}`).toBe(CASEA_FALLBACK_URL);
      }
    });

    it("il paese è case/space-insensitive (l'header arriva già ISO-2, ma non ci fidiamo)", () => {
      expect(partnersFor(" no ").find((p) => p.id === "casea")?.url).toBe(CASEA_GEO_URLS.NO);
      expect(partnersFor("no").find((p) => p.id === "casea")?.url).toBe(CASEA_GEO_URLS.NO);
    });

    // Il caso della richiesta di Andrea scritto per nome: una geo mai coperta dal
    // deal N1/Playfina vede in vetrina gli stessi partner di una coperta.
    it("la vetrina ha gli stessi id in ogni geo, IT ed ES comprese", () => {
      const atteso = PARTNERS.map((p) => p.id).sort();
      for (const cc of ["NO", "DE", "AT", "CH", "FI", "IT", "ES", "CA", "GB", "", null, undefined]) {
        expect(idsIn(cc).sort(), `elenco diverso in ${String(cc)}`).toEqual(atteso);
      }
    });

    it("i quattro ex NO+DACH sono in vetrina in ogni geo, con l'unico link della rete", () => {
      for (const cc of ["IT", "ES", "CA", ""]) {
        for (const p of GEO_LANDING_PARTNERS) {
          const found = partnersFor(cc).find((x) => x.name === p.name);
          expect(found, `${p.name} manca in vetrina (${cc})`).toBeDefined();
          expect(found?.url, `${p.name} con un link diverso dal menu (${cc})`).toBe(p.url);
        }
      }
    });

    it("ogni partner risolto ha un url https (niente stringhe vuote in uscita)", () => {
      for (const cc of ["NO", "IT", ""]) {
        for (const p of partnersFor(cc)) expect(p.url, `${p.id} in "${cc}"`).toMatch(/^https:\/\//);
      }
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
