// tests/fortuneplay-url.test.ts (#FORTUNEPLAY-LIVE-ODDS-1 / #FORTUNEPLAY-DEEPLINK-0701)
import assert from "node:assert/strict";
import { buildFortuneplayMatchUrl } from "../lib/fortuneplay-url";

// VERIFICATO dal vivo 2026-07-01: /{locale}/sports/{sport}/{slug}-m-{id}?stag=CODE.
// Segmento sport obbligatorio; "-m" token fisso "match" (non genere).
const url = buildFortuneplayMatchUrl({
  baseUrl: "https://www.fortuneplay.com",
  locale: "it",
  sport: "soccer",
  slug: "netherlands-morocco",
  id: 70395717,
  code: "AFF123",
});
assert.equal(
  url,
  "https://www.fortuneplay.com/it/sports/soccer/netherlands-morocco-m-70395717?stag=AFF123"
);

// senza code → niente query affiliate, locale default en; tennis
const url2 = buildFortuneplayMatchUrl({
  baseUrl: "https://www.fortuneplay.com",
  sport: "tennis",
  slug: "a-b",
  id: 1,
});
assert.equal(url2, "https://www.fortuneplay.com/en/sports/tennis/a-b-m-1");

// baseUrl con trailing slash → normalizzato + encode del code
const url3 = buildFortuneplayMatchUrl({
  baseUrl: "https://www.fortuneplay.com/",
  locale: "it",
  sport: "soccer",
  slug: "x-y",
  id: 9,
  code: "C&D",
});
assert.equal(url3, "https://www.fortuneplay.com/it/sports/soccer/x-y-m-9?stag=C%26D");

console.log("fortuneplay-url OK");
