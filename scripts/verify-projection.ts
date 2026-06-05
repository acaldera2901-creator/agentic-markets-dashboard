import { projectPrediction, isUnlocked } from "@/lib/access-projection";

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

const anon = projectPrediction(row, "anonymous", false);
check("anon locked", anon.locked === true);
check("anon shows teams", anon.home_team === "A");
check("anon hides pick", !("pick" in anon));
check("anon hides result", !("result" in anon));

const freePotD = projectPrediction(row, "free", true);
check("free PotD unlocked", freePotD.locked === false);
check("free PotD shows pick", freePotD.pick === "A");
check("free PotD hides premium", !("closing_line_value" in freePotD));

const freeOther = projectPrediction(row, "free", false);
check("free non-PotD locked", freeOther.locked === true && !("pick" in freeOther));

const base = projectPrediction(row, "base", false);
check("base unlocked", base.locked === false && base.pick === "A");
check("base reveals result", base.result === "won");
check("base shows paid fields", base.closing_line_value === 0.1 && base.stake_suggestion === 2);

const prem = projectPrediction(row, "premium", false);
check("premium shows clv", prem.closing_line_value === 0.1);

check("isUnlocked pending false", isUnlocked("pending_payment", false) === false);
console.log(fail === 0 ? "ALL PROJECTION CHECKS PASS" : `${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
