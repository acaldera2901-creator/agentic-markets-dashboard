// tests/market-join.test.ts (#CARD-REAL-PREDICTIONS-1)
// Joins curated FortunePlay markets (real label formats) with our model.
import assert from "node:assert/strict";
import { computeExtraMarkets } from "../lib/poisson-model";
import { joinFpWithModel, keyForOutcome } from "../lib/market-join";
import type { FpFullMarket } from "../lib/fortuneplay-match";

const HOME = "England";
const AWAY = "DR Congo";

// key mapping using the exact label styles from the FP feed (see fortuneplay-match.test.ts)
assert.equal(keyForOutcome("Total Goals", 2.5, "Over 2.5", HOME, AWAY), "over_2_5");
assert.equal(keyForOutcome("Total Goals", 2.5, "Under 2.5", HOME, AWAY), "under_2_5");
assert.equal(keyForOutcome("Both Teams To Score", null, "Yes", HOME, AWAY), "btts_yes");
assert.equal(keyForOutcome("Double Chance", null, "England or Draw", HOME, AWAY), "double_1x");
assert.equal(keyForOutcome("Double Chance", null, "Draw or DR Congo", HOME, AWAY), "double_x2");
assert.equal(keyForOutcome("Double Chance", null, "England or DR Congo", HOME, AWAY), "double_12");
assert.equal(keyForOutcome("Draw No Bet", null, "England", HOME, AWAY), "dnb_home");
assert.equal(keyForOutcome("Draw No Bet", null, "DR Congo", HOME, AWAY), "dnb_away");
assert.equal(keyForOutcome("Total Goals Odd/Even", null, "Odd", HOME, AWAY), "goals_odd");
assert.equal(keyForOutcome("Team 1 Total Goals", 1.5, "Over 1.5", HOME, AWAY), "team1_over_1_5");
assert.equal(keyForOutcome("Correct Score", null, "1-0", HOME, AWAY), "cs_1_0");
assert.equal(keyForOutcome("Correct Score", null, "2:1", HOME, AWAY), "cs_2_1");
assert.equal(keyForOutcome("1st Half Result", null, "England", HOME, AWAY), "fh_home");
assert.equal(keyForOutcome("1st Half Total Goals", 0.5, "Over 0.5", HOME, AWAY), "fh_over_0_5");
assert.equal(keyForOutcome("1st Half Both Teams To Score", null, "No", HOME, AWAY), "fh_btts_no");
// unmodeled → null
assert.equal(keyForOutcome("Corners: Total", 9.5, "Over 9.5", HOME, AWAY), null);
assert.equal(keyForOutcome("Goals Handicap", -1.5, "England -1.5", HOME, AWAY), null);
console.log("keyForOutcome mapping OK");

// end-to-end join
const extra = computeExtraMarkets(1.6, 1.2, {});
const fp: FpFullMarket[] = [
  { name: "Total Goals", line: 2.5, outcomes: [{ label: "Over 2.5", odds: 1.9 }, { label: "Under 2.5", odds: 2.0 }] },
  { name: "Double Chance", line: null, outcomes: [
    { label: "England or Draw", odds: 1.3 }, { label: "England or DR Congo", odds: 1.25 }, { label: "Draw or DR Congo", odds: 2.2 } ] },
  { name: "Team 2 Total Goals", line: 1.5, outcomes: [{ label: "Over 1.5", odds: 2.5 }, { label: "Under 1.5", odds: 1.5 }] },
  { name: "Corners: Total", line: 9.5, outcomes: [{ label: "Over 9.5", odds: 1.8 }, { label: "Under 9.5", odds: 1.9 }] },
];
const joined = joinFpWithModel(fp, extra, HOME, AWAY);

const tg = joined.find((m) => m.name === "Total Goals")!;
assert.ok(tg.modeled, "Total Goals modeled");
const over = tg.outcomes.find((o) => o.label === "Over 2.5")!;
assert.ok(over.p !== null && Math.abs(over.p - 0.53) < 0.03, `over 2.5 p=${over.p}`);
assert.ok(over.edge !== null && Math.abs(over.edge - (over.p! * 1.9 - 1)) < 2e-4, "edge computed vs FP odds");
const under = tg.outcomes.find((o) => o.label === "Under 2.5")!;
assert.ok(under.p !== null && Math.abs(over.p! + under.p - 1) < 0.02, "over+under ~1");

// team-2 under derived from over sibling
const t2 = joined.find((m) => m.name === "Team 2 Total Goals")!;
const t2u = t2.outcomes.find((o) => o.label === "Under 1.5")!;
assert.ok(t2u.p !== null, "team2 under derived from over");

// unmodeled soft market: FP odds kept, prediction null
const corners = joined.find((m) => m.name === "Corners: Total")!;
assert.equal(corners.modeled, false, "corners not modeled");
assert.ok(corners.outcomes.every((o) => o.p === null && o.fpOdds > 1), "corners: odds kept, no fabricated pred");

console.log("joinFpWithModel OK");
console.log("ALL MARKET-JOIN CHECKS PASSED");
