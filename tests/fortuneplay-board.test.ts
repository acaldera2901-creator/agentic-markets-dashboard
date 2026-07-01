// tests/fortuneplay-board.test.ts (#FORTUNEPLAY-LIVE-ODDS-1)
import assert from "node:assert/strict";
import { boardToResponse } from "../lib/fortuneplay-board";
import type { FpMatch } from "../lib/fortuneplay-live";

const fm: FpMatch = {
  teamPairKey: "2026-07-01:internazionale|milan",
  homeKey: "milan",
  awayKey: "internazionale",
  sport: "soccer",
  slug: "milan-inter",
  id: 42,
  urnId: "bc:match:9",
  oddsHome: 2.1,
  oddsDraw: 3.2,
  oddsAway: 3.6,
  totalLine: 2.5,
  totalOver: 1.9,
  totalUnder: 1.95,
};
const map = new Map([[fm.teamPairKey, fm]]);
const res = boardToResponse(map, {
  baseUrl: "https://www.fortuneplay.com",
  locale: "it",
  code: "AFF1",
  landingUrl: "https://mediaroosters.com/aacugmydl8",
});

const e = res["2026-07-01:internazionale|milan"];
assert.equal(e.oddsHome, 2.1);
assert.equal(e.homeKey, "milan");
assert.equal(e.awayKey, "internazionale");
assert.equal(e.id, 42);
// #FORTUNEPLAY-DEEPLINK-404: il deep-link partita non è costruibile dal feed
// (slug canonico assente dall'API) → matchUrl = landing affiliate, prefilled=false.
assert.equal(e.matchUrl, "https://mediaroosters.com/aacugmydl8");
assert.equal(e.prefilled, false);

console.log("fortuneplay-board OK");
