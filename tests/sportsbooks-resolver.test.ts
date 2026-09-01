// tests/sportsbooks-resolver.test.ts
import assert from "node:assert/strict";
import { allSportsbooks } from "../lib/sportsbooks/registry";
import type { Sportsbook, BetSelection } from "../lib/sportsbooks/types";

process.env.SPORTSBOOK_STAKE_URL = "https://stake.com/?c=ABC";
process.env.SPORTSBOOK_STAKE_CODE = "ABC";

import { resolveBooks, buildBetUrl, geoAllowed, linksEnabled } from "../lib/sportsbooks/index";

// default sicuro: master OFF -> nessun book
delete process.env.SPORTSBOOK_LINKS_ENABLED;
process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";
assert.equal(linksEnabled(), false);
assert.deepEqual(resolveBooks("IT"), []);

// abilitato ma allowlist vuota -> nessun book
process.env.SPORTSBOOK_LINKS_ENABLED = "true";
process.env.SPORTSBOOK_GEO_ALLOWLIST = "";
assert.equal(geoAllowed("IT"), false);
assert.deepEqual(resolveBooks("IT"), []);

// allowlist specifica: dentro lista (case-insensitive) ok, fuori no.
// #TESTS-CI-0801 — questo blocco usava "IT" come esempio di paese ammesso, ma
// nel frattempo l'Italia è entrata in GEO_BLOCKED_COUNTRIES (IT/DE/FR/NL/ES/BE):
// è un hard-block LEGALE che vince su qualunque allowlist, quindi un paese
// bloccato non è più un buon esempio di "dentro lista". Esempio spostato su MT,
// e il blocco verificato per quello che è: una barriera che l'env non può aprire.
process.env.SPORTSBOOK_GEO_ALLOWLIST = "MT,US";
assert.equal(geoAllowed("mt"), true);
assert.equal(geoAllowed("MT"), true);
assert.equal(geoAllowed("GB"), false);
assert.equal(resolveBooks("MT").length, 1);
assert.deepEqual(resolveBooks("GB"), []);

// Blocklist centrale temporaneamente vuota: una allowlist esplicita apre anche
// le geo storicamente bloccate.
process.env.SPORTSBOOK_GEO_ALLOWLIST = "IT,DE,FR,NL,ES,BE";
for (const country of ["IT", "DE", "FR", "NL", "ES", "BE", "it", "be"]) {
  assert.equal(geoAllowed(country), true, `geo ammessa: ${country}`);
  assert.equal(resolveBooks(country).length, 1, `book disponibile per ${country}`);
}

// Globale "*": qualsiasi geo, inclusa quella ignota.
process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";
for (const country of ["US", "IT", "DE", null, undefined]) {
  assert.equal(geoAllowed(country), true, `geo globale: ${String(country)}`);
  assert.equal(resolveBooks(country).length, 1, `book globale: ${String(country)}`);
}

// buildBetUrl produce un'opzione valida e non lancia mai
const book = allSportsbooks()[0];
const sel: BetSelection = { sport: "football", market: "1X2", pick: "HOME", odds: null };
const r = buildBetUrl(book, sel);
assert.ok(r.url.includes("stake.com"));
assert.equal(typeof r.prefilled, "boolean");

// adapter-throws: l'adapter che lancia deve essere gestito dal try/catch -> fallback a baseUrl
const badBook: Sportsbook = {
  id: "stake",
  name: book.name,
  logo: book.logo,
  affiliateCode: book.affiliateCode,
  baseUrl: "https://stake.com/?c=ABC",
  adapter: () => { throw new Error("boom"); },
};
const fallback = buildBetUrl(badBook, sel);
assert.equal(fallback.url, badBook.baseUrl);
assert.equal(fallback.prefilled, false);

console.log("sportsbooks-resolver ok");
