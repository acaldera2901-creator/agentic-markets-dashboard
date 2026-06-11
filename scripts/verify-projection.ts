import { projectPrediction, isUnlocked, showcaseAllowance } from "@/lib/access-projection";

const row = {
  id: "x", sport: "tennis", competition: "Roland Garros", league: "RG",
  event_name: "A vs B", home_team: "A", away_team: "B",
  starts_at: "2026-06-03T22:00:00+00:00", status: "open",
  pick: "A", p_home: 0.6, confidence_score: 60, explanation: "because",
  result: "won", settled_at: "2026-06-03T23:59:00+00:00",
  closing_line_value: 0.1, stake_suggestion: 2,
};
let fail = 0;
function check(name: string, cond: boolean) { if (!cond) { console.error("FAIL", name); fail++; } }

// rank = posizione 0-based per edge dentro lo sport nella vetrina settimanale.
// allowance: anonymous/pending 0 · free 1 · base 5 · premium ∞.

const anon = projectPrediction(row, "anonymous", 0);
check("anon locked", anon.locked === true);
check("anon shows teams", anon.home_team === "A");
check("anon hides pick", !("pick" in anon));
check("anon shows result (public fact)", anon.result === "won");

const freeTop = projectPrediction(row, "free", 0);
check("free top-1 unlocked", freeTop.locked === false);
check("free top-1 shows pick", freeTop.pick === "A");
check("free top-1 hides paid fields", !("closing_line_value" in freeTop));

const freeSecond = projectPrediction(row, "free", 1);
check("free rank-1 locked", freeSecond.locked === true && !("pick" in freeSecond));

const baseFifth = projectPrediction(row, "base", 4);
check("base rank-4 unlocked", baseFifth.locked === false && baseFifth.pick === "A");
check("base shows result", baseFifth.result === "won");
check("base shows paid fields", baseFifth.closing_line_value === 0.1 && baseFifth.stake_suggestion === 2);

const baseSixth = projectPrediction(row, "base", 5);
check("base rank-5 locked (quota 5)", baseSixth.locked === true);

const prem = projectPrediction(row, "premium", 99);
check("premium unlocked at any rank", prem.locked === false && prem.closing_line_value === 0.1);

// allowance + isUnlocked
check("allowance anon 0", showcaseAllowance("anonymous") === 0);
check("allowance free 1", showcaseAllowance("free") === 1);
check("allowance base 5", showcaseAllowance("base") === 5);
check("allowance premium inf", showcaseAllowance("premium") === Infinity);
check("isUnlocked free rank0", isUnlocked("free", 0) === true);
check("isUnlocked free rank1", isUnlocked("free", 1) === false);
check("isUnlocked base rank4", isUnlocked("base", 4) === true);
check("isUnlocked base rank5", isUnlocked("base", 5) === false);
check("isUnlocked pending rank0", isUnlocked("pending_payment", 0) === false);

console.log(fail === 0 ? "ALL PROJECTION CHECKS PASS" : `${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
