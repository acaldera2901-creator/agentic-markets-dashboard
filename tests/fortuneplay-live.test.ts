// tests/fortuneplay-live.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFortuneplayMatches, fpEdge } from "../lib/fortuneplay-live";

const payload = JSON.parse(readFileSync("tests/fixtures/fortuneplay-sample.json", "utf8"));
const matches = parseFortuneplayMatches(payload);

// almeno una partita parsata, con i campi chiave valorizzati
assert.ok(matches.length >= 1, "almeno 1 match");
const m = matches[0];
assert.ok(m.teamPairKey && m.teamPairKey.includes(":"), "teamPairKey valido");
assert.ok(typeof m.id === "number" && m.slug.length > 0, "id+slug presenti");
// homeKey/awayKey: chiavi normalizzate dei due lati (per allineare la quota al lato
// giusto — home/away FortunePlay ≠ per forza home/away nostro, es. WC campo neutro).
assert.ok(m.homeKey.length > 0 && m.awayKey.length > 0, "homeKey/awayKey presenti");
assert.ok(m.teamPairKey.includes(m.homeKey) && m.teamPairKey.includes(m.awayKey), "le side key compongono la pair key");
// odds in range decimale plausibile (×1000 → ÷1000)
for (const o of [m.oddsHome, m.oddsAway]) {
  if (o !== null) assert.ok(o > 1 && o < 1000, "odds decimale plausibile");
}
// solo soccer/tennis
assert.ok(matches.every((x) => x.sport === "soccer" || x.sport === "tennis"));

// fpEdge: 0.6 prob * 2.0 quota - 1 = 0.2
assert.equal(fpEdge(0.6, 2.0), 0.2);
assert.equal(fpEdge(0.6, null), null);
assert.equal(fpEdge(0.6, 1.0), null);

console.log("fortuneplay-live parse OK");
