// scripts/v3c/fixdata3-shots.mjs (#REDESIGN-V3C fixdata3) — the local check of the QA-3 data fixes on the MOCK
// (scripts/v3c/mock-db.ts with MOCK_FIXDATA2=1 MOCK_FIXDATA3=1, no-network.cjs): R2 tennis twins with inverted names
// (board, match, price check, home «Live now»), R3 the age of a tennis market (stale / books / fresh / none) on board,
// match, price check and OG; 1440/390 × light/dark, overflow, console errors, /api/track aborted. One clip per point.
// Usage: BASE=http://127.0.0.1:3603 OUT=/tmp/fd3-shots node scripts/v3c/fixdata3-shots.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3603";
const OUT = process.env.OUT ?? "/tmp/fd3-shots";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["board-tennis", "/predictions?sport=tennis"],
  ["m-stale", "/match/tennis:espn:fx3-stale"],
  ["m-books", "/match/tennis:espn:fx3-books"],
  ["m-fresh", "/match/tennis:mock1"],
  ["m-none", "/match/tennis:espn:fx3-none"],
  ["m-bai-dropped", "/match/tennis:espn:185274:bai-zhuoxuan:emerson-jones"],
  ["m-bu-dropped", "/match/tennis:partner:fx3-bu"],
  ["pc", "/price-check"],
  ["home", "/"],
];
// the board rows to expand and clip: [file key, text in the row link]
const ROWS = [["bai", "Bai"], ["bu", "Van Assche"], ["stale", "Humbert"], ["books", "Sonego"], ["none", "Zheng Qinwen"], ["fresh", "Sinner"]];
const VIEWS = [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]];

const report = [];
const browser = await chromium.launch();
for (const [vname, viewport] of VIEWS) {
  for (const mode of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport, colorScheme: mode, timezoneId: "Europe/Rome", locale: "en-GB" });
    await ctx.addInitScript(() => { try { localStorage.setItem("gdpr_consent", "essential"); } catch {} });
    for (const [name, path] of PAGES) {
      const page = await ctx.newPage();
      const errors = [];
      const failed = [];
      let tracked = 0;
      page.on("requestfailed", (r) => failed.push(new URL(r.url()).pathname));
      // a console error from a request this script aborts (/api/track, /api/partner-click) is not the page's
      page.on("console", (m) => m.type() === "error" && !/\/api\/(track|partner-click)/.test(m.location()?.url ?? "") && errors.push(`${m.text().slice(0, 160)} @ ${m.location()?.url ?? ""}`));
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
      await page.route("**/api/track**", (r) => { tracked += 1; return r.abort(); });
      await page.route("**/api/partner-click**", (r) => r.abort());
      const resp = await page.goto(`${BASE}${path}${path.includes("?") ? "&" : "?"}mode=${mode}`, { waitUntil: "networkidle", timeout: 90_000 });
      await page.waitForTimeout(700);
      if (name === "board-tennis") {
        for (const [k, s] of ROWS) {
          const row = page.locator(`.v3c-row:has(.v3c-rowlink:has-text("${s}"))`).first();
          if (!(await row.count())) continue;
          await row.locator(".v3c-rowlink").click();
          await page.waitForTimeout(250);
          await row.scrollIntoViewIfNeeded();
          await row.screenshot({ path: `${OUT}/board-${vname}-${mode}-${k}.png` });
        }
      }
      const facts = await page.evaluate(() => {
        const txt = document.body.innerText;
        const links = [...document.querySelectorAll(".v3c-row .v3c-rowlink")].map((e) => e.textContent ?? "");
        const count = (s) => links.filter((l) => l.includes(s)).length;
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          h1: document.querySelector("h1")?.textContent ?? null,
          rowsBai: count("Bai"), rowsBu: count("Van Assche"), rowsWu: count("Michael Zheng"), rowsHumbert: count("Humbert"),
          liveNow: [...document.querySelectorAll(".v3c-ls-now-i .v3c-t-row")].map((e) => e.textContent),
          stale: txt.includes("Market only: price may be outdated"),
          priceAge: (txt.match(/Price age \d\d:\d\d \(hh:mm\)/g) ?? []).slice(0, 3),
          staleNote: (txt.match(/Last stored price, \d\d:\d\d old/g) ?? []).slice(0, 2),
          booksMarket: txt.includes("Market from the partner books’ prices"),
          eloBased: txt.includes("Elo-based"),
          pcOptions: [...document.querySelectorAll("select option")].map((o) => o.textContent).filter((t) => /Humbert|Bai|Van Assche|Sonego/.test(t ?? "")),
          marketPct: [...document.querySelectorAll(".v3c-mt-score .v3c-n-score")].map((e) => e.textContent).slice(0, 3),
        };
      });
      await page.screenshot({ path: `${OUT}/${name}-${vname}-${mode}.png`, fullPage: false });
      const step = page.locator(".v3c-mt-step").first();
      if (name.startsWith("m-") && (await step.count())) {
        await step.scrollIntoViewIfNeeded();
        await step.screenshot({ path: `${OUT}/${name}-${vname}-${mode}-step1.png` });
      }
      report.push({ name, view: vname, mode, status: resp?.status() ?? null, errors, failed, tracked, ...facts });
      await page.close();
    }
    await ctx.close();
  }
}
// OG cards (one size): stale, books, the dropped Bai id
const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [k, id] of [["stale", "tennis:espn:fx3-stale"], ["books", "tennis:espn:fx3-books"], ["bai-dropped", "tennis:espn:185274:bai-zhuoxuan:emerson-jones"]]) {
  const r = await og.goto(`${BASE}/match/${encodeURIComponent(id)}/og.png`, { timeout: 90_000 });
  await og.screenshot({ path: `${OUT}/og-${k}.png` });
  report.push({ name: `og-${k}`, status: r?.status() ?? null, type: r?.headers()["content-type"] ?? null });
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.map((r) => ({ n: `${r.name}-${r.view ?? ""}-${r.mode ?? ""}`, s: r.status, ow: r.overflow, err: r.errors?.length, trk: r.tracked })), null, 0));
