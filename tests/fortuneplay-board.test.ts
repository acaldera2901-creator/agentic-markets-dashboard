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
assert.equal(e.prefilled, true);
assert.ok(e.matchUrl.includes("milan-inter-42"), "matchUrl deep-link");
assert.ok(e.matchUrl.includes("stag=AFF1"), "matchUrl porta il param affiliate");

// degradazione: senza slug/id → matchUrl = landing, prefilled false
const bad: FpMatch = { ...fm, teamPairKey: "k2", slug: "", id: 0 };
const res2 = boardToResponse(new Map([[bad.teamPairKey, bad]]), {
  baseUrl: "https://www.fortuneplay.com",
  locale: "it",
  landingUrl: "https://mediaroosters.com/aacugmydl8",
});
assert.equal(res2["k2"].matchUrl, "https://mediaroosters.com/aacugmydl8");
assert.equal(res2["k2"].prefilled, false);

console.log("fortuneplay-board OK");
