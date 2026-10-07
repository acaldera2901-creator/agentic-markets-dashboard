// scripts/v3c/fixui2-shots.mjs (#REDESIGN-V3C fixui2) — the local check of the third UI round on the MOCK
// (mock-db.ts with MOCK_FIXDATA=1 MOCK_FIXUI2=1, no-network.cjs): the touched pages at 1440/390 × light/dark,
// de/ru/fr at 390, Books at 360/375/390/430 with the cookie banner open; overflow, console errors, /api/track
// aborted, and the DOM facts of N1 B3 N4 N6 N7 N8 N5 N13.
// Usage: BASE=http://127.0.0.1:3611 OUT=/tmp/fixui2-shots node scripts/v3c/fixui2-shots.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3611";
const OUT = process.env.OUT ?? "/tmp/fixui2-shots";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["home", "/"],
  ["match", "/match/560593"],
  ["match-guarded", "/match/oddsapi:fx2-guarded-first"],
  ["pc", "/price-check"],
  ["pc-m", "/price-check?m=560593"],
  ["pc-missing", "/price-check?m=oddsapi:not-on-the-board"],
  ["books", "/partners"],
  ["record", "/record"],
  ["community", "/community"],
];
const RUNS = [];
for (const w of [1440, 390]) for (const mode of ["light", "dark"]) for (const p of PAGES) RUNS.push({ w, mode, lang: "en", p });
for (const lang of ["de", "ru", "fr"]) for (const p of PAGES.filter(([n]) => ["home", "pc", "books", "match"].includes(n))) RUNS.push({ w: 390, mode: "light", lang, p });
for (const w of [360, 375, 430]) RUNS.push({ w, mode: "light", lang: "en", p: ["books", "/partners"], banner: true });
for (const w of [360, 375, 390, 430]) RUNS.push({ w, mode: "light", lang: "en", p: ["books-banner", "/partners"], banner: true });

const report = [];
const browser = await chromium.launch();
for (const r of RUNS) {
  const ctx = await browser.newContext({ viewport: { width: r.w, height: r.w > 800 ? 900 : 844 }, colorScheme: r.mode, timezoneId: "Europe/Rome", locale: "en-GB" });
  await ctx.addInitScript(([lang, banner]) => {
    try {
      localStorage.setItem("agentic-lang", lang);
      if (!banner) localStorage.setItem("gdpr_consent", "essential");
    } catch {}
  }, [r.lang, Boolean(r.banner)]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.route("**/api/track**", (x) => x.abort());
  await page.route("**/api/partner-click**", (x) => x.abort());
  const [name, path] = r.p;
  await page.goto(`${BASE}${path}${path.includes("?") ? "&" : "?"}mode=${r.mode}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(700);
  const facts = await page.evaluate(() => {
    const de = document.documentElement;
    const txt = document.body.innerText;
    const bench = document.querySelector(".v3c-bench");
    const accept = [...document.querySelectorAll(".v3c-consent button")].map((b) => { const x = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 20), l: Math.round(x.left), r: Math.round(x.right) }; });
    return {
      ow: de.scrollWidth - de.clientWidth,
      vw: de.clientWidth,
      signIn: [...document.querySelectorAll("a")].filter((a) => /auth=login/.test(a.getAttribute("href") || "")).map((a) => a.textContent.trim()),
      benchText: bench ? bench.innerText.replace(/\s+/g, " ").slice(0, 400) : null,
      benchMoney: bench ? /[€$£]/.test(bench.innerText) : null,
      benchGuarded: bench ? /Como|Cagliari/.test(bench.innerText) : null,
      pcInputs: [...document.querySelectorAll(".v3c-pc-form input")].map((i) => i.value),
      pcMissing: !!document.querySelector('[data-pc="not-listed"]'),
      pcEmpty: !!document.querySelector('[data-pc="empty"]'),
      pcMoney: document.querySelector(".v3c-mt-strip") ? /€\d+ of|bankroll/i.test(document.querySelector(".v3c-mt-strip").innerText) : null,
      seals: [...document.querySelectorAll(".v3c-seal")].slice(0, 3).map((s) => s.textContent.replace(/\s+/g, " ").trim()),
      robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
      seePro: /See Pro|open with Pro|Compare Free and Pro|See what Pro adds/.test(txt),
      accept,
    };
  });
  const file = `${name}-${r.w}-${r.mode}-${r.lang}${r.banner ? "-banner" : ""}.png`;
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: r.w > 800 || name.startsWith("books") ? false : false });
  if (name === "home") {
    await page.locator(".v3c-bench").scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: `${OUT}/bench-${r.w}-${r.mode}-${r.lang}.png` });
  }
  if (name.startsWith("pc")) {
    await page.locator(".v3c-pc-form").scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: `${OUT}/pcform-${name}-${r.w}-${r.mode}-${r.lang}.png` });
  }
  if (name === "match") {
    await page.locator(".v3c-mt-reg").scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: `${OUT}/seal-${r.w}-${r.mode}-${r.lang}.png` });
  }
  if (name === "books" && r.w === 390 && r.mode === "light" && r.lang === "en") {
    // stress: 9 more book columns in the price table (prod has more connected books than the mock)
    const ow2 = await page.evaluate(() => {
      const tr = document.querySelectorAll(".v3c-pg-cmp tr");
      tr.forEach((row) => { const c = row.lastElementChild; for (let i = 0; i < 9; i++) row.appendChild(c.cloneNode(true)); });
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
    facts.owStress9 = ow2;
  }
  if (name === "record" || name === "community") {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${name}-bottom-${r.w}-${r.mode}.png` });
  }
  report.push({ run: file, errors, ...facts });
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
for (const x of report) console.log(x.run, "ow", x.ow, x.owStress9 != null ? `stress ${x.owStress9}` : "", "err", x.errors.length, x.signIn.length ? `signIn:${x.signIn.join("|")}` : "");
