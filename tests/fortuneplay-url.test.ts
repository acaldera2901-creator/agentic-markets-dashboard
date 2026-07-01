// tests/fortuneplay-url.test.ts (#FORTUNEPLAY-LIVE-ODDS-1)
import assert from "node:assert/strict";
import { buildFortuneplayMatchUrl } from "../lib/fortuneplay-url";

// VERIFIED (Step 0): locale /it, param affiliate BetConstruct = `stag` (da robots.txt
// fortuneplay.com). Pattern route SPA candidato /{locale}/sports/{slug}-{id}: route
// esatto + se l'attribuzione affiliate passa via deep-link diretto → CONFERMA AL GATE
// (Task 8) dalla dashboard FortunePlay. Fallback landing garantito lato board.
const url = buildFortuneplayMatchUrl({
  baseUrl: "https://www.fortuneplay.com",
  locale: "it",
  slug: "netherlands-morocco",
  id: 70395717,
  code: "AFF123",
});
assert.equal(
  url,
  "https://www.fortuneplay.com/it/sports/netherlands-morocco-70395717?stag=AFF123"
);

// senza code → niente query affiliate, locale default en
const url2 = buildFortuneplayMatchUrl({
  baseUrl: "https://www.fortuneplay.com",
  slug: "a-b",
  id: 1,
});
assert.equal(url2, "https://www.fortuneplay.com/en/sports/a-b-1");

// baseUrl con trailing slash → normalizzato
const url3 = buildFortuneplayMatchUrl({
  baseUrl: "https://www.fortuneplay.com/",
  locale: "it",
  slug: "x-y",
  id: 9,
  code: "C&D",
});
assert.equal(url3, "https://www.fortuneplay.com/it/sports/x-y-9?stag=C%26D");

console.log("fortuneplay-url OK");
