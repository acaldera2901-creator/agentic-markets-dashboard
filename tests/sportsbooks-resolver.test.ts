// tests/sportsbooks-resolver.test.ts
import assert from "node:assert/strict";
import { allSportsbooks } from "../lib/sportsbooks/registry";
import type { Sportsbook, BetSelection } from "../lib/sportsbooks/types";

process.env.SPORTSBOOK_STAKE_URL = "https://stake.com/?c=ABC";
process.env.SPORTSBOOK_STAKE_CODE = "ABC";

import { resolveBooks, buildBetUrl, geoAllowed, linksEnabled } from "../lib/sportsbooks/index";

// default sicuro: master OFF -> nessun book
delete process.env.SPORTSBOOK_LINKS_ENABLED;
process.env.SPORTSBOOK_GEO_ALLOWLIST = "MT";
assert.equal(linksEnabled(), false);
assert.deepEqual(resolveBooks("MT"), []);

// abilitato ma allowlist vuota -> nessun book
process.env.SPORTSBOOK_LINKS_ENABLED = "true";
process.env.SPORTSBOOK_GEO_ALLOWLIST = "";
assert.equal(geoAllowed("MT"), false);
assert.deepEqual(resolveBooks("MT"), []);

// allowlist specifica: dentro lista (case-insensitive) ok, fuori no;
// IT/BE/NL hard-block anche se listate (#ITALIA-EU-PARERE)
process.env.SPORTSBOOK_GEO_ALLOWLIST = "IT,MT";
assert.equal(geoAllowed("mt"), true);
assert.equal(geoAllowed("it"), false); // hard-block vince sull'allowlist
assert.equal(geoAllowed("US"), false);
assert.equal(resolveBooks("MT").length, 1);
assert.deepEqual(resolveBooks("IT"), []);
assert.deepEqual(resolveBooks("US"), []);

// wildcard "*" rimosso: trattato come lista vuota (default nascosto)
process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";
assert.equal(geoAllowed("US"), false);
assert.deepEqual(resolveBooks("US"), []);

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
