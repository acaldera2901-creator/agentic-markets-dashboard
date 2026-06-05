// Contract checks for the Safe Publication Gate v1 (lib/publication-gate.ts).
// Run: npx tsx scripts/verify-publication-gate.ts

import { gateCandidate, recordVerdict, emptySyncReport } from "../lib/publication-gate";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const NOW = new Date("2026-06-05T12:00:00Z");
const FUTURE = "2026-06-06T18:00:00Z";
const JUST_STARTED = "2026-06-05T11:30:00Z"; // 30 min ago — inside live window
const STALE = "2026-06-05T01:00:00Z"; // 11h ago — stale

const ctx = { worldCupSignalReady: false, now: NOW };

// 1. Full candidate (odds+edge+pick, future, non-WC) → real signal
let v = gateCandidate({ startsAt: FUTURE, pick: "HOME", odds: 2.1, edge: 0.03, isWorldCup: false }, ctx);
assert(v.publish && v.signalType === "signal" && !v.isPaper, "full candidate must publish as signal");

// 2. Missing odds → paper, never a signal
v = gateCandidate({ startsAt: FUTURE, pick: "HOME", odds: null, edge: 0.03, isWorldCup: false }, ctx);
assert(v.publish && v.signalType === "paper" && v.isPaper, "no odds must downgrade to paper");
assert(v.publish && v.reasons.includes("no_market_odds"), "no odds reason recorded");

// 3. Missing edge → paper
v = gateCandidate({ startsAt: FUTURE, pick: "HOME", odds: 2.1, edge: null, isWorldCup: false }, ctx);
assert(v.publish && v.signalType === "paper", "no edge must downgrade to paper");

// 4. Missing pick → paper (board stays populated, but never a signal)
v = gateCandidate({ startsAt: FUTURE, pick: null, odds: 2.1, edge: 0.03, isWorldCup: false }, ctx);
assert(v.publish && v.signalType === "paper", "no pick must downgrade to paper");

// 5. World Cup while monitor_only → paper even with a perfect candidate
v = gateCandidate({ startsAt: FUTURE, pick: "HOME", odds: 2.1, edge: 0.03, isWorldCup: true }, ctx);
assert(v.publish && v.signalType === "paper" && v.reasons.includes("wc_monitor_only"),
  "WC monitor_only must force paper");

// 6. World Cup once signal_ready → real signal allowed
v = gateCandidate(
  { startsAt: FUTURE, pick: "HOME", odds: 2.1, edge: 0.03, isWorldCup: true },
  { worldCupSignalReady: true, now: NOW }
);
assert(v.publish && v.signalType === "signal", "WC signal_ready must allow signal");

// 7. Stale event → rejected entirely
v = gateCandidate({ startsAt: STALE, pick: "HOME", odds: 2.1, edge: 0.03, isWorldCup: false }, ctx);
assert(!v.publish && v.reason === "stale_event", "stale event must be rejected");

// 8. Recently started (live window) → still publishable
v = gateCandidate({ startsAt: JUST_STARTED, pick: "HOME", odds: 2.1, edge: 0.03, isWorldCup: false }, ctx);
assert(v.publish, "recently started event must remain publishable");

// 9. Missing/invalid start time → rejected
v = gateCandidate({ startsAt: null, pick: "HOME", odds: 2.1, edge: 0.03, isWorldCup: false }, ctx);
assert(!v.publish && v.reason === "missing_start_time", "missing start time must be rejected");
v = gateCandidate({ startsAt: "not-a-date", pick: "HOME", odds: 2.1, edge: 0.03, isWorldCup: false }, ctx);
assert(!v.publish && v.reason === "invalid_start_time", "invalid start time must be rejected");

// 10. Report accounting
const report = emptySyncReport();
recordVerdict(report, gateCandidate({ startsAt: FUTURE, pick: "HOME", odds: 2.1, edge: 0.03, isWorldCup: false }, ctx));
recordVerdict(report, gateCandidate({ startsAt: FUTURE, pick: "HOME", odds: null, edge: null, isWorldCup: false }, ctx));
recordVerdict(report, gateCandidate({ startsAt: STALE, pick: "HOME", odds: 2.1, edge: 0.03, isWorldCup: false }, ctx));
assert(report.synced === 2 && report.as_signal === 1 && report.as_paper === 1 && report.rejected === 1,
  `report accounting wrong: ${JSON.stringify(report)}`);
assert(report.paper_reasons["no_market_odds"] === 1 && report.rejected_reasons["stale_event"] === 1,
  "report reasons wrong");

console.log("publication gate contract ok");
