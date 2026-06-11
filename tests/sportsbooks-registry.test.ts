// tests/sportsbooks-registry.test.ts
import assert from "node:assert/strict";
import { allSportsbooks } from "../lib/sportsbooks/registry";

// env impostato prima della chiamata (il modulo legge process.env a runtime nelle funzioni)
process.env.SPORTSBOOK_STAKE_URL = "https://stake.com/?c=ABC";
process.env.SPORTSBOOK_STAKE_CODE = "ABC";
process.env.SPORTSBOOKS_STAKE_PATHS = '{"football":"sports/soccer"}';
process.env.SPORTSBOOK_STAKE_PATHS = '{"football":"sports/soccer"}';
delete process.env.SPORTSBOOK_ROOBET_URL; // non configurato -> escluso

const books = allSportsbooks();
assert.equal(books.length, 1);
assert.equal(books[0].id, "stake");
assert.equal(books[0].baseUrl, "https://stake.com/?c=ABC");
assert.deepEqual(books[0].sportPaths, { football: "sports/soccer" });

console.log("sportsbooks-registry ok");
