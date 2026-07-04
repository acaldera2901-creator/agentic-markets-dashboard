// tests/multibook-deeplink.test.ts (#YBETS-DEEPLINK-404)
// Ogni book emette il link giusto: FortunePlay → deep-link sul suo sito utente;
// YBets → landing affiliate (il suo `base` è l'host del feed, non serve le
// pagine-partita → un deep-link lì darebbe 404).
import assert from "node:assert/strict";
import { mergeBooksToResponse } from "../lib/fortuneplay-board";
import { BOOKS, bookByKey } from "../lib/betconstruct-books";
import type { FpMatch } from "../lib/fortuneplay-live";

const base: FpMatch = {
  teamPairKey: "2026-07-01:internazionale|milan",
  homeKey: "milan",
  awayKey: "internazionale",
  sport: "soccer",
  slug: "milan-inter",
  id: 42,
  urnId: "bc:match:9",
  oddsHome: 2.1,
  oddsDraw: 3.2,
  oddsAway: 3.6,
  totalLine: 2.5,
  totalOver: 1.9,
  totalUnder: 1.95,
};

const fpBook = bookByKey("fortuneplay")!;
const ybBook = bookByKey("ybets")!;

const boards = [
  { book: fpBook, map: new Map([[base.teamPairKey, { ...base }]]) },
  { book: ybBook, map: new Map([[base.teamPairKey, { ...base, oddsHome: 2.2 }]]) },
];

const res = mergeBooksToResponse(boards, {
  locale: "it",
  landingUrl: "https://mediaroosters.com/aacugmydl8",
});

const e = res[base.teamPairKey];
assert.ok(e, "entry presente");
assert.ok(e.books, "campo books presente");
const books = e.books;
assert.equal(books.length, 2, "due book nella comparazione");

const fp = books.find((b) => b.key === "fortuneplay")!;
const yb = books.find((b) => b.key === "ybets")!;

// FortunePlay: deep-link sul sito utente verificato
assert.equal(fp.matchUrl, `https://www.fortuneplay.com/it/sports/soccer/milan-inter-m-42?stag=${fpBook.stag}`);

// YBets: DEVE essere la landing, MAI un deep-link sull'host del feed (404)
assert.equal(yb.matchUrl, ybBook.landing);
assert.ok(!yb.matchUrl.includes("sportsbook.ybets.net"), "nessun deep-link sull'host feed YBets");

// La CTA principale della card resta il book primario (FortunePlay, deep-link valido)
assert.equal(e.matchUrl, fp.matchUrl);
assert.equal(e.prefilled, true);

// Guardia registry: ogni book con matchUrlBase serve davvero /sports; senza → landing-only
for (const b of BOOKS) {
  if (b.matchUrlBase) assert.ok(/^https:\/\//.test(b.matchUrlBase), `${b.key}: matchUrlBase è un URL`);
}

console.log("multibook-deeplink OK");
