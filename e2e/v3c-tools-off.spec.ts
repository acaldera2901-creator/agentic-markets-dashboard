// e2e/v3c-tools-off.spec.ts (#REDESIGN-V3C F5) — flag SPENTO = pagine identiche.
// Confronta questo branch (server OFF_URL, NEXT_PUBLIC_REDESIGN non impostato)
// con il branch di partenza (BASE_URL, worktree am-v3c-ds): stesso <title>,
// canonical, hreflang, JSON-LD, stesso testo visibile, nessuna traccia «v3c»
// nel documento. Gli scatti di entrambi finiscono in scratchpad/v3c-tools-off/
// per il confronto a occhio. Si salta se le due URL non sono date.
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OFF = process.env.OFF_URL;
const BASE = process.env.BASE_URL;
const SHOTS = "scratchpad/v3c-tools-off";
mkdirSync(SHOTS, { recursive: true });

const PATHS = ["/tools", "/tools/ev-calculator", "/it/tools", "/it/tools/kelly-criterion", "/de/tools/margin-calculator"];

async function snapshot(url: string) {
  const res = await fetch(url);
  const html = await res.text();
  const pick = (re: RegExp) => Array.from(html.matchAll(re)).map((m) => m[0]).sort();
  return {
    status: res.status,
    title: html.match(/<title>(.*?)<\/title>/)?.[1] ?? "",
    canonical: pick(/<link rel="canonical"[^>]*>/g),
    hreflang: pick(/<link rel="alternate"[^>]*hreflang[^>]*>/g),
    ld: pick(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g),
    v3c: (html.match(/data-theme="v3c"|class="[^"]*v3c-/g) ?? []).length,
    bigShoulders: /Big Shoulders|BigShoulders/.test(html),
  };
}

for (const path of PATHS) {
  test(`flag OFF ≡ base: ${path}`, async ({ page }, info) => {
    test.skip(!OFF || !BASE, "OFF_URL e BASE_URL non impostate");
    const a = await snapshot(`${OFF}${path}`);
    const b = await snapshot(`${BASE}${path}`);
    expect(a.status).toBe(200);
    expect(a.title).toBe(b.title);
    expect(a.canonical).toEqual(b.canonical);
    expect(a.hreflang).toEqual(b.hreflang);
    expect(a.ld).toEqual(b.ld);
    expect(a.v3c, "nessuna traccia del redesign a flag spento").toBe(0);
    expect(a.bigShoulders).toBe(false);

    await page.goto(`${OFF}${path}`);
    await page.waitForLoadState("networkidle");
    const textOff = await page.locator("body").innerText();
    await page.screenshot({ path: `${SHOTS}/${path.replace(/\//g, "_")}-${info.project.name}-off.png`, fullPage: true });
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState("networkidle");
    const textBase = await page.locator("body").innerText();
    await page.screenshot({ path: `${SHOTS}/${path.replace(/\//g, "_")}-${info.project.name}-base.png`, fullPage: true });
    expect(textOff).toBe(textBase);
  });
}
