// scripts/v3c/fixdata-shots.mjs (#REDESIGN-V3C fixdata) — the local check of the data fixes on the MOCK
// (scripts/v3c/mock-db.ts with MOCK_LIVE=1 MOCK_FIXDATA=1, no-network.cjs): every page 1440/390 × light/dark,
// overflow, console errors, /api/track aborted (nothing tracked), and the DOM facts of B1 B2 B5 B6 A2 A3 A6 M4.
// Usage: BASE=http://127.0.0.1:3483 OUT=/tmp/fixdata-shots node scripts/v3c/fixdata-shots.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3483";
const OUT = process.env.OUT ?? "/tmp/fixdata-shots";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["home", "/"],
  ["board", "/predictions"],
  ["m-outlier25", "/match/oddsapi:fx-outlier25"],
  ["m-outlier18", "/match/oddsapi:fx-outlier18"],
  ["m-started", "/match/oddsapi:fx-started"],
  ["m-nomarket", "/match/560598"],
  ["m-ok", "/match/560593"],
  ["pc-outlier25", "/price-check?m=oddsapi:fx-outlier25"],
  ["tool-odds", "/tools/odds-converter?price=999999999"],
  ["tool-arb", "/tools/arbitrage-calculator?p1=999999999&p2=1.5&total=1000"],
  ["tool-kelly", "/tools/kelly-criterion?price=0.5&prob=50&bank=500"],
];
const VIEWS = [
  ["1440", { width: 1440, height: 900 }],
  ["390", { width: 390, height: 844 }],
];
const MODES = ["light", "dark"];

const report = [];
const browser = await chromium.launch();
for (const [vname, viewport] of VIEWS) {
  for (const mode of MODES) {
    const ctx = await browser.newContext({ viewport, colorScheme: mode, timezoneId: "Europe/Rome", locale: "en-GB" });
    // cookie banner closed (consent as essential only) so it does not cover the facts under check
    await ctx.addInitScript(() => { try { localStorage.setItem("gdpr_consent", "essential"); } catch {} });
    for (const [name, path] of PAGES) {
      const page = await ctx.newPage();
      const errors = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
      await page.route("**/api/track**", (r) => r.abort());
      const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}mode=${mode}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
      await page.waitForTimeout(600);
      const facts = await page.evaluate(() => {
        const txt = document.body.innerText;
        const ow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const groups = [...document.querySelectorAll(".v3c-group")].map((g) => ({ g: g.getAttribute("data-group"), ids: [...g.querySelectorAll(".v3c-row")].length, head: g.querySelector(".v3c-t-day")?.textContent ?? "" }));
        const startedRows = [...document.querySelectorAll('.v3c-group[data-group="started"] .v3c-row')];
        return {
          overflow: ow,
          groups,
          startedWithBook: startedRows.filter((r) => r.querySelector(".v3c-bchip")).length,
          dayRowsStarted: [...document.querySelectorAll('.v3c-group[data-group="day"] .v3c-r-time em')].map((e) => e.textContent),
          shamrock: (txt.match(/Shamrock Rovers – Drogheda United/g) ?? []).length,
          marketOnly: txt.includes("Market only: the model differs too much to show"),
          noValue: txt.includes("no EV, Kelly or stake shown"),
          evKelly: /EV calculator|Kelly criterion/.test(txt),
          euroStake: /€\d+ of a €\d+ bankroll/.test(txt),
          bestBasis: (txt.match(/EV and Kelly at the best price, [^.]+\./) ?? [null])[0],
          priceAt: (txt.match(/price at \d\d:\d\d [A-Z+0-9]+/) ?? [null])[0],
          liveNow: [...document.querySelectorAll(".v3c-ls-now-i")].length,
          order: txt.includes("top leagues and ATP/WTA first"),
          yday: document.querySelector(".v3c-yd-k")?.getAttribute("data-yday") ?? null,
          ydayTennis: /Tennis · won–lost/.test(txt),
          toolErr: [...document.querySelectorAll(".v3c-in-err")].map((e) => e.textContent),
          bigOut: document.querySelector('[data-testid="out-big"]')?.textContent ?? null,
          gapRound: txt.includes("unrounded numbers"),
          firstRows: [...document.querySelectorAll(".v3c-row .v3c-rowlink")].slice(0, 6).map((b) => b.childNodes[0]?.textContent ?? ""),
        };
      });
      // the points under check, one clip each (a full board page is too tall to read in one picture)
      const CLIPS = {
        home: [".v3c-ls-now", ".v3c-board-f", "#v3c-yday"],
        board: ['.v3c-group[data-group="started"]', '.v3c-group[data-group="day"]'],
        "m-outlier25": [".v3c-mt-step", ".v3c-mt-strip"],
        "m-outlier18": [".v3c-mt-step", ".v3c-mt-strip"],
        "m-ok": [".v3c-mt-strip", ".v3c-mt-partner"],
        "m-started": [".v3c-mt-partner"],
        "pc-outlier25": [".v3c-guard-note"],
      };
      for (const [i, sel] of (CLIPS[name] ?? []).entries()) {
        const el = page.locator(sel).first();
        if (await el.count()) await el.screenshot({ path: `${OUT}/clip-${name}-${i}-${vname}-${mode}.png` }).catch(() => {});
      }
      const file = `${OUT}/${name}-${vname}-${mode}.png`;
      await page.screenshot({ path: file, fullPage: name === "home" || name === "board" ? false : true });
      report.push({ name, vname, mode, errors, ...facts });
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
for (const r of report) console.log(`${r.name} ${r.vname} ${r.mode} overflow=${r.overflow} errors=${r.errors.length}`);
