import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildTennisExplanation,
  WHY_STRONG_PICK_CONFIDENCE,
  TENNIS_FAVOURED_FLOOR,
} from "../lib/tennis-explanation";

// Tennis "why" v2 contract — mirror of the football why-v2 humanisation
// (core/world_cup_explanation.build_wc_explanation). The served explanation must
// read like a human wrote it: who is favoured, by how much (%), and WHY in plain
// language. No internal jargon: no "Surface-Elo", no raw "Serve/return 59.2%/42.5%",
// no "Feature quality 54%". Probability-neutral: this function only produces TEXT.

// ── Single source of truth: must mirror config/settings.py ──────────────────
assert.equal(WHY_STRONG_PICK_CONFIDENCE, 65); // settings.WHY_STRONG_PICK_CONFIDENCE
assert.equal(TENNIS_FAVOURED_FLOOR, 56); // settings.SURFACE_FLOOR_FOOTBALL (shared floor)

const _JARGON = [
  "Surface-Elo",
  "Serve/return",
  "Feature quality",
  "win probability",
  "Lean:",
];

function _clean(text: string) {
  assert.ok(!text.includes("undefined"), `has undefined: ${text}`);
  assert.ok(!text.includes("null"), `has null: ${text}`);
  assert.ok(!text.toLowerCase().includes("nan"), `has nan: ${text}`);
  assert.ok(!text.includes("NaN"), `has NaN: ${text}`);
  for (const j of _JARGON) {
    assert.ok(!text.includes(j), `leaks jargon "${j}": ${text}`);
  }
  assert.ok(/bet responsibly\.?$/i.test(text.trim()), `no disclaimer: ${text}`);
}

const STRONG = {
  pick: "Carlos Alcaraz",
  opponent: "Lorenzo Sonego",
  confidence: 74,
  surface: "Clay",
  serveFormPick: 0.68,
  serveFormOpp: 0.58,
  returnFormPick: 0.44,
  returnFormOpp: 0.39,
  featureQuality: 0.72,
  hasRealMarket: false,
};

test("strong pick reads human with no jargon", () => {
  const t = buildTennisExplanation(STRONG);
  assert.ok(t.includes("Carlos Alcaraz"), t);
  assert.ok(t.includes("Lorenzo Sonego"), t);
  assert.ok(t.includes("74%"), t);
  assert.ok(t.toLowerCase().includes("strong"), t);
  assert.ok(t.toLowerCase().includes("clay"), t);
  // No raw serve/return percentages.
  assert.ok(!/\d+\.\d%/.test(t), `leaks decimal %: ${t}`);
  _clean(t);
});

test("favoured-but-open tier between floor and strong bar", () => {
  const t = buildTennisExplanation({ ...STRONG, confidence: 60 });
  assert.ok(t.includes("60%"), t);
  assert.ok(/favoured|edge|nudges ahead|slight/i.test(t), t);
  assert.ok(!t.toLowerCase().includes("strong pick"), t);
  assert.ok(!t.toLowerCase().includes("no clear favourite"), t);
  _clean(t);
});

test("coin-flip below floor is called honestly", () => {
  const t = buildTennisExplanation({ ...STRONG, confidence: 52 });
  assert.ok(t.toLowerCase().includes("coin-flip"), t);
  assert.ok(t.toLowerCase().includes("no clear favourite"), t);
  assert.ok(t.includes("52%"), t);
  _clean(t);
});

test("serve advantage is described in plain words", () => {
  const t = buildTennisExplanation(STRONG);
  // pick holds serve clearly better -> some serve phrasing
  assert.ok(/serve/i.test(t), t);
  _clean(t);
});

test("fail-soft: no feature signals still produces clean prose", () => {
  const t = buildTennisExplanation({
    pick: "Player A",
    opponent: "Player B",
    confidence: 58,
    surface: "Hard",
    serveFormPick: null,
    serveFormOpp: null,
    returnFormPick: null,
    returnFormOpp: null,
    featureQuality: null,
    hasRealMarket: false,
  });
  assert.ok(t.includes("Player A"), t);
  assert.ok(t.includes("58%"), t);
  _clean(t);
});

test("fail-soft: missing surface does not leak 'n/a' jargonily", () => {
  const t = buildTennisExplanation({
    ...STRONG,
    surface: "n/a",
  });
  // It should not assert a surface edge when surface is unknown.
  assert.ok(!/on n\/a/i.test(t), t);
  _clean(t);
});

test("no live market price is stated honestly (paper)", () => {
  const t = buildTennisExplanation({ ...STRONG, hasRealMarket: false });
  assert.ok(/no .*market/i.test(t) || /informational/i.test(t), t);
  _clean(t);
});

test("with real market, no paper market-absence disclaimer", () => {
  const t = buildTennisExplanation({ ...STRONG, hasRealMarket: true });
  assert.ok(!/no live market/i.test(t), t);
  _clean(t);
});

test("near-even serve/return omits a serve edge claim", () => {
  const t = buildTennisExplanation({
    ...STRONG,
    confidence: 57,
    serveFormPick: 0.61,
    serveFormOpp: 0.605,
    returnFormPick: 0.4,
    returnFormOpp: 0.4,
  });
  // No spurious "holds serve clearly better" when forms are level.
  assert.ok(!/clearly better on serve|much stronger on serve/i.test(t), t);
  _clean(t);
});

test("low feature quality softens the read instead of dropping numbers", () => {
  const t = buildTennisExplanation({
    ...STRONG,
    confidence: 66,
    featureQuality: 0.2,
  });
  // Does not surface "20%" or "Feature quality".
  assert.ok(!t.includes("20%"), t);
  assert.ok(!t.includes("Feature quality"), t);
  _clean(t);
});
