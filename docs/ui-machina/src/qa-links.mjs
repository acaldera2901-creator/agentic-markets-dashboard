/* Striscia i link INTERNI e fallisce sui 404. #WC-SLUG-ROT-0821
 *
 * Nato da due pagine squadra del Mondiale che rispondevano 404 a un utente che
 * le cliccava dal hub: la mappa degli alias puntava a una grafia del dataset che
 * era cambiata, e nessun test poteva accorgersene perche' il difetto vive fra il
 * link e il DB, non dentro una funzione.
 *
 * Questa e' la rete: prende gli href veri delle pagine, li chiama, e riporta
 * quelli che rompono. 401/403 non contano (sono i gate di accesso).
 *
 * Uso:  node docs/ui-machina/src/qa-links.mjs [base-url]
 */
import { chromium } from "/Users/calde/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs";

const BASE = process.argv[2] || "http://localhost:3011";
const PAGINE = ["/", "/app", "/plans", "/tools", "/blog", "/partners", "/weekly-pick",
                "/community", "/world-cup", "/history", "/leaderboard", "/terms", "/privacy"];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addInitScript(() => {
  try { localStorage.setItem("agentic-theme", "dark"); localStorage.setItem("br_cookie_consent", "accepted"); } catch {}
});
const p = await ctx.newPage();

const visti = new Map();   // href → pagina di provenienza
for (const pagina of PAGINE) {
  await p.goto(BASE + pagina, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const hrefs = await p.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
  for (const h of hrefs) {
    if (!h || !h.startsWith("/") || h.startsWith("//")) continue;
    if (!visti.has(h)) visti.set(h, pagina);
  }
}

const rotti = [];
for (const [href, da] of visti) {
  const r = await p.request.get(BASE + href).catch(() => null);
  const st = r ? r.status() : 0;
  if (st >= 400 && st !== 401 && st !== 403) rotti.push({ st, href, da });
}
await b.close();

console.log(`link interni distinti: ${visti.size} · ROTTI: ${rotti.length}`);
for (const r of rotti) console.log(`   ${r.st}  ${r.href}   (linkato da ${r.da})`);
process.exit(rotti.length ? 1 : 0);
