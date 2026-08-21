/* Spazzata di QA su tutte le rotte vive, nei due temi. #UI-MACHINA-0802
 *
 * Per ogni rotta e tema misura: stato HTTP, errori di console, richieste
 * fallite, immagini rotte, scorrimento orizzontale a 390 e 1440, e la presenza
 * dello scope del sistema nuovo. Non giudica il gusto: conta i fatti.
 *
 * Uso: node docs/ui-machina/src/qa-sweep.mjs http://localhost:3011
 */
import { chromium } from "/Users/calde/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs";

const BASE = process.argv[2] || "http://localhost:3011";
const ROUTES = ["/", "/app", "/history", "/leaderboard", "/plans", "/tools", "/weekly-pick",
                "/partners", "/world-cup", "/community", "/blog", "/terms", "/privacy", "/match-builder"];
const THEMES = ["dark", "light"];
const WIDTHS = [390, 1440];

const browser = await chromium.launch();
const rows = [];
for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(t => { try { localStorage.setItem("agentic-theme", t); localStorage.setItem("br_cookie_consent", "accepted"); } catch {} }, theme);
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const errs = [], failed = [];
    page.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0, 90)); });
    page.on("requestfailed", r => failed.push(r.url().split("/").pop().slice(0, 40)));
    let status = "—";
    try {
      const resp = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45000 });
      status = resp ? resp.status() : "?";
    } catch { try { const r2 = await page.goto(BASE + route, { waitUntil: "load", timeout: 30000 }); status = r2 ? r2.status() : "?"; } catch { status = "TIMEOUT"; } }
    await page.waitForTimeout(1500);
    const over = {};
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(700);
      over[w] = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
    }
    const info = await page.evaluate(() => ({
      scope: !!document.querySelector("[data-mc-ground]"),
      cards: document.querySelectorAll("article.card[data-mc]").length,
      photos: [...document.querySelectorAll(".card-bg")].filter(e => getComputedStyle(e).backgroundImage.startsWith("url(")).length,
      cardsTotal: document.querySelectorAll(".card-bg").length,
      brokenImgs: [...document.querySelectorAll("img")].filter(i => i.complete && i.naturalWidth === 0).map(i => (i.src || "").split("/").pop()).slice(0, 3),
      icons: document.querySelectorAll('img[src*="menu-"],img[src*="sport-"]').length,
    }));
    rows.push({ theme, route, status, over390: over[390], over1440: over[1440], ...info, errs: errs.length, failed: failed.length, errSample: errs[0] || "", failSample: failed[0] || "" });
    await page.close();
  }
  await ctx.close();
}
await browser.close();

const pad = (s, n) => String(s).padEnd(n);
console.log(pad("tema", 6) + pad("rotta", 16) + pad("http", 6) + pad("ovf390", 8) + pad("ovf1440", 9) + pad("scope", 7) + pad("schede", 8) + pad("foto", 6) + pad("icone", 7) + pad("errJS", 7) + pad("req✗", 6) + "img rotte");
for (const r of rows) {
  console.log(pad(r.theme, 6) + pad(r.route, 16) + pad(r.status, 6) + pad(r.over390, 8) + pad(r.over1440, 9) +
    pad(r.scope ? "sì" : "no", 7) + pad(r.cards, 8) + pad(`${r.photos}/${r.cardsTotal}`, 6) + pad(r.icons, 7) +
    pad(r.errs, 7) + pad(r.failed, 6) + (r.brokenImgs.length ? r.brokenImgs.join(",") : "0"));
}
const bad = rows.filter(r => r.status !== 200 || r.over390 > 1 || r.over1440 > 1 || r.brokenImgs.length || (r.photos !== r.cardsTotal));
console.log(`\nRIGHE CON QUALCOSA DA GUARDARE: ${bad.length} su ${rows.length}`);
for (const r of bad) console.log(`  ${r.theme} ${r.route} → http ${r.status} · ovf ${r.over390}/${r.over1440} · foto ${r.photos}/${r.cardsTotal} · img rotte ${r.brokenImgs.join(",") || 0}`);
const withErr = rows.filter(r => r.errs || r.failed);
console.log(`\nROTTE CON ERRORI JS O RICHIESTE FALLITE: ${withErr.length}`);
for (const r of withErr) console.log(`  ${r.theme} ${r.route} → ${r.errs} errJS ${r.failed} req✗ · ${r.errSample || r.failSample}`);
