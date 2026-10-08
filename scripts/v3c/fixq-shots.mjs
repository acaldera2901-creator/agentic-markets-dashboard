// scripts/v3c/fixq-shots.mjs (#REDESIGN-V3C fixq) — the local check of Q3–Q9 (QA-REPORT-4) on the MOCK
// (mock-db.ts with MOCK_FIXDATA=1 MOCK_FIXDATA2=1 MOCK_FIXDATA3=1 MOCK_FIXUI2=1 MOCK_LIVE=1 MOCK_FIXQ=1, no-network.cjs):
// 1440/390 × light/dark, overflow, console errors (/api/track aborted) and the facts of each fix:
// Q3 no «prices moving»; Q4 no estimate/fair price on a «Market only» (model_far) page; Q5 EV/Kelly at the best
// linked book (1.82, never the composite 1.94) with the note; Q9 no «(hh:mm)» and no raw API string.
// Usage: BASE=http://127.0.0.1:3691 OUT=/tmp/fixq/shots node scripts/v3c/fixq-shots.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3691";
const OUT = process.env.OUT ?? "/tmp/fixq/shots";
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
mkdirSync(OUT, { recursive: true });

// [name, path, selector of the corrected part (element shot)]
const PAGES = [
  ["home", "/", ".v3c-cb[data-cb='live']"],
  ["board", "/predictions", null],
  ["m-napoli", "/match/fxq-napoli", ".v3c-mt-step"],
  ["m-heid", "/match/fxq-heidenheim", ".v3c-mt-step"],
  ["m-fb-nomkt", "/match/fx2-augsburg", ".v3c-mt-step"],
  ["m-fb-started", "/match/oddsapi:fx-started", ".v3c-mt-step"],
  ["m-fb-live", "/match/oddsapi:live001", ".v3c-mt-step"],
  ["m-tn-stale", "/match/tennis:espn:fx3-stale", ".v3c-mt-step"],
  ["pc-napoli", "/price-check?m=fxq-napoli", ".v3c-pc-res"],
  ["t-ev", "/tools/ev-calculator", ".v3c-bridge"],
  ["t-kelly", "/tools/kelly-criterion", ".v3c-bridge"],
  ["t-ev-prefill", "/tools/ev-calculator?m=fxq-heidenheim&o=home", ".v3c-tres"],
  ["t-margin", "/tools/margin-calculator", ".v3c-bridge"],
  ["hub", "/tools", null],
  ["partners", "/partners", null],
];

const report = [];
const browser = await chromium.launch();
for (const w of [1440, 390])
  for (const mode of ["light", "dark"])
    for (const [name, path, sel] of PAGES) {
      if (ONLY && !ONLY.has(name)) continue;
      const ctx = await browser.newContext({ viewport: { width: w, height: w > 800 ? 900 : 844 }, colorScheme: mode, timezoneId: "Europe/Rome", locale: "en-GB" });
      await ctx.addInitScript(() => {
        try {
          localStorage.setItem("agentic-lang", "en");
          localStorage.setItem("gdpr_consent", "essential");
        } catch {}
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on("console", (m) => m.type() === "error" && !/api\/track|partner-click/.test(`${m.text()} ${m.location()?.url ?? ""}`) && errors.push(m.text().slice(0, 200)));
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
      await page.route("**/api/track**", (x) => x.abort());
      await page.route("**/api/partner-click**", (x) => x.abort());
      const resp = await page.goto(`${BASE}${path}${path.includes("?") ? "&" : "?"}mode=${mode}`, { waitUntil: "networkidle", timeout: 120_000 });
      await page.waitForTimeout(800);
      const tag = `${name}-${w}-${mode}`;
      if (name === "board") {
        const row = page.locator(`.v3c-row:has(.v3c-rowlink:has-text("SSC Napoli"))`).first();
        if (await row.count()) {
          await row.locator(".v3c-rowlink").click();
          await page.waitForTimeout(300);
          await row.scrollIntoViewIfNeeded();
          await row.screenshot({ path: `${OUT}/row-napoli-${tag}.png` });
        }
      }
      if (sel) {
        const els = page.locator(sel);
        const n = Math.min(await els.count(), 3);
        for (let i = 0; i < n; i++) {
          const el = els.nth(name === "home" ? (await els.count()) - 1 - i : i);
          await el.scrollIntoViewIfNeeded();
          await el.screenshot({ path: `${OUT}/part-${tag}-${i}.png` });
          if (name === "home") break;
        }
      }
      const facts = await page.evaluate(() => {
        const de = document.documentElement;
        const txt = document.body.innerText;
        return {
          ow: de.scrollWidth - de.clientWidth,
          q3: /prices moving|in movimento/i.test(txt),
          fairPrice: /fair price \d|as a fair price/i.test(txt),
          largest: /largest gap on this market/.test(txt),
          marketOnly: /Market only/.test(txt),
          composite194: /\b1\.94\b/.test(document.querySelector(".v3c-bridge")?.innerText ?? ""),
          best182: /\b1\.82\b/.test(document.querySelector(".v3c-bridge")?.innerText ?? ""),
          bestNote: /best price a linked partner book pays/.test(txt),
          hhmm: /\(hh:mm\)/.test(txt),
          raw: /FortunePlay\/YBets price captured|prediction_log|docs\/v3c/.test(txt),
          prefill: document.querySelector("[data-testid='prefill-note']")?.textContent ?? null,
          priceIn: document.querySelector("[data-testid='in-price']")?.value ?? null,
        };
      });
      await page.screenshot({ path: `${OUT}/${tag}.png` });
      if (mode === "light") await page.screenshot({ path: `${OUT}/full-${tag}.png`, fullPage: true });
      report.push({ run: tag, status: resp?.status() ?? null, errors, ...facts });
      await ctx.close();
    }
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
for (const x of report) console.log(x.run, x.status, "ow", x.ow, "err", x.errors.length, JSON.stringify({ q3: x.q3, fair: x.fairPrice, largest: x.largest, mo: x.marketOnly, c194: x.composite194, b182: x.best182, note: x.bestNote, hhmm: x.hhmm, raw: x.raw, prefill: x.prefill, price: x.priceIn }), x.errors.slice(0, 2).join(" | "));
