// e2e/v3c-newswatch.spec.ts (#REDESIGN-V3C newswatch) — News (/blog → /v3c/blog)
// reading the watcher's table, flag ON, against the LOCAL mock only:
//   MOCK_NEWS=ok|empty|paused npx tsx scripts/v3c/mock-db.ts
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:<port> SUPABASE_SERVICE_ROLE_KEY=mock NEXT_PUBLIC_REDESIGN=1 \
//   NEWS_FOTMOB_ENABLED=1 NODE_OPTIONS="--require ./scripts/v3c/no-network.cjs" npx next start -p <PW_PORT>
//   PW_NEWS=<same state> PW_PORT=<PW_PORT> PW_READY_PATH=blog npx playwright test e2e/v3c-newswatch.spec.ts
// For each mode: the state's text, overflow 0, 0 console errors, no request to
// FotMob from the browser, no image in the notes, /api/track aborted, a screenshot to LOOK AT.
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const STATE = process.env.PW_NEWS as "ok" | "empty" | "paused" | undefined;
test.skip(!STATE, "needs PW_NEWS=ok|empty|paused and the mock-db started with the same MOCK_NEWS");

const SHOTS = "scratchpad/v3c-newswatch";
mkdirSync(SHOTS, { recursive: true });

async function guard(page: Page) {
  const errors: string[] = [];
  const out: string[] = [];
  let aborted = 0;
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => /fotmob\.com/.test(r.url()) && out.push(r.url()));
  await page.route("**/api/track**", (r) => (aborted++, r.abort()));
  return {
    out,
    get errors() {
      let n = aborted;
      return errors.filter((e) => !(e.includes("net::ERR_FAILED") && n-- > 0));
    },
  };
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const mode of ["light", "dark"] as const) {
  test(`News · ${STATE} (${mode})`, async ({ page }, info) => {
    const g = await guard(page);
    await page.goto(`/blog${mode === "dark" ? "?mode=dark" : ""}`);
    const main = page.locator("main#main");
    await expect(main).toBeVisible({ timeout: 30_000 });
    if (STATE === "ok") {
      await expect(main).toContainText(/Updated at \d\d:\d\d/);
      await expect(main.locator(".v3c-nw-card")).toHaveCount(4);
      await expect(main).toContainText("Rewritten with AI from SI via FotMob");
      await expect(main.locator('.v3c-nw-card a[target=_blank][rel="nofollow noopener noreferrer"]')).toHaveCount(4);
      await expect(main.locator(".v3c-nw-card img")).toHaveCount(0);
    } else if (STATE === "empty") {
      await expect(main.getByRole("status")).toContainText("on its way");
      await expect(main.locator(".v3c-nw-card")).toHaveCount(0);
    } else {
      await expect(main).toContainText("News paused");
      await expect(main).toContainText(/Last update at \d\d:\d\d/);
      await expect(main.getByRole("status")).toContainText("paused");
      await expect(main.locator(".v3c-nw-card")).toHaveCount(0);
    }
    await expect(main.locator('a[href^="/blog/mock-"]').first()).toBeVisible(); // the guides, always
    expect(await overflow(page)).toBe(0);
    await page.screenshot({ path: `${SHOTS}/${STATE}-${mode}-${info.project.name}.png`, fullPage: true });
    expect(g.out).toEqual([]);
    expect(g.errors).toEqual([]);
  });
}
