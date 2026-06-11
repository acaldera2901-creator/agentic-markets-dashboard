import assert from "node:assert/strict";
import { MIN_DECIDED_FOR_RATE, isRateMeaningful } from "../lib/track-record";

// #HITRATE-GUARD-1: a published hit-rate is a claim — below this many decided
// picks the UI shows the raw record (won/lost) and no percentage. Pinned so a
// silent threshold change shows up in review.
assert.equal(MIN_DECIDED_FOR_RATE, 15);

assert.equal(isRateMeaningful(14), false);
assert.equal(isRateMeaningful(15), true);
assert.equal(isRateMeaningful(0), false);
assert.equal(isRateMeaningful(62), true);
assert.equal(isRateMeaningful(NaN), false);

console.log("track record guard ok");
