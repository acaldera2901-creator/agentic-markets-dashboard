// tests/sportsbooks-url.test.ts
import assert from "node:assert/strict";
import { joinUrl } from "../lib/sportsbooks/url";

// nessun path -> base invariata
assert.equal(joinUrl("https://stake.com"), "https://stake.com");
assert.equal(joinUrl("https://stake.com/", undefined), "https://stake.com/");

// path semplice, normalizza gli slash
assert.equal(joinUrl("https://stake.com/", "sports/soccer"), "https://stake.com/sports/soccer");
assert.equal(joinUrl("https://stake.com", "/sports/soccer"), "https://stake.com/sports/soccer");

// preserva la query string (codice affiliato già nella baseUrl)
assert.equal(
  joinUrl("https://stake.com/?c=ABC", "sports/soccer"),
  "https://stake.com/sports/soccer?c=ABC",
);

console.log("sportsbooks-url ok");
