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

// ── #PARTNER-FIXTURES-0911 ──────────────────────────────────────────────────
// Il feed porta nomi e orario di ogni partita e il parser li BUTTAVA, tenendo
// solo l'hash: bastava ad agganciare le quote a una partita nota, non a
// scoprirne una nuova. Misurato sul feed vivo l'11/09: 108 partite di tennis
// (81 future) contro le 11 sul board, e 294 di calcio future nelle sole prime
// 6 pagine su 30.
for (const x of matches) {
  assert.ok(x.homeName.length > 0 && x.awayName.length > 0, "nomi veri presenti");
  // I nomi NON sono la forma normalizzata: quella resta in homeKey/awayKey.
  // Se coincidessero sempre, vorrebbe dire che stiamo conservando l'hash una
  // seconda volta invece del nome mostrabile.
  assert.ok(typeof x.startTime === "string" || x.startTime === null, "startTime presente o nullo esplicito");
  if (x.startTime) {
    assert.ok(!Number.isNaN(Date.parse(x.startTime)), `startTime leggibile: ${x.startTime}`);
  }
}
// Ciascuno dei due nomi deve, su almeno una partita, DIFFERIRE dalla propria
// chiave normalizzata: altrimenti staremmo conservando l'hash una seconda volta
// invece del nome mostrabile.
//
// Le due asserzioni sono separate di proposito. Scritte come un unico `||`
// passavano anche sostituendo `homeName` con la chiave — verificato con un
// controllo positivo, che e' servito proprio a scoprire che il test era debole.
assert.ok(
  matches.some((x) => x.homeName !== x.homeKey),
  "homeName porta il nome vero, non la chiave normalizzata",
);
assert.ok(
  matches.some((x) => x.awayName !== x.awayKey),
  "awayName porta il nome vero, non la chiave normalizzata",
);
// e l'orario deve esserci su almeno una: e' il secondo dato che serve per
// creare una partita, non solo per agganciarla.
assert.ok(matches.some((x) => x.startTime), "almeno una partita porta l'orario");

console.log("fortuneplay-live parse OK");
