// qa-session.mjs — apre UNA sessione per l'account di misura e la salva.
//
// PERCHÉ ESISTE. Le superfici da loggato (il desk, lo storico, il match
// builder, i piani da cliente) sono la metà del prodotto, e per misurarle serve
// una sessione. Fino a oggi si dipendeva dal browser di Andrea: funzionava una
// volta e poi bloccava il renderer, e a 390px non si riusciva affatto.
//
// COSA NON FA, di proposito:
//   · non registra account e non compila form di login;
//   · non conosce nessuna password — l'account `qa-mobile-390` NON ne ha una
//     (`password_hash IS NULL`), quindi non c'è nulla da custodire e nessuno può
//     entrarci per quella via;
//   · non aggiunge nessuna scorciatoia di autenticazione al prodotto. Un bypass
//     env-gated sarebbe stato più comodo e sarebbe rimasto in produzione su un
//     prodotto che incassa: scambio sbagliato.
//
// COME FUNZIONA. Usa il meccanismo che il prodotto ha già: il link di
// attivazione (`/api/auth/activate`) verifica un token monouso e imposta il
// cookie di sessione firmato. Il cookie vale 30 giorni
// (SESSION_TTL_SECONDS in lib/session.ts), quindi una attivazione basta per un
// mese di misure ripetibili.
//
// L'identificativo non contiene `@`, e nel codice quello significa «non
// scrivibile per email»: `lib/crm.ts:63`, `lib/weekly-pick-server.ts:75`,
// `lib/plan-grant.ts:33` e la stessa rotta di attivazione saltano l'invio. Per
// questo l'account non riceve welcome, CRM, ricevute o weekly pick: non è una
// dimenticanza, è la ragione per cui l'identificativo è fatto così.
//
// USO
//   1) prima volta:  node qa-session.mjs --attiva --token-file=<file>
//   2) poi:          node qa-session.mjs --verifica
//   Quando il cookie scade (30 giorni) serve un token nuovo: azzerare
//   `activated_at` e riscrivere `activation_token_hash` sul profilo. È una
//   scrittura sul DB di produzione, quindi passa da una conferma umana.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "/Users/calde/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const val = (n, d) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};

const BASE = val("base", "https://www.betredge.com");
const ID = val("id", "qa-mobile-390");
// Lo stato di sessione vive FUORI dal repo: non c'è modo di committarlo per sbaglio.
const STATO = val("stato", "/private/tmp/claude-501/qa-session-betredge.json");

async function attiva(tokenFile) {
  if (!tokenFile || !existsSync(tokenFile)) {
    console.error(`token non trovato: passa --token-file=<percorso>`);
    process.exit(2);
  }
  const token = readFileSync(tokenFile, "utf8").trim();
  if (!token) {
    console.error("il file del token è vuoto");
    process.exit(2);
  }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Il link è monouso: se questo giro fallisce, il token è comunque consumato
  // solo se la rotta ha scritto `activated_at`. Si legge l'esito dal redirect.
  const url = `${BASE}/api/auth/activate?token=${encodeURIComponent(token)}&id=${encodeURIComponent(ID)}`;
  await page.goto(url, { waitUntil: "load", timeout: 45000 });
  const esito = new URL(page.url()).searchParams.get("activation");
  if (esito && esito !== "ok") {
    console.error(`attivazione rifiutata: ${esito}`);
    console.error(esito === "already" ? "  (il profilo era già attivato: serve azzerare activated_at e un token nuovo)" : "");
    await browser.close();
    process.exit(1);
  }

  // La prova che la sessione esiste: una rotta che risponde solo da loggato.
  const r = await page.request.get(`${BASE}/api/auth`);
  const corpo = await r.json().catch(() => ({}));
  if (r.status() !== 200) {
    console.error(`sessione NON stabilita: /api/auth ha risposto ${r.status()}`);
    await browser.close();
    process.exit(1);
  }

  mkdirSync(dirname(STATO), { recursive: true });
  await ctx.storageState({ path: STATO });
  writeFileSync(tokenFile, "", { mode: 0o600 }); // il token è consumato: si azzera
  console.log(`sessione aperta e salvata in ${STATO}`);
  console.log(`  piano risolto dal server: ${corpo?.plan ?? corpo?.profile?.plan ?? "(vedi risposta)"}`);
  console.log(`  il token è stato consumato e il file azzerato`);
  await browser.close();
}

async function verifica() {
  if (!existsSync(STATO)) {
    console.error(`nessuna sessione salvata in ${STATO} — lancia prima --attiva`);
    process.exit(2);
  }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: STATO, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const r = await page.request.get(`${BASE}/api/auth`);
  const corpo = await r.json().catch(() => ({}));
  console.log(`  /api/auth → ${r.status()} · piano ${corpo?.plan ?? corpo?.profile?.plan ?? "?"}`);
  if (r.status() !== 200) {
    console.error("  la sessione non è più valida: serve un token di attivazione nuovo");
    await browser.close();
    process.exit(1);
  }
  await browser.close();
}

if (flag("attiva")) await attiva(val("token-file", ""));
else if (flag("verifica")) await verifica();
else {
  console.log("uso: --attiva --token-file=<file>  |  --verifica");
  process.exit(2);
}
