import { describe, it, expect } from "vitest";
import { renderEmbedHtml } from "@/app/embed/embed-html";
import type { EmbedRow } from "@/lib/embed-feed";

const rows: EmbedRow[] = [
  {
    id: "t1", sport: "tennis", competition: "ATP Cincinnati",
    homeTeam: "Sinner", awayTeam: "Alcaraz", startsAt: "2026-08-24T18:00:00Z",
    decision: "Vince Sinner", confidence: 74, locked: false, topPick: true,
  },
  {
    id: "t2", sport: "tennis", competition: "ATP Cincinnati",
    homeTeam: "Rune", awayTeam: "Zverev", startsAt: "2026-08-24T20:00:00Z",
    decision: null, confidence: null, locked: true, topPick: false,
  },
];

const render = (over: Partial<Parameters<typeof renderEmbedHtml>[0]> = {}) =>
  renderEmbedHtml({ rows, ref: "SERGIO", lang: "it", theme: "auto", host: "sito-partner.it", mode: "teaser", ...over });

describe("renderEmbedHtml", () => {
  it("mostra le partite servite", () => {
    const html = render();
    expect(html).toContain("Sinner");
    expect(html).toContain("Alcaraz");
    expect(html).toContain("ATP Cincinnati");
  });

  it("una riga bloccata non lascia trapelare la sua decisione", () => {
    const html = render({
      rows: [{ ...rows[1], decision: "Vince Rune", confidence: 66, locked: true }],
    });
    expect(html).not.toContain("Vince Rune");
    expect(html).not.toContain("66");
  });

  it("porta il ref del partner e gli utm su OGNI link", () => {
    const html = render();
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) {
      expect(l).toContain("ref=SERGIO");
      expect(l).toContain("utm_source=widget");
      expect(l).toContain("utm_medium=embed");
      expect(l).toContain("utm_campaign=sito-partner.it");
    }
  });

  it("senza un ref valido non inventa un'attribuzione", () => {
    const html = render({ ref: null });
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) {
      expect(l).not.toMatch(/[?&]ref=/);
      expect(l).toContain("utm_source=widget");
    }
  });

  it("mostra 18+ e la natura informativa, non in un tooltip", () => {
    const html = render();
    expect(html).toContain("18+");
    expect(html).toMatch(/scopo informativo/i);
  });

  it("non contiene claim di performance", () => {
    const html = render();
    expect(html).not.toMatch(/\d+%\s*(win rate|winning|vincite|accuracy|precisione)/i);
    expect(html).not.toMatch(/beat the market|battiamo il mercato|guarantee|garantit/i);
  });

  it("escapa i dati: un nome squadra ostile non diventa markup", () => {
    const html = render({
      rows: [{ ...rows[0], homeTeam: '<script>alert(1)</script>', decision: 'a"b' }],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("con zero righe resta una superficie utile invece di una card vuota", () => {
    const html = render({ rows: [] });
    expect(html).toMatch(/nessun|no match|betredge/i);
    expect(html).toContain("utm_source=widget");
  });

  it("dichiara l'altezza al parent per l'auto-resize", () => {
    expect(render()).toContain("postMessage");
  });
});
