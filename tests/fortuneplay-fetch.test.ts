import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { __setFpFetcherForTest, fetchFortuneplayBoard } from "../lib/fortuneplay-live";

const sample = JSON.parse(readFileSync("tests/fixtures/fortuneplay-sample.json", "utf8"));
let calls = 0;
__setFpFetcherForTest(async () => {
  calls++;
  // Ritorna la fixture ma con last_page=1 per fermare il loop subito
  return { ...sample, pagination: { ...sample.pagination, last_page: 1 } };
});

(async () => {
  const m1 = await fetchFortuneplayBoard(1000);
  assert.ok(m1.size >= 1, "mappa popolata");
  assert.equal(calls, 1, "1 fetch");

  // entro TTL → cache, nessun nuovo fetch
  const m2 = await fetchFortuneplayBoard(1000 + 10_000);
  assert.equal(calls, 1, "cache hit entro TTL");

  // oltre TTL (30s) → refetch
  await fetchFortuneplayBoard(1000 + 31_000);
  assert.equal(calls, 2, "refetch oltre TTL");

  console.log("fortuneplay-fetch OK");
})();
