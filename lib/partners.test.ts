import { describe, it, expect } from "vitest";
import { PARTNERS, PARTNERS_COPY, PARTNER_TAGLINES, pickPartnersLang } from "@/lib/partners";

const LANGS = ["it", "en", "es", "fr", "ru"] as const;

describe("partners catalog", () => {
  it("has exactly the approved partners, no Stake/Roobet", () => {
    const ids = PARTNERS.map((p) => p.id).sort();
    expect(ids).toEqual(["betscore", "felicebet", "fortuneplay", "slotsbonus", "ybets"]);
  });

  // #PARTNERS-NO-FEATURED (2026-07-29, Andrea): sono tutti partner, nessuno
  // sportsbook va in evidenza sopra gli altri. Sostituisce l'asserzione
  // precedente ("FortunePlay è l'unico featured").
  it("marks no partner as featured", () => {
    expect(PARTNERS.filter((p) => p.featured).map((p) => p.id)).toEqual([]);
  });

  // #PARTNER-FELICEBET: il logo può essere raster se è così che lo fornisce il
  // partner (felicebet.png) — l'invariante è che punti dentro /logos, non il formato.
  it("every partner has a non-empty https url, a logo in /logos and a valid category", () => {
    for (const p of PARTNERS) {
      expect(p.url).toMatch(/^https:\/\//);
      expect(p.logo).toMatch(/^\/logos\/.+\.(svg|png)$/);
      expect(["sportsbook", "casino"]).toContain(p.category);
    }
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
