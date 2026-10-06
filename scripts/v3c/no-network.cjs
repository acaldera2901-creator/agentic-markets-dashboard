// scripts/v3c/no-network.cjs (#REDESIGN-V3C polish) — preload per il dev server
// LOCALE del redesign: `NODE_OPTIONS="--require ./scripts/v3c/no-network.cjs"`.
// Ogni fetch lato server verso un host che non sia la macchina locale (o i font
// di Google che next/font scarica in compilazione) viene rifiutato e stampato.
// Insieme al finto Supabase (scripts/v3c/mock-db.ts) garantisce che nessuna
// pagina aperta in locale legga o scriva il DB di produzione, né chiami feed,
// tracker o servizi esterni. Non entra mai nella build: è solo un --require.
"use strict";
const ALLOWED = new Set(["127.0.0.1", "localhost", "::1", "fonts.googleapis.com", "fonts.gstatic.com"]);
const original = globalThis.fetch;
let blocked = 0;
if (typeof original === "function") {
  globalThis.fetch = function guardedFetch(input, init) {
    let host = "";
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      host = new URL(url).hostname;
    } catch {
      return original.call(this, input, init);
    }
    if (!ALLOWED.has(host)) {
      blocked += 1;
      if (blocked <= 50) console.warn(`[no-network] blocked server fetch to ${host} (#${blocked})`);
      return Promise.reject(new TypeError(`[no-network] ${host} is blocked in the local v3c dev server`));
    }
    return original.call(this, input, init);
  };
}
