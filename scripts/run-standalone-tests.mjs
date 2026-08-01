#!/usr/bin/env node
/**
 * #TESTS-CI-0801 — esegue i test di `tests/` che vitest NON vede.
 *
 * IL PROBLEMA. `vitest.config.ts` include solo
 * `{app,lib,components,features}/**\/*.test.{ts,tsx}` e nessun workflow lancia i
 * `.ts` di `tests/`: 36 file di test TypeScript non venivano eseguiti da nessuno.
 * I `test_*.py` della stessa cartella girano con pytest — il buco era solo TS.
 *
 * PERCHÉ NON BASTA ALLARGARE L'INCLUDE. Censiti il 2026-08-01: **tutti e 36 non
 * importano nulla da vitest**. Sono script autonomi in stile `node:assert` /
 * `node:test`, eseguiti dall'alto verso il basso, che lanciano un'eccezione al
 * primo fallimento. Dentro vitest non sono suite valide: allargare l'include li
 * avrebbe fatti fallire in massa con "No test suite found", cioè 36 rossi finti
 * che avrebbero sepolto quelli veri. Vanno eseguiti con un runner TS, ed è
 * quello che fa questo script.
 *
 * COSA HA TROVATO al primo giro (31 verdi, 5 rossi):
 *   - 3 test VECCHI, codice giusto: la tolleranza fee PayGate stretta da 50% a
 *     15% (#anti-revenue-leak), il blocco geo legale IT/DE/FR/NL/ES/BE, e il
 *     contratto del why tennis (sotto floor il chiamante non genera prosa
 *     affatto, non una prosa diversa). Aggiornati nello stesso commit.
 *   - 2 test che richiedono SEGRETI (CRM_UNSUB_SECRET/SESSION_SECRET,
 *     RESEND_API_KEY): dichiarati in REQUIRES_ENV qui sotto. Senza le variabili
 *     vengono SALTATI con un messaggio esplicito invece di fallire — un test
 *     saltato lo si vede, un rosso da env mancante lo si impara a ignorare, e un
 *     rosso ignorato è come non avere il test.
 *
 * Uso:  node scripts/run-standalone-tests.mjs [--only <substring>]
 * Exit: 0 se tutti i file eseguiti passano, 1 al primo fallimento reale.
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";

const DIR = "tests";
// Il CLI di tsx risolto dal package installato: nessuna assunzione sul PATH.
const TSX_CLI = createRequire(import.meta.url).resolve("tsx/package.json").replace(/package\.json$/, "dist/cli.mjs");

// File che non possono girare senza segreti: chiave = file, valore = variabili
// che devono esserci TUTTE. Servono per un fail-closed reale nel codice sotto
// test (es. la firma dell'unsubscribe CRM), quindi non si possono fingere.
const REQUIRES_ENV = {
  "crm-content.test.ts": ["CRM_UNSUB_SECRET"],
  "resend-contacts.test.ts": ["RESEND_API_KEY"],
};

const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;

const files = readdirSync(DIR)
  .filter((f) => /\.test\.tsx?$/.test(f))
  .filter((f) => !only || f.includes(only))
  .sort();

let pass = 0;
const skipped = [];
const failed = [];

for (const f of files) {
  const need = REQUIRES_ENV[f] ?? [];
  const missing = need.filter((v) => !process.env[v]);
  if (missing.length) {
    skipped.push(`${f} (manca ${missing.join(", ")})`);
    console.log(`SKIP  ${f} — richiede ${missing.join(", ")}`);
    continue;
  }
  // Niente `npx` e niente shell: si invoca il CLI di tsx con l'eseguibile node
  // corrente. Con shell:true gli argomenti vengono concatenati senza escaping
  // (DEP0190); con "npx" nudo si dipende dal PATH, e su Windows serve npx.cmd —
  // che in Git Bash non c'è. Questo modo funziona identico su ogni shell e OS.
  const r = spawnSync(process.execPath, [TSX_CLI, join(DIR, f)], { encoding: "utf8" });
  if (r.status === 0) {
    pass++;
    console.log(`ok    ${f}`);
  } else {
    failed.push(f);
    console.log(`FAIL  ${f}`);
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`
      .split("\n")
      .filter((l) => l.trim() && !/^\s*at /.test(l))
      .slice(0, 14);
    for (const l of out) console.log(`        ${l}`);
  }
}

console.log(
  `\n${pass} verdi · ${failed.length} rossi · ${skipped.length} saltati (su ${files.length} file)`
);
if (skipped.length) console.log(`saltati: ${skipped.join(" · ")}`);
if (failed.length) {
  console.log(`rossi: ${failed.join(" · ")}`);
  process.exit(1);
}
