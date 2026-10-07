// scripts/v3c/final6-shots.mjs (#REDESIGN-V3C final6) — the local check of the fixdata2 + fixui2 merge on the MOCK
// (mock-db.ts with MOCK_FIXDATA=1 MOCK_FIXDATA2=1 MOCK_FIXUI2=1 MOCK_LIVE=1, no-network.cjs): every v3c page at
// 1440/390 × light/dark, de/ru/fr at 390, Books at 360/375/390/430; overflow, console errors (/api/track aborted),
// and the DOM facts of the reconciliations: no € amount from a default bankroll, no price/CTA on a started match,
// one time zone per view, the guard on the tool examples.
// Usage: BASE=http://127.0.0.1:3666 OUT=/tmp/final6-shots ONLY=<name,name> node scripts/v3c/final6-shots.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3666";
const OUT = process.env.OUT ?? "/tmp/final6-shots";
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
  ["m-tn-25", "/match/tennis:mock2"],
  ["m-tn-started", "/match/tennis:espn:184885:daniel-altmaier:holger-rune"],
  ["m-tn-live", "/match/tennis:espn:990001:ben-shelton:lorenzo-musetti"],
  ["m-tn-sealed15", "/match/tennis:espn:185246:anna-blinkova:caroline-werner"],
  ["pc", "/price-check"],
  ["pc-m", "/price-check?m=560593"],
  ["pc-guarded", "/price-check?m=oddsapi:fx-outlier25"],
  ["record", "/record"],
  ["tools", "/tools"],
  ["t-kelly", "/tools/kelly-criterion"],
  ["t-kelly-board", "/tools/kelly-criterion?m=560593"],
  ["t-bankroll", "/tools/bankroll-calculator"],
  ["t-ev", "/tools/ev-calculator"],
  ["pricing", "/pricing"],
  ["books", "/partners"],
  ["news", "/blog"],
  ["article", "/blog/mock-tennis-asian-swing"],
  ["404", "/no-such-page-final6"],
  ["community", "/community"],
  ["leaderboard", "/leaderboard"],
  ["invite", "/invite"],
];
const RUNS = [];
for (const w of [1440, 390]) for (const mode of ["light", "dark"]) for (const p of PAGES) RUNS.push({ w, mode, lang: "en", p });
// the tool pages are localised by path (/de/tools/…), the others by the stored language
for (const lang of ["de", "ru", "fr"]) for (const p of PAGES.filter(([n]) => ["home", "board", "m-fb", "pc-m", "t-kelly", "books", "record"].includes(n))) RUNS.push({ w: 390, mode: "light", lang, p: p[1].startsWith("/tools") ? [p[0], `/${lang}${p[1]}`] : p });
for (const w of [360, 375, 430]) RUNS.push({ w, mode: "light", lang: "en", p: ["books", "/partners"] });

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
  page.on("console", (m) => m.type() === "error" && !/api\/track|ERR_FAILED|partner-click/.test(m.text()) && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.route("**/api/track**", (x) => x.abort());
  await page.route("**/api/partner-click**", (x) => x.abort());
  const resp = await page.goto(`${BASE}${path}${path.includes("?") ? "&" : "?"}mode=${r.mode}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(800);
  const facts = await page.evaluate(() => {
    const de = document.documentElement;
    const txt = document.body.innerText;
    // any money amount in visible text, with its context (pricing has the Pro price; the rest is reviewed by eye)
    const money = [...txt.matchAll(/.{0,40}(?:[€$£]\s?\d[\d.,]*|\d[\d.,]*\s?[€$£]).{0,30}/g)].map((m) => m[0].replace(/\s+/g, " "));
    const bankMoney = money.filter((s) => /bankroll|banca|bankrulle|kasa|банкролл|of a €|€\d+ of/i.test(s));
    const started = [...document.querySelectorAll(".v3c-row")].filter((row) => /Started|Live|In corso|LIVE/i.test(row.querySelector(".v3c-r-time, .v3c-live")?.textContent ?? ""));
    return {
      status: null,
      ow: de.scrollWidth - de.clientWidth,
      money: money.slice(0, 12),
      bankMoney,
      tzNotes: [...document.querySelectorAll(".v3c-tz")].map((n) => n.textContent.trim()),
      utcTimes: (txt.match(/\d{1,2}:\d{2}\s?UTC/g) ?? []).length,
      startedRowsWithBook: started.filter((row) => row.querySelector(".v3c-r-book a, .v3c-r-book .v3c-bookchip, .v3c-r-book [rel*=sponsored]")).length,
      startedRows: started.length,
      sponsored: document.querySelectorAll('a[rel*="sponsored"]').length,
      seals: [...document.querySelectorAll(".v3c-seal")].slice(0, 3).map((s) => `${s.dataset.seal ?? "pre"}:${s.textContent.replace(/\s+/g, " ").trim()}`),
      pcInputs: [...document.querySelectorAll(".v3c-pc-form input")].map((i) => i.value),
      pcState: document.querySelector("[data-pc]")?.getAttribute("data-pc") ?? null,
      strip: document.querySelector(".v3c-mt-strip")?.innerText.replace(/\s+/g, " ").slice(0, 200) ?? null,
      toolNote: document.querySelector('[data-testid="tool-note"]')?.textContent ?? null,
      toolBig: document.querySelector('[data-testid="out-big"]')?.textContent ?? null,
      bankInput: document.querySelector('input[name="bank"]')?.value ?? null,
      guardNote: document.querySelector(".v3c-guard-note")?.textContent ?? null,
      robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
      bench: document.querySelector(".v3c-bench")?.innerText.replace(/\s+/g, " ").slice(0, 300) ?? null,
    };
  });
  facts.status = resp?.status() ?? null;
  const file = `${name}-${r.w}-${r.mode}-${r.lang}.png`;
  await page.screenshot({ path: `${OUT}/${file}` });
  if (r.lang === "en" && r.mode === "light") {
    await page.screenshot({ path: `${OUT}/full-${file}`, fullPage: true });
  }
  report.push({ run: file, errors, ...facts });
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
for (const x of report) console.log(x.run, x.status, "ow", x.ow, "err", x.errors.length, x.bankMoney.length ? `BANK€:${x.bankMoney.join("|")}` : "", x.startedRowsWithBook ? `STARTED-BOOK:${x.startedRowsWithBook}` : "");
