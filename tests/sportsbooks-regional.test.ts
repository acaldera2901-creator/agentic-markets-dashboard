// tests/sportsbooks-regional.test.ts
import assert from "node:assert/strict";

// env is read at call-time (not import-time), so setting it here is enough.
process.env.SPORTSBOOK_STAKE_URL = "https://stake.com/?c=GLOBAL";
process.env.SPORTSBOOK_STAKE_CODE = "GLOBAL";
process.env.SPORTSBOOK_STAKE_PATHS = JSON.stringify({ football: "sports/soccer" });
process.env.SPORTSBOOK_STAKE_URLS = JSON.stringify({
  US: "https://stake.us/?c=US",
  it: "https://stake.it/?c=IT", // lowercase key in env → normalized to IT
  default: "https://stake.com/?c=DEF",
});

import { allSportsbooks } from "../lib/sportsbooks/registry";
import { resolveBaseUrl, buildBetUrl } from "../lib/sportsbooks/index";

const stake = allSportsbooks().find((b) => b.id === "stake");
assert.ok(stake, "stake book should be present");
assert.deepEqual(stake!.regionalUrls, {
  US: "https://stake.us/?c=US",
  IT: "https://stake.it/?c=IT",
  default: "https://stake.com/?c=DEF",
});

// malformed JSON → regionalUrls undefined, book still emitted via baseUrl
process.env.SPORTSBOOK_STAKE_URLS = "{not valid";
const stakeBad = allSportsbooks().find((b) => b.id === "stake");
assert.ok(stakeBad, "stake still emitted on bad URLS json");
assert.equal(stakeBad!.regionalUrls, undefined);

console.log("sportsbooks-regional registry ok");

// ── resolveBaseUrl + buildBetUrl (country-aware) ──
process.env.SPORTSBOOK_STAKE_URLS = JSON.stringify({
  US: "https://stake.us/?c=US",
  IT: "https://stake.it/?c=IT",
  default: "https://stake.com/?c=DEF",
});
process.env.SPORTSBOOK_LINKS_ENABLED = "true";
process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";

const book = allSportsbooks().find((b) => b.id === "stake")!;

assert.equal(resolveBaseUrl(book, "US"), "https://stake.us/?c=US");
assert.equal(resolveBaseUrl(book, "it"), "https://stake.it/?c=IT"); // case-insensitive
assert.equal(resolveBaseUrl(book, "FR"), "https://stake.com/?c=DEF"); // unmapped → default
assert.equal(resolveBaseUrl(book, null), "https://stake.com/?c=DEF"); // missing → default
assert.equal(resolveBaseUrl({ ...book, regionalUrls: undefined }, "US"), "https://stake.com/?c=GLOBAL"); // no map → baseUrl

const sel = { sport: "football" as const, market: "1X2", pick: "HOME", odds: 2.0 };
assert.ok(buildBetUrl(book, sel, "US").url.startsWith("https://stake.us/"), "US → stake.us domain");
assert.ok(buildBetUrl(book, sel, "FR").url.startsWith("https://stake.com/"), "FR → .com default");

console.log("sportsbooks-regional resolve/build ok");
