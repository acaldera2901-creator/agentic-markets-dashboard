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

// allowlist specifica: dentro lista (case-insensitive) ok, fuori no
process.env.SPORTSBOOK_GEO_ALLOWLIST = "IT,MT";
assert.equal(geoAllowed("it"), true);
assert.equal(geoAllowed("US"), false);
assert.equal(resolveBooks("IT").length, 1);
assert.deepEqual(resolveBooks("US"), []);

// globale "*": qualsiasi geo
process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";
assert.equal(geoAllowed("US"), true);
assert.equal(resolveBooks("US").length, 1);

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
