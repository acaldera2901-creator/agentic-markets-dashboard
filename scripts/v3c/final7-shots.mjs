// scripts/v3c/final7-shots.mjs (#REDESIGN-V3C final7) — the local check of the fixdata3 + fixui3 merge and of R5 on
// the MOCK (mock-db.ts with MOCK_FIXDATA=1 MOCK_FIXDATA2=1 MOCK_FIXDATA3=1 MOCK_FIXUI2=1 MOCK_LIVE=1, no-network.cjs):
// 1440/390 × light/dark (+ de, ru, fr at 390), overflow, console errors (/api/track aborted) and the R5 facts: no
// «prices as of» in a section that says «No market» or «may be outdated», «Market only» never next to an estimate text.
// Usage: BASE=http://127.0.0.1:3678 OUT=/tmp/final7/shots ONLY=<name,name> LANGS=0 node scripts/v3c/final7-shots.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3678";
const OUT = process.env.OUT ?? "/tmp/final7/shots";
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["home", "/"],
  ["board", "/predictions"],
  ["board-tennis", "/predictions?sport=tennis"],
  ["m-fb", "/match/560593"],
  ["m-fb-live", "/match/oddsapi:live001"],
  ["m-fb-started", "/match/oddsapi:fx-started"],
  ["m-fb-15", "/match/oddsapi:fx-outlier18"],
  ["m-fb-25", "/match/oddsapi:fx-outlier25"],
  ["m-fb-nomkt", "/match/fx2-augsburg"],
  ["m-tn-elo", "/match/tennis:mock1"],
  ["m-tn-mktonly", "/match/tennis:mock4"],
  ["m-tn-stale", "/match/tennis:espn:fx3-stale"],
  ["m-tn-books", "/match/tennis:espn:fx3-books"],
  ["m-tn-nomkt", "/match/tennis:espn:fx3-none"],
  ["m-tn-inverted", "/match/tennis:espn:185274:bai-zhuoxuan:emerson-jones"],
  ["m-tn-started", "/match/tennis:espn:184885:daniel-altmaier:holger-rune"],
  ["m-tn-live", "/match/tennis:espn:990001:ben-shelton:lorenzo-musetti"],
  ["pc", "/price-check"],
  ["pc-guarded", "/price-check?m=oddsapi:fx-outlier25"],
  ["record", "/record"],
  ["t-stake", "/tools/stake-calculator"],
  ["t-roi", "/tools/roi-calculator"],
  ["t-arb", "/tools/arbitrage-calculator"],
  ["t-kelly", "/tools/kelly-criterion"],
  ["pricing", "/pricing"],
  ["partners", "/partners"],
  ["news", "/blog"],
  ["profilo", "/profilo"],
  ["invite", "/invite"],
];
const LANG_PAGES = ["home", "board-tennis", "m-tn-stale", "m-tn-nomkt", "m-fb-25", "pc", "t-kelly"];
const RUNS = [];
for (const w of [1440, 390]) for (const mode of ["light", "dark"]) for (const p of PAGES) RUNS.push({ w, mode, lang: "en", p });
if (process.env.LANGS !== "0") for (const lang of ["de", "ru", "fr"]) for (const p of PAGES.filter(([n]) => LANG_PAGES.includes(n))) RUNS.push({ w: 390, mode: "light", lang, p: p[1].startsWith("/tools") ? [p[0], `/${lang}${p[1]}`] : p });

const report = [];
const browser = await chromium.launch();
for (const r of RUNS) {
  const [name, path] = r.p;
  if (ONLY && !ONLY.has(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: r.w, height: r.w > 800 ? 900 : 844 }, colorScheme: r.mode, timezoneId: "Europe/Rome", locale: "en-GB" });
  await ctx.addInitScript(([lang]) => {
    try {
      localStorage.setItem("agentic-lang", lang);
      localStorage.setItem("gdpr_consent", "essential");
    } catch {}
  }, [r.lang]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && !/api\/track|partner-click/.test(`${m.text()} ${m.location()?.url ?? ""}`) && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.route("**/api/track**", (x) => x.abort());
  await page.route("**/api/partner-click**", (x) => x.abort());
  const resp = await page.goto(`${BASE}${path}${path.includes("?") ? "&" : "?"}mode=${r.mode}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(800);
  const tag = `${name}-${r.w}-${r.mode}-${r.lang}`;
  if (name === "board-tennis" && r.lang === "en") {
    for (const [k, s] of [["none", "Zheng Qinwen"], ["stale", "Humbert"], ["books", "Sonego"], ["elo", "Sinner"], ["bai", "Bai"]]) {
      const row = page.locator(`.v3c-row:has(.v3c-rowlink:has-text("${s}"))`).first();
      if (!(await row.count())) continue;
      await row.locator(".v3c-rowlink").click();
      await page.waitForTimeout(300);
      await row.scrollIntoViewIfNeeded();
      await row.screenshot({ path: `${OUT}/row-${tag}-${k}.png` });
    }
  }
  if (name === "home" && r.mode === "light") {
    const faq = page.locator(".v3c-faq").first();
    if (await faq.count()) { await faq.scrollIntoViewIfNeeded(); await faq.screenshot({ path: `${OUT}/faq-${tag}.png` }); }
  }
  const facts = await page.evaluate(() => {
    const de = document.documentElement;
    // R5: a section (match step, board panel/row) that says there is no reference price must not show a price time
    const secs = [...document.querySelectorAll(".v3c-mt-step, .v3c-pn, .v3c-row")].map((s) => s.innerText);
    const r5 = secs.filter((s) => /No market|may be outdated|Kein Markt|veraltet|Нет рынка|устаревш|Pas de marché|périmée/.test(s) && /prices as of|Quoten von|коэффициенты на|cotes à/.test(s)).length;
    const r6 = secs.filter((s) => /Market only/.test(s) && /estimate expects to be wrong|70% market \+ 30% model/.test(s)).length;
    const both = secs.filter((s) => /Market only/.test(s) && /Model only/.test(s)).length;
    return { ow: de.scrollWidth - de.clientWidth, r5, r6, both, h1: document.querySelector("h1")?.textContent?.trim().slice(0, 80) ?? null };
  });
  await page.screenshot({ path: `${OUT}/${tag}.png` });
  if (r.lang === "en" && r.mode === "light") await page.screenshot({ path: `${OUT}/full-${tag}.png`, fullPage: true });
  report.push({ run: tag, status: resp?.status() ?? null, errors, ...facts });
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
for (const x of report) console.log(x.run, x.status, "ow", x.ow, "err", x.errors.length, "r5", x.r5, "r6", x.r6, "both", x.both, x.errors.slice(0, 2).join(" | "));
