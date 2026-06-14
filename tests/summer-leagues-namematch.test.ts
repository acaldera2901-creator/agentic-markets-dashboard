import assert from "node:assert/strict";
import { matchModelTeam } from "../lib/summer-leagues";

// ── matchModelTeam: odds-feed names ↔ snapshot model roster ──────────────────
// Regression for #SUMMER-NAMEMATCH (2026-06-14): the League of Ireland snapshot
// ships "St. Patricks" (abbreviated, with a dot). The Odds API feed names the
// same club "St Patricks Athletic". Before the fix, tokens() did not strip the
// ".", so the snapshot tokenized to ["st.", "patricks"] and neither containment
// nor token overlap (st. ≠ st) reached the 0.5 threshold → the fixture was
// dropped, silently shrinking LOI coverage by one club.

// The roster as it appears in data/summer_leagues/history.json (LOI).
const LOI_ROSTER = [
  "Bohemians",
  "Cork City",
  "Derry City",
  "Drogheda United",
  "Dundalk",
  "Galway United FC",
  "Shamrock Rovers",
  "Shelbourne",
  "Sligo Rovers",
  "St. Patricks",
  "Waterford",
];

// The exact regression case: dotted abbreviation in the roster.
assert.equal(matchModelTeam("St Patricks Athletic", LOI_ROSTER), "St. Patricks");

// The rest of the LOI slate must keep resolving (no regression from the change).
assert.equal(matchModelTeam("Galway United", LOI_ROSTER), "Galway United FC");
assert.equal(matchModelTeam("Derry City", LOI_ROSTER), "Derry City");
assert.equal(matchModelTeam("Shelbourne Dublin", LOI_ROSTER), "Shelbourne");
assert.equal(matchModelTeam("Waterford FC", LOI_ROSTER), "Waterford");
assert.equal(matchModelTeam("Shamrock Rovers", LOI_ROSTER), "Shamrock Rovers");

// Veikkausliiga long/short drift still resolves (odds feed → snapshot).
const VEI_ROSTER = [
  "AC Oulu",
  "Gnistan",
  "HJK",
  "Haka",
  "Ilves",
  "Inter Turku",
  "Jaro",
  "KTP",
  "KuPS",
  "Lahti",
  "Mariehamn",
  "SJK",
  "TPS",
  "VPS",
];
assert.equal(matchModelTeam("HJK Helsinki", VEI_ROSTER), "HJK");
assert.equal(matchModelTeam("FC Inter Turku", VEI_ROSTER), "Inter Turku");
assert.equal(matchModelTeam("IFK Mariehamn", VEI_ROSTER), "Mariehamn");
assert.equal(matchModelTeam("IF Gnistan", VEI_ROSTER), "Gnistan");

// Fail-closed: a genuinely unknown club still returns null (never guess).
assert.equal(matchModelTeam("Real Madrid", LOI_ROSTER), null);

console.log("summer-leagues-namematch: all assertions passed");
