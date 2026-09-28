// lib/plans-hook-copy.test.ts — #PLANS-HOOK-C-0928
//
// Il gancio C sulla pagina piani: l'hero dice cosa distingue i tre piani
// (quanto del board leggi) e non «un piano pagante» sopra tre card; il
// disclaimer sul mercato scende in coda; il prezzo mensile ha accanto (non al
// posto) l'unità d'uso; da anonimo il bottone vende il piano invece di
// chiedere la registrazione. Guardia sul sorgente, come plans-copy.test.ts:
// le stringhe stanno nel monolite, non in un modulo importabile.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(REPO_ROOT, "app/app/page.tsx"), "utf8");

const start = src.indexOf("function PlansTab(");
const end = src.indexOf("function SettingsTab(", start);
const plansTab = start >= 0 && end > start
  ? src.slice(start, end).replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/.*$/gm, "")
  : "";

const cpbStart = src.indexOf("function CryptoPaymentBox(");
const cpbEnd = src.indexOf("function loadPayPalSdk(", cpbStart);
const cryptoBox = cpbStart >= 0 && cpbEnd > cpbStart
  ? src.slice(cpbStart, cpbEnd).replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  : "";

const keyLines = (key: string) => src.split("\n").filter((l) => new RegExp(`^\\s+${key}:`).test(l));

describe("hero della pagina piani", () => {
  const titles = keyLines("plans_title");
  const subtitles = keyLines("plans_subtitle");

  it("esiste nelle cinque lingue", () => {
    expect(titles.length).toBe(5);
    expect(subtitles.length).toBe(5);
    expect(plansTab).toMatch(/plans-grid/);
  });

  it("non dice più «un piano pagante» sopra tre card", () => {
    for (const l of titles) expect(l).not.toMatch(/paid plan|piano pagante|plan de pago|plan payant|платный план/i);
  });

  it("il sottotitolo nomina i tre livelli e i loro numeri veri (3, 7, tutto)", () => {
    for (const l of subtitles) {
      expect(l).toMatch(/\b3\b/);
      expect(l).toMatch(/\b7\b/);
      expect(l).toMatch(/Free/);
      expect(l).toMatch(/Base/);
      expect(l).toMatch(/Pro/);
    }
  });

  it("il disclaimer sul mercato resta, ma in coda alla pagina", () => {
    for (const l of subtitles) expect(l).not.toMatch(/market|mercato|mercado|marché|рынок/i);
    const footnotes = keyLines("plans_footnote");
    expect(footnotes.length).toBe(5);
    for (const l of footnotes) {
      expect(l).toMatch(/18\+/);
      expect(l).toMatch(/market|mercato|mercado|marché|рынок/i);
      // «calibrate» è un claim che entra solo con la firma di ml-engineer-agentic
      expect(l).not.toMatch(/calibrat|калибров/i);
    }
    // dopo la griglia delle card (l'ultimo CryptoPaymentBox è quello di Pro)
    const gridEnd = plansTab.lastIndexOf("<CryptoPaymentBox");
    const footnoteAt = plansTab.indexOf("plans-footnote");
    expect(gridEnd).toBeGreaterThan(0);
    expect(footnoteAt).toBeGreaterThan(gridEnd);
  });

  // #PLANS-FLOW-OFF-0928 — Andrea, 28/09: via la strip 01–04 sotto le card.
  it("la strip 01/02/03/04 (Signal/Explain/Decide/Track) non è più resa", () => {
    expect(plansTab).not.toMatch(/plan-flow/);
    expect(plansTab).not.toMatch(/t\.plans_flow\d/);
  });
});

describe("prezzo in unità d'uso", () => {
  it("sta accanto al mensile, non al suo posto, su Base e Pro", () => {
    const priceLines = plansTab.split('className="price-line"').slice(1);
    // Free, Base, Pro
    expect(priceLines.length).toBe(3);
    const base = priceLines[1];
    const pro = priceLines[2];
    expect(base).toMatch(/planPriceCopy\("base"/);
    expect(base).toMatch(/price-unit/);
    expect(base).toMatch(/0[.,]50/);
    expect(base).toMatch(/14/);
    expect(pro).toMatch(/planPriceCopy\("premium"/);
    expect(pro).toMatch(/price-unit/);
    expect(pro).toMatch(/\$1 /);
  });

  it("i conti tornano con i prezzi veri", () => {
    expect((14.99 / 30).toFixed(2)).toBe("0.50");
    expect((29.99 / 30).toFixed(2)).toBe("1.00");
  });
});

describe("CTA da anonimo", () => {
  it("vende il piano, non chiede più «crea profilo prima»", () => {
    // né la chiave nei blocchi di traduzione, né un uso `t.crypto_create_first`
    // (il commento che spiega la rimozione può citarla)
    expect(src).not.toMatch(/crypto_create_first:|t\.crypto_create_first/);
    expect(cryptoBox).toMatch(/Start with Base/);
    expect(cryptoBox).toMatch(/Start with Pro/);
    expect(plansTab).toMatch(/Start free/);
  });
});

describe("feature in linguaggio di esito, non di gergo", () => {
  it("niente «Live V4», «Model Edges», «Deep Analysis», «stake», «value bet» nelle card", () => {
    expect(plansTab).not.toMatch(/Live V4|Model Edges|Deep Analysis|\+EV|stake|value bet/i);
  });

  it("nessun superlativo di popolarità", () => {
    expect(plansTab).not.toMatch(/popular|popolare|populaire|популярный/i);
  });

  it("la striscia track record non c'è ancora: il TODO sì", () => {
    expect(src.slice(start, end)).toMatch(/TODO track-record strip: pending ml-engineer-agentic sign-off/);
  });
});
