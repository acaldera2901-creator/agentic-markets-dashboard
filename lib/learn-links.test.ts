// lib/learn-links.test.ts (#SEO-ORPHANS-0908)
// L'elenco è statico per garantire che i link siano SEMPRE nell'HTML servito
// (vedi la nota lunga in learn-links.ts). Statico significa che nessuno lo
// controlla a runtime: lo controlla questo file.

import { describe, it, expect } from "vitest";
import { BLOG_INDEX, LEARN_GUIDES, LEARN_PILLARS, guideHref } from "./learn-links";
import { TOOL_SLUGS, isToolSlug } from "./tools/registry";

describe("learn-links", () => {
  it("copre le cinque guide orfane misurate l'08/09", () => {
    // Se una di queste sparisce, la home torna a linkare zero pagine con testo.
    expect(LEARN_GUIDES.map((g) => g.slug).sort()).toEqual(
      [
        "closing-line-value-explained",
        "finding-football-value-bets",
        "how-xg-affects-football-odds",
        "implied-probability-from-betting-odds",
        "positive-expected-value-betting-explained",
      ].sort()
    );
  });

  it("copre i due pillar di sport", () => {
    expect(LEARN_PILLARS.map((p) => p.href)).toEqual([
      "/ai-football-predictions",
      "/ai-tennis-predictions",
    ]);
  });

  it("non ha slug né termini duplicati", () => {
    expect(new Set(LEARN_GUIDES.map((g) => g.slug)).size).toBe(LEARN_GUIDES.length);
    expect(new Set(LEARN_GUIDES.map((g) => g.term)).size).toBe(LEARN_GUIDES.length);
  });

  it("ogni seeAlso punta a una rotta che esiste davvero", () => {
    // Il modo più facile di rompere questo file è scrivere a mano uno slug di
    // tool: /tools/kelly non esiste, /tools/kelly-criterion sì, e la differenza
    // non si vede finché qualcuno non ci clicca sopra.
    const pillars = new Set(LEARN_PILLARS.map((p) => p.href));
    for (const g of LEARN_GUIDES) {
      if (!g.seeAlso) continue;
      const href = g.seeAlso.href;
      if (href.startsWith("/tools/")) {
        const slug = href.slice("/tools/".length);
        expect(isToolSlug(slug), `${href} non è in TOOL_SLUGS`).toBe(true);
      } else {
        expect(pillars.has(href), `${href} non è un pillar noto`).toBe(true);
      }
      expect(g.seeAlso.label.length).toBeGreaterThan(3);
    }
  });

  it("la CLV resta senza seeAlso: nessun tool dell'hub fa quel conto", () => {
    // Non è una dimenticanza. Se un giorno nasce un calcolatore di CLV questo
    // test va aggiornato di proposito, non aggirato riempiendo la casella con
    // il tool più vicino per simmetria grafica.
    const clv = LEARN_GUIDES.find((g) => g.slug === "closing-line-value-explained")!;
    expect(clv.seeAlso).toBeUndefined();
    expect(TOOL_SLUGS.some((s) => s.includes("closing") || s.includes("clv"))).toBe(false);
  });

  it("guideHref compone il path pubblico del blog", () => {
    expect(BLOG_INDEX).toBe("/blog");
    expect(guideHref("x")).toBe("/blog/x");
  });
});
