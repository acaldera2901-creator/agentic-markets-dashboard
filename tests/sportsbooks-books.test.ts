// tests/sportsbooks-books.test.ts
import assert from "node:assert/strict";
import { stakeAdapter } from "../lib/sportsbooks/adapters/stake";
import { roobetAdapter } from "../lib/sportsbooks/adapters/roobet";
import type { Sportsbook, BetSelection } from "../lib/sportsbooks/types";

const sel: BetSelection = { sport: "football", market: "1X2", pick: "HOME", odds: null };

const stake: Sportsbook = {
  id: "stake", name: "Stake", logo: "/logos/stake.svg",
  affiliateCode: "ABC", baseUrl: "https://stake.com/?c=ABC", adapter: stakeAdapter,
};
const roobet: Sportsbook = {
  id: "roobet", name: "Roobet", logo: "/logos/roobet.svg",
  affiliateCode: "XYZ", baseUrl: "https://roobet.com/?ref=XYZ", adapter: roobetAdapter,
};

const rs = stakeAdapter(sel, stake);
assert.ok(rs.url.includes("stake.com"));
assert.ok(rs.url.includes("ABC"));
assert.equal(rs.prefilled, false);

const rr = roobetAdapter(sel, roobet);
assert.ok(rr.url.includes("roobet.com"));
assert.ok(rr.url.includes("XYZ"));
assert.equal(rr.prefilled, false);

console.log("sportsbooks-books ok");
