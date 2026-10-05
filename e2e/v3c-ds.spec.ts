// e2e/v3c-ds.spec.ts (#REDESIGN-V3C F1) — la verifica meccanica della pagina
// di prova: overflow 0 px, 0 errori console, noindex, reduced-motion, cookie
// del flag, tema. Gli scatti vanno in scratchpad/v3c-ds/ e si guardano a occhio.
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const SHOTS = "scratchpad/v3c-ds";
mkdirSync(SHOTS, { recursive: true });

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return errors;
}

for (const mode of ["light", "dark"] as const) {
  test(`/dev/ds ${mode}: overflow 0 px, 0 console errors, screenshot`, async ({ page }, info) => {
    const errors = collectErrors(page);
    await page.goto(`/dev/ds?mode=${mode}`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-theme="v3c"]')).toHaveAttribute("data-mode", mode);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The bench");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "horizontal overflow in px").toBe(0);

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
    expect(offenders, "elements past the viewport edge").toEqual([]);

    await page.screenshot({ path: `${SHOTS}/${info.project.name}-${mode}.png`, fullPage: true });
    expect(errors, "console/page errors").toEqual([]);
  });
}

test("mobile: la barra in basso è visibile, cinque voci, una corrente", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("mobile"), "solo mobile");
  await page.goto("/dev/ds");
  const nav = page.getByRole("navigation", { name: "Primary (mobile)" });
  await expect(nav).toBeVisible();
  const links = nav.getByRole("link");
  await expect(links).toHaveCount(5);
  await expect(links.filter({ has: page.locator('[aria-current="page"]') }).or(nav.locator('a[aria-current="page"]'))).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-fold.png` });
});

test("noindex: la pagina di prova non si indicizza", async ({ page }) => {
  await page.goto("/dev/ds");
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots ?? "").toContain("noindex");
});

test("il tema si cambia col bottone e finisce nella URL", async ({ page }) => {
  await page.goto("/dev/ds");
  const root = page.locator('[data-theme="v3c"]');
  await expect(root).toHaveAttribute("data-mode", "light");
  await page.getByRole("button", { name: "Switch to dark" }).click();
  await expect(root).toHaveAttribute("data-mode", "dark");
  expect(new URL(page.url()).searchParams.get("mode")).toBe("dark");
  const bg = await root.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe("rgb(7, 19, 41)");
});

test("reduced motion: il tape non anima", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/dev/ds");
  const anim = await page.locator(".v3c-draw path").first().evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe("none");
  await ctx.close();
});

test("senza reduced motion il tape si disegna una volta", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "no-preference", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/dev/ds");
  const anim = await page.locator(".v3c-draw path").first().evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe("v3c-draw");
  await ctx.close();
});

test("il cookie di override: on, off, clear", async ({ page, context }) => {
  await page.goto("/dev/flag?set=on&to=/dev/ds");
  expect(new URL(page.url()).pathname).toBe("/dev/ds");
  let c = (await context.cookies()).find((x) => x.name === "br_redesign");
  expect(c?.value).toBe("1");
  // il link del flag sta nella barra alta, nascosta sotto 821 px: basta che il server l'abbia reso «on»
  await expect(page.locator('a[href^="/dev/flag?set=off"]')).toHaveCount(1);

  await page.goto("/dev/flag?set=off");
  c = (await context.cookies()).find((x) => x.name === "br_redesign");
  expect(c?.value).toBe("0");

  await page.goto("/dev/flag?set=clear&to=//evil.example");
  expect(new URL(page.url()).pathname).toBe("/dev/ds");
  c = (await context.cookies()).find((x) => x.name === "br_redesign");
  expect(c).toBeUndefined();
});

test("il contrasto della carta: ink su paper ≥ 4.5:1 misurato nel browser", async ({ page }) => {
  await page.goto("/dev/ds");
  const ratio = await page.locator('[data-theme="v3c"]').evaluate((el) => {
    const cs = getComputedStyle(el);
    const rgb = (s: string) => s.match(/\d+/g)!.slice(0, 3).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const a = lum(rgb(cs.color));
    const b = lum(rgb(cs.backgroundColor));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});
