// scripts/v3c/fixui3-shots.mjs (#REDESIGN-V3C fixui3) — the local check of the fourth UI round on the MOCK
// (mock-db.ts with MOCK_FIXDATA=1 MOCK_FIXDATA2=1 MOCK_FIXUI2=1 MOCK_LIVE=1 MOCK_NEWS=1, no-network.cjs): the
// touched pages at 1440/390 × light/dark, de/ru/fr at 390; the home FAQ opened, the footer cropped, overflow,
// console errors, /api/track aborted, and the DOM facts of B3 R1 R4 N12 L1 M7 (QA-REPORT-3).
// Usage: BASE=http://127.0.0.1:3633 OUT=/tmp/fixui3-shots node scripts/v3c/fixui3-shots.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3633";
const OUT = process.env.OUT ?? "/tmp/fixui3-shots";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["home", "/"],
  ["record", "/record"],
  ["news", "/blog"],
  ["match", "/match/560593"],
  ["hub", "/tools"],
  ["stake", "/tools/stake-calculator"],
  ["roi", "/tools/roi-calculator"],
  ["yield", "/tools/yield-calculator"],
  ["arb", "/tools/arbitrage-calculator"],
  ["kelly", "/tools/kelly-criterion"],
  ["profilo", "/profilo"],
  ["invite", "/invite"],
];
const LOCALISED = { stake: "/{l}/tools/stake-calculator", kelly: "/{l}/tools/kelly-criterion", hub: "/{l}/tools" };
const RUNS = [];
for (const w of [1440, 390]) for (const mode of ["light", "dark"]) for (const p of PAGES) RUNS.push({ w, mode, lang: "en", p });
for (const lang of ["de", "ru", "fr"])
  for (const p of PAGES.filter(([n]) => ["home", "record", "stake", "kelly", "hub", "profilo", "match"].includes(n)))
    RUNS.push({ w: 390, mode: "light", lang, p: [p[0], LOCALISED[p[0]] ? LOCALISED[p[0]].replace("{l}", lang) : p[1]] });

const report = [];
const browser = await chromium.launch();
for (const r of RUNS) {
  const ctx = await browser.newContext({ viewport: { width: r.w, height: r.w > 800 ? 900 : 844 }, colorScheme: r.mode, timezoneId: "Europe/Rome", locale: "en-GB" });
  await ctx.addInitScript((lang) => {
    try {
      localStorage.setItem("agentic-lang", lang);
      localStorage.setItem("gdpr_consent", "essential");
    } catch {}
  }, r.lang);
  const page = await ctx.newPage();
  const errors = [];
  let tracked = 0;
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.route("**/api/track**", (x) => { tracked += 1; return x.abort(); });
  await page.route("**/api/partner-click**", (x) => x.abort());
  const [name, path] = r.p;
  await page.goto(`${BASE}${path}${path.includes("?") ? "&" : "?"}mode=${r.mode}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(700);
  // open every FAQ answer, so the shot shows the words
  await page.evaluate(() => document.querySelectorAll(".v3c-faq details").forEach((d) => d.setAttribute("open", "")));
  const facts = await page.evaluate(() => {
    const de = document.documentElement;
    const txt = document.body.innerText;
    const inputs = [...document.querySelectorAll(".v3c-tf input")].map((i) => ({ n: i.name, v: i.value, ph: i.placeholder }));
    const big = document.querySelector('[data-testid="out-big"]');
    return {
      ow: de.scrollWidth - de.clientWidth,
      oldSite: [...document.querySelectorAll("a")].map((a) => a.getAttribute("href") || "").filter((h) => /\/plans|auth=|checkout=/.test(h)),
      existingMembers: /Existing members|Utenti già registrati|Bestehende Mitglieder/.test(txt),
      absolute: [...document.querySelectorAll("a")].map((a) => a.getAttribute("href") || "").filter((h) => /^https?:\/\/(www\.)?betredge\.com/.test(h)),
      faq: [...document.querySelectorAll(".v3c-faq details")].map((d) => d.innerText.replace(/\s+/g, " ").slice(0, 200)),
      faqBad: /reads the game|rilegge|all of them sealed|Pro features included|Live is a Pro feature/i.test(txt),
      inputs,
      big: big ? big.textContent : null,
      euroInTool: document.querySelector(".v3c-tres") ? /€/.test(document.querySelector(".v3c-tres").innerText) : null,
      exampleLabel: document.querySelector('[data-v3c="example-label"]')?.textContent ?? null,
      previews: [...document.querySelectorAll(".v3c-tr-ex")].map((e) => e.innerText.replace(/\s+/g, " ")).slice(0, 12),
      proBuy: /Get Pro|Upgrade|Buy Pro|\/month|\/mese|Subscribe/i.test(txt),
      accountSoon: document.querySelector('[data-v3c="account-soon"]')?.innerText.replace(/\s+/g, " ") ?? null,
      ende: (txt.match(/ENDE\s*\/?\s*Ende/g) || []).length,
      title: document.title,
    };
  });
  const file = `${name}-${r.lang}-${r.w}-${r.mode}`;
  await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
  const foot = page.locator("footer.v3c-foot");
  if ((await foot.count()) && ["home", "record", "kelly"].includes(name)) await foot.first().screenshot({ path: `${OUT}/${file}-foot.png` });
  const faq = page.locator(".v3c-faq");
  if (name === "home" && (await faq.count())) await faq.first().screenshot({ path: `${OUT}/${file}-faq.png` });
  const calc = page.locator(".v3c-tf");
  if (await calc.count()) {
    await page.locator(".v3c-tf").first().scrollIntoViewIfNeeded();
    const box = await page.locator(".v3c-tres").first().boundingBox();
    const fbox = await calc.first().boundingBox();
    if (box && fbox) await page.screenshot({ path: `${OUT}/${file}-calc.png`, clip: { x: 0, y: Math.max(0, fbox.y - 140), width: r.w, height: Math.min(900, box.y + box.height - fbox.y + 180) } });
    const ex = page.locator(".v3c-example");
    if (await ex.count()) await ex.first().screenshot({ path: `${OUT}/${file}-example.png` });
  }
  report.push({ run: file, errors, tracked, ...facts });
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
const bad = report.filter((x) => x.ow > 0 || x.errors.length || x.oldSite.length || x.existingMembers || x.absolute.length || x.faqBad || x.euroInTool || x.proBuy || x.ende);
console.log(`${report.length} runs · ${bad.length} with a problem`);
for (const b of bad) console.log(b.run, JSON.stringify({ ow: b.ow, errors: b.errors, oldSite: b.oldSite, em: b.existingMembers, abs: b.absolute, faqBad: b.faqBad, euro: b.euroInTool, proBuy: b.proBuy, ende: b.ende }));
