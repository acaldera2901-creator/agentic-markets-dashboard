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

  // #WIDGET-BRAND-0828 — l'attribuzione è il prodotto del widget: se sul sito
  // del partner non si legge di chi sono le predizioni, il widget non serve.
  it("l'attribuzione è 'Powered by' + il logo del brand, non un glifo qualsiasi", () => {
    const html = render();
    expect(html).toContain("Powered by <b>betredge.com</b>");
    expect(html).toMatch(/<img[^>]+src="\/logos\/betredge-logo-(white|black)-48\.png"/);
    expect(html).toContain('alt="BetRedge"');
  });

  it("il dominio è scritto per esteso, non solo il marchio: è l'unica riga digitabile", () => {
    // su un sito di terzi un wordmark non si digita in una barra degli indirizzi
    expect(render()).toContain("betredge.com</b>");
  });

  it("scarica UNA sola variante del logo: a tema esplicito la scelta è già fatta qui", () => {
    const dark = render({ theme: "dark" });
    expect(dark).toContain("betredge-logo-white-48.png");
    expect(dark).not.toContain("betredge-logo-black-48.png");

    const light = render({ theme: "light" });
    expect(light).toContain("betredge-logo-black-48.png");
    expect(light).not.toContain("betredge-logo-white-48.png");
  });

  it("su tema auto la scelta la fa <picture>, non uno swap CSS su due <img>", () => {
    const html = render({ theme: "auto" });
    expect(html).toContain("<picture>");
    expect(html).toContain('media="(prefers-color-scheme: light)"');
    // una sola <img>: due significherebbe due download, uno dei quali sprecato
    expect([...html.matchAll(/<img /g)]).toHaveLength(1);
  });

  it("dichiara l'altezza al parent per l'auto-resize", () => {
    expect(render()).toContain("postMessage");
  });
});

describe("widget spento (#WIDGET-TRUTH-0824)", () => {
  it("dice che non è attivo invece di fingere un calendario vuoto", () => {
    const html = render({ disabled: true, rows: [] });
    expect(html).toMatch(/non è attivo/i);
    expect(html).not.toMatch(/Nessuna partita in programma/i);
  });

  it("da spento non serve nessuna predizione, nemmeno se gliene passi", () => {
    const html = render({ disabled: true });
    expect(html).not.toContain("Sinner");
    expect(html).not.toContain("Vince Sinner");
  });

  it("da spento resta il disclaimer: è pur sempre una nostra superficie", () => {
    const html = render({ disabled: true, rows: [] });
    expect(html).toContain("18+");
  });
});
