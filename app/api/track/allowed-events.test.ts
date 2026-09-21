import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

// L'allowlist è la ragione per cui un evento nuovo può sparire in silenzio
// (già successo con i tre eventi del funnel referral): questo test la lega
// agli eventi che il widget emette davvero.
// #RETENTION-ANALYTICS-0915 — l'allowlist ora si importa invece di leggerla
// come testo: il controllo passa da "la stringa compare nel file" a "il Set
// contiene l'evento", che è la domanda vera.
import { BROWSER_ANALYTICS_EVENT_SET } from "@/lib/analytics-events";

const ROUTE = readFileSync(join(process.cwd(), "app/api/track/route.ts"), "utf8");
const SCRIPT = readFileSync(join(process.cwd(), "app/embed/embed-html.ts"), "utf8");

describe("eventi del widget (#WIDGET-EMBED-0824)", () => {
  it("ogni evento emesso dal widget è nell'allowlist di /api/track", () => {
    const emitted = [...SCRIPT.matchAll(/beacon\("([a-z_]+)"\)/g)].map((m) => m[1]);
    expect(emitted.sort()).toEqual(["widget_click", "widget_view"]);
    for (const e of emitted) expect(BROWSER_ANALYTICS_EVENT_SET.has(e)).toBe(true);
  });
});

describe("privacy degli eventi widget (#WIDGET-TRUTH-0824)", () => {
  it("gli eventi del widget non registrano il paese del visitatore", () => {
    // MISURATO il 24/08: i widget_view avevano country="ES", derivato dall'IP,
    // mentre la guida partner dichiara che non raccogliamo nulla sul visitatore
    // del loro sito. La frase si rende vera nel codice, non nel PDF.
    expect(ROUTE).toMatch(/isWidgetEvent[\s\S]{0,120}country/);
    expect(ROUTE).toMatch(/const isWidgetEvent = eventType\.startsWith\("widget_"\)/);
  });
});

// #MIS-B — un event_type fuori allowlist viene scartato in SILENZIO: /api/track
// risponde `{ok:true, ignored:true}` e non c'e' nessun segnale che qualcosa sia
// andato perso. E' gia' successo tre volte (i tre eventi del funnel referral).
// Questo test lega l'allowlist a cio' che il codice emette davvero, invece di
// fidarsi che chi aggiunge un trackEvent si ricordi anche dell'elenco.
describe("ogni evento emesso dal client e' nell'allowlist", () => {
  const emitted = (): string[] => {
    const out = execFileSync(
      "grep",
      ["-rhoE", 'trackEvent\\(\\s*"[a-z_]+"', "app", "components", "features", "lib"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    return [...new Set([...out.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]))].sort();
  };

  it("nessun trackEvent() emette un evento che il server butterebbe via", () => {
    const eventi = emitted();
    expect(eventi.length).toBeGreaterThan(10); // il grep ha trovato qualcosa
    const fuori = eventi.filter((e) => !BROWSER_ANALYTICS_EVENT_SET.has(e));
    expect(fuori, `eventi emessi ma non in allowlist: ${fuori.join(", ")}`).toEqual([]);
  });

  it("partner_menu_open — il denominatore del click affiliato — e' ammesso", () => {
    expect(BROWSER_ANALYTICS_EVENT_SET.has("partner_menu_open")).toBe(true);
    expect(emitted()).toContain("partner_menu_open");
  });
});
