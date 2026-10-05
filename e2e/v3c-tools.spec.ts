// e2e/v3c-tools.spec.ts (#REDESIGN-V3C F5) — hub e pagine tool v3c con il flag
// ACCESO (il server va avviato con NEXT_PUBLIC_REDESIGN=1). Per ogni pagina e
// modo: overflow 0 px, nessun elemento oltre il bordo, 0 errori console,
// ≤ 22 parole per elemento (stesso gate di proto-v3c/shots.py; esclusi footer
// e il contenuto lungo preesistente: spiegazione, esempio, FAQ), scatto da
// guardare a occhio in scratchpad/v3c-tools/. Poi: ricerca, prefill, SEO.
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const SHOTS = "scratchpad/v3c-tools";
mkdirSync(SHOTS, { recursive: true });

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return errors;
}

async function gates(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const offenders = await page.evaluate(() => {
    const w = document.documentElement.clientWidth + 1;
    return Array.from(document.querySelectorAll('[data-theme="v3c"] *'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > w || r.left < -1);
      })
      .slice(0, 8)
      .map((el) => `${el.tagName.toLowerCase()}.${(el as HTMLElement).className}`);
  });
  const longText = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll("p, li, h1, h2, h3, figcaption, .v3c-explain, .v3c-small, .v3c-fine, .v3c-lab").forEach((el) => {
      if (el.closest("footer, .v3c-prose, .v3c-example, .v3c-faq, .v3c-takeaway")) return;
      if (el.querySelector("p, li, h1, h2, h3")) return;
      const t = ((el as HTMLElement).innerText || "").trim();
      const n = t.split(/\s+/).filter(Boolean).length;
      if (n > 22) out.push(`${n}w: ${t.slice(0, 90)}`);
    });
    return out;
  });
  return { overflow, offenders, longText };
}

const PAGES: { name: string; path: string; h1: string }[] = [
  { name: "hub-en", path: "/tools", h1: "Start from your question" },
  { name: "tool-ev-en", path: "/tools/ev-calculator", h1: "EV calculator" },
  { name: "hub-it", path: "/it/tools", h1: "Parti dalla tua domanda" },
  { name: "tool-kelly-it", path: "/it/tools/kelly-criterion", h1: "Criterio di Kelly" },
  // tedesco: stringhe nuove in fallback inglese (dichiarato), contenuto lungo in tedesco
  { name: "tool-margin-de", path: "/de/tools/margin-calculator", h1: "Margin calculator" },
];

for (const p of PAGES) {
  for (const mode of ["light", "dark"] as const) {
    test(`${p.name} ${mode}: gates + screenshot`, async ({ page }, info) => {
      const errors = collectErrors(page);
      await page.goto(`${p.path}?mode=${mode}`);
      await page.waitForLoadState("networkidle");
      await expect(page.locator('[data-theme="v3c"]')).toHaveAttribute("data-mode", mode);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.h1);
      const g = await gates(page);
      expect(g.overflow, "horizontal overflow in px").toBe(0);
      expect(g.offenders, "elements past the viewport edge").toEqual([]);
      expect(g.longText, "elements over 22 words").toEqual([]);
      await page.screenshot({ path: `${SHOTS}/${p.name}-${info.project.name}-${mode}.png`, fullPage: true });
      expect(errors, "console/page errors").toEqual([]);
    });
  }
}

test("hub: 11 righe, 3 domande, la ricerca filtra e lo stato vuoto è scritto", async ({ page }) => {
  await page.goto("/tools");
  const rows = page.locator(".v3c-hq[data-q] a[data-tool]");
  await expect(rows).toHaveCount(11);
  await expect(page.locator(".v3c-hq[data-q]:not([hidden])")).toHaveCount(3);
  // ogni riga ha un'anteprima input → risultato non vuota
  const outs = await page.locator(".v3c-hq[data-q] a[data-tool] .v3c-out").allInnerTexts();
  expect(outs.every((t) => t.trim() && t.trim() !== "—")).toBe(true);
  // nessun link partner nelle pagine tool
  await expect(page.locator('a[rel~="sponsored"]')).toHaveCount(0);

  const search = page.getByRole("searchbox");
  await search.fill("kelly");
  await expect(page.locator(".v3c-hq[data-q] a[data-tool]:visible")).toHaveCount(1);
  await expect(page.getByText("1 of 11 tools match “kelly”")).toBeVisible();
  await expect(page.locator(".v3c-hq-prod")).toBeHidden();
  await search.fill("zzz");
  await expect(page.getByRole("status")).toContainText("No tool is called “zzz”");
  await search.fill("");
  await expect(page.locator(".v3c-hq[data-q] a[data-tool]:visible")).toHaveCount(11);
});

test("tool: calcola sui numeri del prototipo e si precompila dalla query", async ({ page }) => {
  await page.goto("/tools/ev-calculator");
  await expect(page.getByTestId("out-big")).toHaveText("+3.2%");
  await page.getByTestId("in-prob").fill("50");
  await expect(page.getByTestId("out-big")).toHaveText("+7.5%");
  await page.getByTestId("in-price").fill("");
  await expect(page.getByTestId("out-big")).toHaveText("—");

  await page.goto("/tools/ev-calculator?price=2.30&prob=50");
  await expect(page.getByTestId("in-price")).toHaveValue("2.3");
  await expect(page.getByTestId("out-big")).toHaveText("+15.0%");

  // da un esito della board (sorgente SAMPLE): la fascia dice da dove viene
  await page.goto("/tools/kelly-criterion?m=genoa-fiorentina&o=home");
  await expect(page.getByTestId("prefill-note")).toContainText("Genoa — Fiorentina");
  await expect(page.getByTestId("prefill-note")).toContainText("Genoa 2.15");
  await expect(page.getByTestId("out-big")).toHaveText("2.8% · €14");
  await expect(page.locator('a[rel~="sponsored"]')).toHaveCount(0);
});

test("tool: «la stessa matematica sul board» ha 8 righe con la colonna; ROI ha il ponte testuale", async ({ page }) => {
  await page.goto("/tools/ev-calculator");
  await expect(page.locator(".v3c-tb-r")).toHaveCount(8);
  await expect(page.locator(".v3c-tb-r").first()).toContainText("+3.2%");
  await expect(page.locator(".v3c-tb-l .v3c-tag-sample")).toHaveCount(0);
  await expect(page.locator(".v3c-bridge .v3c-tag-sample")).toHaveCount(1);
  await page.goto("/tools/roi-calculator");
  await expect(page.locator(".v3c-tb-r")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "The same ratio, on our record" })).toBeVisible();
});

test("SEO invariata: canonical, 12 hreflang, JSON-LD WebApplication + FAQPage, FAQ nel documento", async ({ page }) => {
  await page.goto("/it/tools/kelly-criterion");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.betredge.com/it/tools/kelly-criterion");
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(12);
  const ld = await page.locator('script[type="application/ld+json"]').allInnerTexts();
  const types = ld.flatMap((t) => {
    const j = JSON.parse(t);
    return Array.isArray(j) ? j.map((x) => x["@type"]) : [j["@type"]];
  });
  expect(types).toEqual(expect.arrayContaining(["WebApplication", "FAQPage"]));
  const faq = ld.flatMap((t) => [JSON.parse(t)].flat()).find((x: { "@type": string }) => x["@type"] === "FAQPage");
  for (const q of faq.mainEntity as { name: string }[]) await expect(page.getByRole("heading", { level: 3, name: q.name })).toBeVisible();

  await page.goto("/tools");
  const hubLd = (await page.locator('script[type="application/ld+json"]').allInnerTexts()).map((t) => JSON.parse(t));
  const hub = hubLd.find((x) => x["@type"] === "ItemList");
  expect(hub).toBeTruthy();
  expect(hub.itemListElement).toHaveLength(11);
});

test("mobile: barra in basso, cinque voci, Tools corrente", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("mobile"), "solo mobile");
  await page.goto("/tools/margin-calculator");
  const nav = page.getByRole("navigation", { name: "Primary (mobile)" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link")).toHaveCount(5);
  await expect(nav.locator('a[aria-current="page"]')).toHaveText(/Tools/);
  await page.screenshot({ path: `${SHOTS}/tool-margin-fold-mobile.png` });
});

test("il tema scelto resta: toggle → scuro, ricarico senza query → ancora scuro, senza lampo nel DOM iniziale", async ({ page }) => {
  await page.goto("/tools");
  await page.getByRole("button", { name: "Switch to dark" }).click();
  await expect(page.locator('[data-theme="v3c"]')).toHaveAttribute("data-mode", "dark");
  await page.goto("/tools/odds-converter");
  await expect(page.locator('[data-theme="v3c"]')).toHaveAttribute("data-mode", "dark");
});
