import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// La pagina è un server component con un client component dentro: si verifica
// il contratto che conta (cosa promette e cosa NON promette), non il rendering.
const PAGE = readFileSync(join(process.cwd(), "app/widget/page.tsx"), "utf8");
const FOOTER = readFileSync(join(process.cwd(), "components/SiteFooter.tsx"), "utf8");
const LANDING = readFileSync(join(process.cwd(), "app/landing-client.tsx"), "utf8");

describe("/widget (#WIDGET-LANDING-0824)", () => {
  it("non promette guadagni né performance", () => {
    // Solo i claim POSITIVI: il disclaimer contiene di proposito la parola
    // "profit" dentro una negazione ("nothing here is a promise of profit"),
    // e un guard che vieta la parola invece dell'affermazione lo boccerebbe.
    expect(PAGE).not.toMatch(/guarantee\w*|\bwin rate\b|accuracy of \d|beat the market|make money|risk[- ]free/i);
    expect(PAGE).not.toMatch(/\d+%\s*(win|accurate|profit)/i);
  });

  it("dice che è informativo, 18+, e nomina chi opera senza la società", () => {
    expect(PAGE).toMatch(/information only/i);
    expect(PAGE).toContain("18+");
    // #SITE-ENTITY-0824 — l'identità arriva da LEGAL_ENTITY, non è più scritta qui,
    // e la società operativa non deve comparire su nessuna superficie pubblica.
    expect(PAGE).toMatch(/LEGAL_ENTITY\.senderName/);
    expect(PAGE).not.toMatch(/Maven/i);
  });

  it("dichiara che non mette cookie sul sito ospite", () => {
    expect(PAGE).toMatch(/no cookies/i);
  });

  it("è raggiungibile dal footer di ogni pagina e dalla home", () => {
    expect(FOOTER).toContain('href="/widget"');
    expect(LANDING).toContain('href="/widget"');
  });

  it("porta il partner a chiedere un codice, senza inventare un form che non esiste", () => {
    expect(PAGE).toContain("mailto:info@betredge.com");
  });
});
