// #GROWTH-V7 — the page's texts after the truth audit, rendered from the shipped snapshot.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { snapshotSource } from "@/data/snapshot-source";
import { GrowthDashboard } from "./GrowthDashboard";

async function page(w: "today" | "7d" | "30d") {
  const { data, meta } = await snapshotSource().load(w);
  const html = renderToStaticMarkup(createElement(GrowthDashboard, { data, meta, hrefFor: (x: string) => `?w=${x}`, workHref: "/lavoro" }));
  const text = html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
  const kpi = (label: string) => html.match(new RegExp(`data-kpi="${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" data-value="([^"]*)"`))?.[1];
  return { html, text, kpi, data };
}

describe("v7 page texts", () => {
  it("no false caveat survives", async () => {
    for (const w of ["today", "7d", "30d"] as const) {
      const { text } = await page(w);
      expect(text, w).not.toMatch(/pagine partita incluse/);
      expect(text, w).not.toMatch(/i profili storici sono tutti così/);
      expect(text, w).not.toMatch(/esiste solo per i signup recenti/);
      expect(text, w).not.toMatch(/Paganti verificati/);
      expect(text, w).not.toMatch(/schermate d'errore viste dagli utenti/);
      expect(text, w).not.toMatch(/ultimi 20\.000 pronostici/);
    }
  });

  it("paying customers: external only, internal accounts and comps labelled apart", async () => {
    const { kpi, text, data } = await page("7d");
    expect(kpi("Clienti esterni paganti")).toMatch(/^\d+$/);
    expect(text).toMatch(/account interni\/test con piano/);
    expect(text).toMatch(/omaggi\/manuali/);
    expect(text).toMatch(/Cassa interna\/test/);
    // the tile says «state of all profiles», the chain column says «created in the window»
    expect(text).toMatch(/stato di tutti i profili/);
    expect(text).toMatch(/Paganti esterni \(oggi\)/);
    expect(data.revenue.ok).toBe(true);
  });

  it("annual share is n/d under 5 external orders, never a percentage of a test account", async () => {
    const { kpi, data } = await page("30d");
    if (data.revenue.ok && data.revenue.data.orders_all < 5) expect(kpi("Quota annuale")).toBe("n/d");
  });

  it("Brier states matches, the market on the same matches and no marketing claim", async () => {
    const { text, kpi } = await page("30d");
    expect(kpi("Brier (servito)")).toMatch(/^0,\d{4}$/);
    expect(text).toMatch(/partite chiuse, un pronostico per partita/);
    expect(text).toMatch(/mercato \d,\d{4}/);
    expect(text).toMatch(/Dato interno di qualità, non un claim di marketing/);
    expect(text).toMatch(/0,667/);
  });

  it("server error patterns are MANCA, not a measured 0; Free → paid is listed as missing", async () => {
    const { text, kpi } = await page("7d");
    expect(kpi("Pattern di errore server")).toBeUndefined();
    expect(text).toMatch(/Pattern di errore server.*non misurato/);
    expect(text).toMatch(/fonte non alimentata/);
    expect(text).toMatch(/Free → paid/);
  });

  it("signups without session count only signup_started; errors declare the dedup rule", async () => {
    const { text, data } = await page("30d");
    if (data.funnelEvents.ok) expect(text).toContain(`(${data.funnelEvents.data.signup_started_no_session} senza sessione)`);
    expect(text).toMatch(/doppioni entro 5 s/);
  });

  it("card per session uses only cards with a session", async () => {
    const { kpi, data } = await page("30d");
    if (data.funnelEvents.ok) {
      const f = data.funnelEvents.data;
      expect(kpi("Card aperte per sessione")).toBe((f.card_open_with_session / f.card_open_sessions).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
    }
  });

  it("internal/test sources are a separate excluded row in all three per-source views", async () => {
    const { html, text } = await page("30d");
    expect((html.match(/data-internal-row/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(text).toMatch(/Il paese non è mai un criterio/);
    // no table cell carries a test source as if it were acquisition (the rule text may name them)
    expect(html).not.toMatch(/>(src:pr-check|test123|qa|3Dcoldmail|referrer:localhost)</);
  });

  it("«Non fidarti di» warns about our own and synthetic traffic, the estimate shows its margin", async () => {
    const { text } = await page("7d");
    expect(text).toMatch(/probabilmente nostro o sintetico/);
    expect(text).toMatch(/Nessuno è escluso dai conteggi/);
    expect(text).toMatch(/109–310/);
    expect(text).toMatch(/685–2\.148/);
  });
});
