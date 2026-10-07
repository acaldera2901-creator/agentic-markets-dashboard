// scripts/v3c/fixdata2-shots.mjs (#REDESIGN-V3C fixdata2) — the local check of the QA-2 data fixes on the MOCK
// (scripts/v3c/mock-db.ts with MOCK_FIXDATA2=1, no-network.cjs): the pages of the cases 1440/390 × light/dark,
// overflow, console errors, /api/track aborted, and the DOM facts of N2 N3 N4 N9 N10 N11. One clip per point.
// Usage: BASE=http://127.0.0.1:3492 OUT=/tmp/fd2-shots node scripts/v3c/fixdata2-shots.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3492";
const OUT = process.env.OUT ?? "/tmp/fd2-shots";
mkdirSync(OUT, { recursive: true });

const RUNE_ELO = "tennis:espn:184885:daniel-altmaier:holger-rune";
const PAGES = [
  ["m-palace", "/match/fx2-palace", [".v3c-mt-step"]],
  ["m-augsburg", "/match/fx2-augsburg", [".v3c-mt-step"]],
  ["m-absurd", "/match/fx2-absurd", [".v3c-mt-step"]],
  ["m-blinkova", "/match/tennis:espn:185246:anna-blinkova:caroline-werner", [".v3c-mt-step"]],
  ["m-rune-twin", "/match/tennis:partner:fx2-rune", [".v3c-ls-board", "section:has(#v3c-mt-p)"]],
  ["m-annli", "/match/tennis:espn:184354:ann-li:elina-svitolina", [".v3c-mt-step"]],
  ["board", "/predictions", []],
  ["pc-absurd", "/price-check?m=fx2-absurd", [".v3c-pc-slot"]],
  ["home", "/", [".v3c-ls-now"]],
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
    await ctx.addInitScript(() => { try { localStorage.setItem("gdpr_consent", "essential"); } catch {} });
    for (const [name, path, clips] of PAGES) {
      const page = await ctx.newPage();
      const errors = [];
      let tracked = 0;
      page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
      await page.route("**/api/track**", (r) => { tracked += 1; return r.abort(); });
      await page.route("**/api/partner-click**", (r) => r.abort());
      const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}mode=${mode}`;
      const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
      await page.waitForTimeout(800);
      const facts = await page.evaluate((runeElo) => {
        const txt = document.body.innerText;
        const ow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const rows = [...document.querySelectorAll(".v3c-row")];
        const rowOf = (s) => rows.find((r) => (r.querySelector(".v3c-rowlink")?.textContent ?? "").includes(s));
        const rowFacts = (s) => {
          const r = rowOf(s);
          if (!r) return null;
          return { price: r.querySelector(".v3c-r-price")?.textContent ?? null, mk: r.querySelector(".v3c-r-mk")?.textContent ?? null, es: r.querySelector(".v3c-r-es")?.textContent ?? null, gap: r.querySelector(".v3c-r-gap")?.textContent ?? null, guard: r.querySelector(".v3c-r-gap")?.getAttribute("data-guard") ?? null };
        };
        return {
          title: document.title,
          overflow: ow,
          modelOnly: txt.includes("Model only: no market to compare"),
          booksMarket: txt.includes("Market from the partner books’ prices"),
          priceFar: txt.includes("Our estimate is far from the best price"),
          noValue: /no EV, Kelly or stake shown|no gap, no EV or Kelly/.test(txt),
          sealedElo: txt.includes("Our Elo, sealed"),
          sealedFar: txt.includes("our sealed Elo differs too much"),
          evKelly: /EV calculator|Kelly criterion/.test(txt),
          fair: (txt.match(/fair \d+\.\d\d/g) ?? []).slice(0, 4),
          startedNote: document.querySelector("[data-started-note]")?.getAttribute("data-started-note") ?? null,
          noLiveScoreYet: txt.includes("no live score yet"),
          liveBoard: !!document.querySelector(".v3c-ls-board:not(.v3c-ls-board-na)"),
          liveNow: [...document.querySelectorAll(".v3c-ls-now-i .v3c-t-row")].map((e) => e.textContent),
          head: document.querySelector("h1")?.textContent ?? null,
          pcInputs: [...document.querySelectorAll('input[name^="p"][type="number"]')].map((i) => i.value),
          rowPalace: rowFacts("Crystal Palace"),
          rowAugsburg: rowFacts("Augsburg"),
          rowAbsurd: rowFacts("Stade Rennais"),
          rowAnnLi: rowFacts("Ann Li"),
          rowRune: rowFacts("Rune"),
          runeRows: rows.filter((r) => (r.querySelector(".v3c-rowlink")?.textContent ?? "").includes("Rune")).length,
          runeLink: !!document.querySelector(`a[href="/match/${encodeURIComponent(runeElo)}"]`),
          marketPct: [...document.querySelectorAll(".v3c-mt-score .v3c-n-score.v3c-m")].map((e) => e.textContent).slice(0, 2),
        };
      }, RUNE_ELO);
      await page.screenshot({ path: `${OUT}/${name}-${vname}-${mode}.png`, fullPage: false });
      let i = 0;
      for (const sel of clips) {
        const el = await page.$(sel);
        if (el) {
          await el.scrollIntoViewIfNeeded();
          await el.screenshot({ path: `${OUT}/${name}-${vname}-${mode}-clip${i}.png` });
        }
        i += 1;
      }
      if (name === "board") {
        for (const [k, s] of [["palace", "Crystal Palace"], ["augsburg", "Augsburg"], ["annli", "Ann Li"], ["rune", "Rune"]]) {
          const h = await page.$(`.v3c-row:has(.v3c-rowlink:has-text("${s}"))`);
          if (h) {
            await h.scrollIntoViewIfNeeded();
            await h.screenshot({ path: `${OUT}/board-${vname}-${mode}-${k}.png` });
          }
        }
      }
      report.push({ name, view: vname, mode, status: resp?.status() ?? null, errors, tracked, ...facts });
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.map((r) => ({ n: `${r.name}-${r.view}-${r.mode}`, s: r.status, ow: r.overflow, err: r.errors.length })), null, 0));
