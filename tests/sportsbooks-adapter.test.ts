// tests/sportsbooks-adapter.test.ts
import assert from "node:assert/strict";
import { landingAdapter } from "../lib/sportsbooks/adapters/landing";
import type { Sportsbook, BetSelection } from "../lib/sportsbooks/types";

const baseBook: Sportsbook = {
  id: "stake", name: "Stake", logo: "/logos/stake.svg",
  affiliateCode: "ABC", baseUrl: "https://stake.com/?c=ABC",
  adapter: landingAdapter,
};
const sel: BetSelection = { sport: "football", market: "1X2", pick: "HOME", odds: null };

// senza sportPaths -> baseUrl invariata, prefilled false
{
  const r = landingAdapter(sel, baseBook);
  assert.equal(r.url, "https://stake.com/?c=ABC");
  assert.equal(r.prefilled, false);
}

// con sportPaths -> landing su sezione sport, query preservata
{
  const book: Sportsbook = { ...baseBook, sportPaths: { football: "sports/soccer" } };
  const r = landingAdapter(sel, book);
  assert.equal(r.url, "https://stake.com/sports/soccer?c=ABC");
  assert.equal(r.prefilled, false); // landing != betslip pieno (onesto)
}

console.log("sportsbooks-adapter ok");
