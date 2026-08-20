/* Apre una sessione PRO per il QA da loggato. #UI-MACHINA-0802
 *
 * Lo lancia ANDREA, non io: la password si digita qui e non passa
 * dalla chat, non finisce nella cronologia della shell (input nascosto)
 * e non viene mai scritta su disco. Sul disco finisce SOLO lo stato di
 * sessione del browser (/tmp/qa-session.json), che e' un cookie firmato.
 *
 * Uso:
 *   node docs/ui-machina/src/qa-login.mjs                  # locale :3011
 *   node docs/ui-machina/src/qa-login.mjs https://www.betredge.com
 */
import { chromium } from "/Users/calde/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs";
import readline from "node:readline";

const BASE = process.argv[2] || "http://localhost:3011";
const OUT = "/tmp/qa-session.json";

function ask(q, hidden = false) {
  return new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const onData = () => { rl.output.write("\x1B[2K\x1B[200D" + q); };
      rl.input.on("data", onData);
      rl.question(q, a => { rl.input.off("data", onData); rl.close(); process.stdout.write("\n"); res(a); });
    } else {
      rl.question(q, a => { rl.close(); res(a); });
    }
  });
}

const email = await ask("email: ");
const pass = await ask("password (non si vede): ", true);

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
await form.locator('input[placeholder*="@"]').fill(email);
await form.locator('input[type=password]').first().fill(pass);
await form.locator('button:has-text("Login")').last().click();
await p.waitForTimeout(7000);

const st = await p.evaluate(() => {
  const raw = localStorage.getItem("agentic-client-profile");
  return { profile: raw ? JSON.parse(raw) : null, lucchetto: !!document.querySelector(".locked-gate,.locked-overlay") };
});
if (!st.profile) {
  console.log("\n✗ login NON riuscito: nessun profilo in sessione. Password sbagliata, o il rail di auth risponde 401.");
  await b.close(); process.exit(1);
}
console.log(`\n✓ dentro come ${st.profile.email} · piano ${st.profile.plan} · lucchetto sulla board: ${st.lucchetto ? "SI" : "no"}`);
await ctx.storageState({ path: OUT });
console.log(`sessione salvata in ${OUT} — ora Claude puo' fare il QA da loggato senza vedere la password.`);
await b.close();
