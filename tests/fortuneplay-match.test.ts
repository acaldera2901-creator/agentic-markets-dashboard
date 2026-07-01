// tests/fortuneplay-match.test.ts (#FORTUNEPLAY-LIVE-ODDS-2)
import assert from "node:assert/strict";
import { parseFortuneplayMarkets } from "../lib/fortuneplay-match";

const payload = {
  data: [
    { id: 1, name: "Match Result", specifier: "", status: 1, outcomes: [
      { name: "England", odds: 1280 }, { name: "Draw", odds: 5200 }, { name: "DR Congo", odds: 13000 },
    ] },
    { id: 2, name: "Double Chance", specifier: "", status: 1, outcomes: [
      { name: "England or Draw", odds: 1050 }, { name: "England or DR Congo", odds: 1160 }, { name: "Draw or DR Congo", odds: 3400 },
    ] },
    { id: 3, name: "Total Goals", specifier: "bc_id=x|hcp=2.5", status: 1, outcomes: [
      { name: "Over 2.5", odds: 2010 }, { name: "Under 2.5", odds: 1810 },
    ] },
    { id: 4, name: "Total Goals", specifier: "bc_id=y|hcp=3.5", status: 1, outcomes: [
      { name: "Over 3.5", odds: 3600 }, { name: "Under 3.5", odds: 1280 },
    ] },
    { id: 5, name: "Both Teams To Score", specifier: "", status: 1, outcomes: [
      { name: "Yes", odds: 1950 }, { name: "No", odds: 1830 },
    ] },
    // suspended / no odds → scartato
    { id: 6, name: "Weird", specifier: "", status: 0, outcomes: [{ name: "x", odds: 0 }] },
  ],
};

const markets = parseFortuneplayMarkets(payload);

// almeno i 5 mercati validi
assert.ok(markets.length >= 5, `attesi >=5 mercati, trovati ${markets.length}`);

const dc = markets.find((m) => m.name === "Double Chance");
assert.ok(dc && dc.outcomes.length === 3, "Double Chance 3 esiti");
assert.equal(dc!.outcomes[0].odds, 1.05, "odds /1000");

// due linee Total Goals distinte con line valorizzata
const tg = markets.filter((m) => m.name === "Total Goals");
assert.equal(tg.length, 2, "due linee Total Goals");
assert.deepEqual(tg.map((m) => m.line).sort(), [2.5, 3.5], "linee 2.5 e 3.5");

// BTTS presente
assert.ok(markets.some((m) => m.name.toLowerCase().includes("both teams")), "BTTS presente");

// mercato sospeso/odds nulle scartato (Weird non deve comparire con esiti)
assert.ok(!markets.some((m) => m.name === "Weird"), "mercato senza odds scartato");

console.log("fortuneplay-match parse OK");
