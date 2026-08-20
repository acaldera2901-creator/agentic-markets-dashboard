/* Apre una sessione PRO per il QA da loggato. #UI-MACHINA-0802
 *
 * La password la chiede a chi lancia lo script con una FINESTRA di macOS a
 * risposta nascosta, non da stdin: lanciato dentro un agente lo stdin non è un
 * terminale, readline non riceve nulla e il processo muore con
 * «unsettled top-level await» (succede davvero, provato).
 *
 * La password vive solo in memoria: non viene stampata, non finisce nella
 * cronologia della shell, non viene scritta su disco. Su disco finisce solo lo
 * stato di sessione del browser (/tmp/qa-session.json), cioè un cookie firmato.
 *
 * Uso:  node docs/ui-machina/src/qa-login.mjs [base-url]
 *       QA_EMAIL=… QA_PASS=… node …            (per automazioni: niente finestra)
 */
import { chromium } from "/Users/calde/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs";
import { execFileSync } from "node:child_process";

const BASE = process.argv[2] || "http://localhost:3011";
const OUT = "/tmp/qa-session.json";

function chiedi(prompt, nascosta, predefinito = "") {
  const hidden = nascosta ? " with hidden answer" : "";
  const script = `display dialog ${JSON.stringify(prompt)} default answer ${JSON.stringify(predefinito)}${hidden} with title "BetRedge — QA da loggato" buttons {"Annulla","OK"} default button "OK"`;
  try {
    const out = execFileSync("osascript", ["-e", script], { encoding: "utf8" });
    const m = out.match(/text returned:(.*)$/s);
    return m ? m[1].trim() : "";
  } catch {
    console.log("finestra annullata.");
    process.exit(1);
  }
}

const email = process.env.QA_EMAIL || chiedi("Email dell'account PRO:", false, "acaldera62@gmail.com");
const pass = process.env.QA_PASS || chiedi("Password (non viene mostrata né salvata):", true);
if (!email || !pass) { console.log("email o password vuote."); process.exit(1); }

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addInitScript(() => { try { localStorage.setItem("agentic-theme", "dark"); localStorage.setItem("br_cookie_consent", "accepted"); } catch {} });
const p = await ctx.newPage();
await p.goto(BASE + "/app", { waitUntil: "networkidle" }).catch(() => {});
await p.waitForTimeout(2500);

let form = p.locator("form.auth-modal");
if (await form.count() === 0) {
  await p.locator('button:has-text("Sign In"), button:has-text("Entrar"), button:has-text("Accedi")').first().click().catch(() => {});
  await p.waitForTimeout(1500);
  form = p.locator("form.auth-modal");
}
if (await form.count() === 0) { console.log("✗ modale di login non trovato su", BASE + "/app"); await b.close(); process.exit(1); }
await form.locator('input[placeholder*="@"]').fill(email);
await form.locator("input[type=password]").first().fill(pass);
await form.locator('button:has-text("Login")').last().click();
await p.waitForTimeout(8000);

const st = await p.evaluate(() => {
  const raw = localStorage.getItem("agentic-client-profile");
  return { profile: raw ? JSON.parse(raw) : null, lucchetto: !!document.querySelector(".locked-gate,.lock-overlay") };
});
if (!st.profile) {
  console.log("\n✗ login NON riuscito: nessun profilo in sessione (password errata, o il rail di auth risponde 401).");
  await b.close(); process.exit(1);
}
console.log(`\n✓ dentro come ${st.profile.email} · piano ${st.profile.plan} · lucchetto ancora presente: ${st.lucchetto ? "SÌ" : "no"}`);
await ctx.storageState({ path: OUT });
console.log(`sessione salvata in ${OUT} — Claude può fare il QA da loggato senza vedere la password.`);
await b.close();
