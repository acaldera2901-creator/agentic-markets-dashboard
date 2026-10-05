import { describe, expect, it } from "vitest";
import { V3C_DARK, V3C_LIGHT, contrastRatio, flatten, hexToRgb } from "./tokens";

// Il «contrasto della carta» richiesto dal piano: ogni coppia testo/sfondo che
// il design system usa davvero, misurata. Soglie: 4.5:1 testo, 3:1 large/UI.
const TEXT = 4.5;
const LARGE = 3;

describe("v3c tokens — contrasto (WCAG 2.x)", () => {
  it("la formula è quella WCAG: bianco su nero 21:1, uguale 1:1", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
    expect(contrastRatio("#F3EDDC", "#F3EDDC")).toBe(1);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
  });

  describe("carta (light)", () => {
    const t = V3C_LIGHT;
    it.each([
      ["ink su paper", t.ink, t.paper, TEXT],
      ["ink-2 su paper", t.ink2, t.paper, TEXT],
      ["ink-3 su paper (fine print 12px)", t.ink3, t.paper, TEXT],
      ["ink su panel", t.ink, t.panel, TEXT],
      ["ink-2 su panel", t.ink2, t.panel, TEXT],
      ["sky (mercato) su paper", t.sky, t.paper, TEXT],
      ["sky su panel", t.sky, t.panel, TEXT],
      ["lime testo su paper", t.lime, t.paper, TEXT],
      ["royal come testo su paper", t.royalT, t.paper, TEXT],
      ["bianco su royal (CTA, tab)", t.royalInk, t.royal, TEXT],
      ["on-navy su navy (fascia)", t.onNavy, t.navy, TEXT],
      ["on-navy-2 su navy (meta fascia 13.5px)", t.onNavy2, t.navy, TEXT],
      ["ink su evidenziatore lime (stima)", t.limeMarkInk, t.limeHl, TEXT],
      ["paper su ink (sigillo)", t.paper, t.ink, TEXT],
      ["live su paper", t.live, t.paper, TEXT],
      ["LED lime su navy (bordo 4px, non testo)", t.limeHl, t.navy, LARGE],
      ["royal su paper (bordo tab attiva, UI)", t.royal, t.paper, LARGE],
      ["line-2 su paper (bordo cartellino, UI)", t.line2, t.paper, 1.5],
    ])("%s ≥ %d:1", (_label, fg, bg, min) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
    });
  });

  describe("scuro (dark)", () => {
    const t = V3C_DARK;
    it.each([
      ["ink su paper", t.ink, t.paper, TEXT],
      ["ink-2 su paper", t.ink2, t.paper, TEXT],
      ["ink-3 su paper", t.ink3, t.paper, TEXT],
      ["ink-3 su panel", t.ink3, t.panel, TEXT],
      ["sky su paper", t.sky, t.paper, TEXT],
      ["lime su paper", t.lime, t.paper, TEXT],
      ["royal-t su paper", t.royalT, t.paper, TEXT],
      ["bianco su royal", t.royalInk, t.royal, TEXT],
      ["on-navy su navy (fascia scura)", t.onNavy, t.navy, TEXT],
      ["on-navy-2 su navy", t.onNavy2, t.navy, TEXT],
      ["lime su velo lime 16% (stima)", t.limeMarkInk, flatten(t.limeHl, 0.16, t.paper), TEXT],
      ["paper (navy) su ink (sigillo)", t.paper, t.ink, TEXT],
      ["live su paper", t.live, t.paper, TEXT],
    ])("%s ≥ %d:1", (_label, fg, bg, min) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
    });
  });

  it("flatten: alpha 1 è il colore, alpha 0 è lo sfondo", () => {
    expect(flatten("#C8FF00", 1, "#071329")).toBe("#C8FF00");
    expect(flatten("#C8FF00", 0, "#071329")).toBe("#071329");
  });
});
