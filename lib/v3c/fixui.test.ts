// lib/v3c/fixui.test.ts (#REDESIGN-V3C fixui) — i pezzi puri del filone interfaccia e testi.
import { describe, expect, it } from "vitest";
import { hmLocal, stampLocal, tzAbbr } from "./time-ui";
import { EN_TITLES, localTitle } from "./doc-titles";
import { relativizeSiteLinks } from "./site-links";
import { PAGES_COPY } from "./pages-copy";
import { V3C_HOME_FAQ } from "./home-faq";
import { V3C_PARTNERS_FAQ, V3C_PARTNERS_INTRO } from "./partners-seo";
import { V3C_TOOLS_COPY } from "@/lib/i18n/v3c-tools";
import { getToolsCopy } from "@/lib/tools/copy";

describe("M2 · un fuso per vista", () => {
  const iso = "2026-10-07T14:05:00Z";
  it("senza fuso (server, primo render) scrive UTC e la sigla dice UTC", () => {
    expect(hmLocal(iso, undefined)).toBe("14:05");
    expect(tzAbbr(undefined)).toBe("UTC");
  });
  it("con il fuso del browser scrive l'ora locale; la sigla è quella del fuso", () => {
    expect(hmLocal(iso, "Europe/Rome")).toBe("16:05");
    expect(stampLocal(iso, "Europe/Rome")).toBe("7 Oct, 16:05");
    expect(tzAbbr("Europe/Rome", "en-GB", new Date(iso))).toBe("CEST");
  });
});

describe("M1 · title per lingua", () => {
  it("traduce i title noti e i suffissi della partita, lascia gli altri", () => {
    expect(localTitle(EN_TITLES.record, "it")).toBe("Registro: ogni stima sigillata prima del fischio d’inizio | BetRedge");
    expect(localTitle("Inter – Torino: market, estimate and best price | BetRedge", "de")).toBe("Inter – Torino: Markt, Schätzung und beste Quote | BetRedge");
    expect(localTitle("Kelly-Kriterium | BetRedge", "de")).toBe("Kelly-Kriterium | BetRedge");
    expect(localTitle(EN_TITLES.home, "en")).toBe(EN_TITLES.home);
  });
});

describe("M7 · link del blog relativi", () => {
  it("solo gli href verso betredge.com, in assoluto o senza www", () => {
    const html = '<a href="https://www.betredge.com/history">r</a> <a href=\'https://betredge.com\'>h</a> <a href="https://example.com/x">x</a> https://www.betredge.com/text';
    expect(relativizeSiteLinks(html)).toBe('<a href="/history">r</a> <a href=\'/\'>h</a> <a href="https://example.com/x">x</a> https://www.betredge.com/text');
  });
});

describe("B3/A4/B4/A5 · niente vendita, niente claim", () => {
  const all = (o: unknown) => JSON.stringify(o);
  it("/pricing: nessun bottone d'acquisto, nessun recesso, il perché al futuro", () => {
    for (const c of Object.values(PAGES_COPY)) {
      const p = all(c.pricing);
      expect(p).not.toMatch(/Go Pro|free account|trial|checkout|USDT|crypto|withdrawal/i);
      expect(c.pricing.rows).toHaveLength(7);
    }
    expect(PAGES_COPY.en.pricing.rows[6][1]).toMatch(/^Pro will show why/);
  });
  it("la FAQ della home non vende Pro né promette il perché al presente", () => {
    expect(all(V3C_HOME_FAQ.en)).not.toMatch(/Pro adds|card subscription|Live is Pro only/);
  });
  it("Books: niente predictions/picks/call nella FAQ v3c", () => {
    expect(all([V3C_PARTNERS_INTRO, V3C_PARTNERS_FAQ])).not.toMatch(/predictions?|picks?\b|\bcall\b/i);
  });
  it("arbitraggio: nessun profitto garantito in nessuna lingua, né nel v3c né nel sito di oggi", () => {
    const bad = /guarant|garanti|lock a profit|whatever happens|bloccano un profitto/i;
    for (const c of Object.values(V3C_TOOLS_COPY)) expect(all(c!.tools["arbitrage-calculator"])).not.toMatch(bad);
    for (const l of ["en", "it", "de", "es", "fr", "nl", "pl", "pt", "ru", "sv", "tr"] as const) {
      const a = getToolsCopy(l).tools["arbitrage-calculator"];
      expect(all(Object.values(a.labels))).not.toMatch(bad); // la chiave «guaranteedReturn» resta: è un nome, non testo a schermo
    }
  });
});
