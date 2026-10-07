// e2e/v3c-livescores.spec.ts (#V3C-LIVESCORES) — the live scores on board,
// home and match page, flag ON, against the LOCAL mock only:
//   MOCK_LIVE=1 npx tsx scripts/v3c/mock-db.ts   (fictitious rows + ESPN-shaped scoreboards)
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:<port> SUPABASE_SERVICE_ROLE_KEY=mock NEXT_PUBLIC_REDESIGN=1 \
//   V3C_LIVE_ESPN_BASE=http://127.0.0.1:<port>/espn NODE_OPTIONS="--require ./scripts/v3c/no-network.cjs" npx next dev
// live2: + V3C_LIVE_ODDS_BASE=http://127.0.0.1:<port>/odds V3C_LIVE_APIF_BASE=http://127.0.0.1:<port>/apif
//   ODDS_API_KEY=mock API_FOOTBALL_DIRECT_KEY=mock (dummies: the mock ignores them, nothing leaves 127.0.0.1)
// Skipped unless PW_LIVE=1 (the other e2e runs use the mock without MOCK_LIVE).
// For each page and mode: the score is visible, overflow 0, 0 console errors,
// /api/track and /api/partner-click aborted (counted), a screenshot to LOOK AT.
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

test.skip(process.env.PW_LIVE !== "1", "needs the MOCK_LIVE=1 mock and V3C_LIVE_ESPN_BASE");

const SHOTS = "scratchpad/v3c-livescores";
mkdirSync(SHOTS, { recursive: true });

async function guard(page: Page) {
  const errors: string[] = [];
  const blocked = { track: 0, click: 0 };
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/api/track**", (r) => (blocked.track++, r.abort()));
  await page.route("**/api/partner-click**", (r) => (blocked.click++, r.abort()));
  return {
    blocked,
    /** console errors, minus one «net::ERR_FAILED» per request WE aborted (track / partner-click) */
    get errors() {
      let n = blocked.track + blocked.click;
      return errors.filter((e) => !(e.includes("net::ERR_FAILED") && n-- > 0));
    },
  };
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const offenders = (page: Page) =>
  page.evaluate(() => {
    const w = document.documentElement.clientWidth + 1;
    return Array.from(document.querySelectorAll('[data-theme="v3c"] .v3c-ls-board *, [data-theme="v3c"] .v3c-ls-now *, [data-theme="v3c"] .v3c-row .v3c-ls-sc'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > w || r.left < -1);
      })
      .map((el) => `${el.tagName.toLowerCase()}.${(el as HTMLElement).className}`);
  });

const TENNIS_ID = "tennis:espn:990001:ben-shelton:lorenzo-musetti";

for (const mode of ["light", "dark"] as const) {
  const q = mode === "dark" ? "?mode=dark" : "";

  test(`home: Live now + row scores (${mode})`, async ({ page }, info) => {
    const g = await guard(page);
    await page.goto(`/${q}`);
    const now = page.locator(".v3c-ls-now");
    await expect(now).toBeVisible({ timeout: 30_000 });
    await expect(now.locator("li")).toHaveCount(4); // Juventus–Napoli, Lech–Legia (Odds API), Ajax–PSV (API-Football), Musetti–Shelton; not the finished one, not the uncovered one
    await expect(now).toContainText("2–1");
    await expect(now).toContainText("4-6 6-6(5-3)");
    await expect(page.locator("[aria-live=polite]").first()).toBeAttached();
    expect(await overflow(page)).toBe(0);
    expect(await offenders(page)).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/home-${mode}-${info.project.name}.png`, fullPage: false });
    expect(g.errors).toEqual([]);
  });

  test(`board: badge, minute, finished, n/a (${mode})`, async ({ page }, info) => {
    const g = await guard(page);
    await page.goto(`/predictions${q}`);
    const juve = page.locator(".v3c-row", { hasText: "Juventus – Napoli" });
    await expect(juve.locator(".v3c-ls-sc")).toHaveText("2–1", { timeout: 30_000 });
    await expect(juve.locator(".v3c-r-time .v3c-live")).toBeVisible();
    await expect(juve.locator(".v3c-r-time small")).toHaveText(/^\d{1,2}'$/);
    const ars = page.locator(".v3c-row", { hasText: "Arsenal – Chelsea" });
    await expect(ars.locator(".v3c-r-time")).toContainText("Finished");
    await expect(ars.locator(".v3c-r-time")).toContainText("FT");
    await expect(ars.locator(".v3c-ls-sc")).toHaveText("2–2");
    // live2: started, no source → «Start» + the time it started, never «Live» or a number
    const med = page.locator(".v3c-row", { hasText: "Daniil Medvedev – Taylor Fritz" });
    await expect(med.locator(".v3c-r-time")).toHaveText(/^Start\d{1,2}:\d{2}$/);
    await expect(med.locator(".v3c-ls-sc")).toHaveCount(0);
    // live2: The Odds API only (no minute), API-Football (minute), and a football row no source covers
    const pol = page.locator(".v3c-row", { hasText: "Lech Poznan – Legia Warsaw" });
    await expect(pol.locator(".v3c-ls-sc")).toHaveText("1–0");
    await expect(pol.locator(".v3c-r-time .v3c-live")).toBeVisible();
    await expect(pol.locator(".v3c-r-time small")).toHaveCount(0);
    const ajax = page.locator(".v3c-row", { hasText: "Ajax – PSV" });
    await expect(ajax.locator(".v3c-ls-sc")).toHaveText("0–1");
    await expect(ajax.locator(".v3c-r-time small")).toHaveText(/^\d{1,2}'$/);
    const jpn = page.locator(".v3c-row", { hasText: "Kashima Antlers – Urawa Reds" });
    await expect(jpn.locator(".v3c-r-time")).toHaveText(/^Kick-off\d{1,2}:\d{2}$/);
    await expect(jpn.locator(".v3c-ls-sc")).toHaveCount(0);
    const tn = page.locator(".v3c-row", { hasText: "Lorenzo Musetti – Ben Shelton" });
    await expect(tn.locator(".v3c-ls-sc")).toHaveText("4-6 6-6(5-3)");
    await expect(tn.locator(".v3c-r-time small")).toHaveText("Set 2");
    expect(await overflow(page)).toBe(0);
    expect(await offenders(page)).toEqual([]);
    await page.locator(".v3c-board").screenshot({ path: `${SHOTS}/board-${mode}-${info.project.name}.png` });
    expect(g.errors).toEqual([]);
  });

  test(`match: football scoreboard + events (${mode})`, async ({ page }, info) => {
    const g = await guard(page);
    await page.goto(`/match/oddsapi%3Alive001${q}`);
    const b = page.locator(".v3c-ls-board");
    await expect(b).toBeVisible({ timeout: 30_000 });
    await expect(b.locator(".v3c-ls-fb-s")).toHaveText("2–1");
    await expect(b.locator(".v3c-ls-ev li")).toHaveCount(3);
    await expect(b).toContainText("Penalty");
    expect(await overflow(page)).toBe(0);
    expect(await offenders(page)).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/match-fb-${mode}-${info.project.name}.png` });
    expect(g.errors).toEqual([]);
  });

  test(`match: fallback source named, and «Kick-off» when none covers it (${mode})`, async ({ page }, info) => {
    const g = await guard(page);
    await page.goto(`/match/oddsapi%3A00000000000000000000000000c0ffee${q}`);
    const b = page.locator(".v3c-ls-board");
    await expect(b).toBeVisible({ timeout: 30_000 });
    await expect(b.locator(".v3c-ls-fb-s")).toHaveText("1–0");
    await expect(b).toContainText("Scores from The Odds API");
    await page.screenshot({ path: `${SHOTS}/match-odds-${mode}-${info.project.name}.png` });
    await page.goto(`/match/live-nosource-1${q}`);
    const na = page.locator(".v3c-ls-board-na");
    await expect(na).toBeVisible({ timeout: 30_000 });
    await expect(na).toContainText(/^Kick-off \d{1,2}:\d{2}\. No score source covers this match yet/);
    expect(await overflow(page)).toBe(0);
    await page.screenshot({ path: `${SHOTS}/match-nosource-${mode}-${info.project.name}.png` });
    expect(g.errors).toEqual([]);
  });

  test(`match: tennis sets, tie-break, server (${mode})`, async ({ page }, info) => {
    const g = await guard(page);
    await page.goto(`/match/${encodeURIComponent(TENNIS_ID)}${q}`);
    const b = page.locator(".v3c-ls-board");
    await expect(b).toBeVisible({ timeout: 30_000 });
    await expect(b.locator("tbody tr").first()).toContainText("Lorenzo Musetti");
    await expect(b.locator("tbody tr").first().locator("td")).toHaveText(["4", "65"]);
    await expect(b.locator(".v3c-ls-srv")).toHaveCount(1);
    await expect(b).toContainText("Lorenzo Musetti serving");
    expect(await overflow(page)).toBe(0);
    expect(await offenders(page)).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/match-tn-${mode}-${info.project.name}.png` });
    expect(g.errors).toEqual([]);
  });
}

test("polling stops while the tab is hidden", async ({ page }) => {
  test.setTimeout(120_000);
  await guard(page);
  let calls = 0;
  page.on("request", (r) => r.url().includes("/api/v3/live") && calls++);
  await page.goto("/predictions");
  await expect(page.locator(".v3c-ls-sc").first()).toBeVisible({ timeout: 30_000 });
  const before = calls;
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(50_000);
  expect(calls).toBe(before);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => calls, { timeout: 5_000 }).toBeGreaterThan(before);
});
