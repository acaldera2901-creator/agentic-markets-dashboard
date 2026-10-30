// lib/v3c/news/card.test.ts (#NEWSWATCH-2-IMG) — the graphic card, pure part,
// against the six notes art direction did by hand on 29/10
// (preview-news-prod/2026-10-29-stile-v3-inspo/README.md §4).
import { describe, expect, it } from "vitest";
import { cardPrompt, cardText, colourDist, expectedText, fits, hamming, pickCard, tooSimilar, violations, WINDOW, type LedgerRow } from "./card";
import { sceneKind } from "./image";
import { words } from "./rewrite";

const NOTES = {
  bayern: { title: "Bayern reach DFB-Pokal last 16; Brown praises unity", body: "Bayern Munich advanced in the DFB-Pokal on Wednesday, reaching the last 16. Nathaniel Brown praised the squad's unity during difficult times." },
  miami: { title: "Inter Miami and FC Cincinnati draw 2-2", body: "Riquelme Fillipi scored a late equaliser after Inter Miami had given up a one-goal lead. The match ended 2-2 after a frantic finish." },
  chelsea: { title: "Alonso stresses league focus after EFL Cup exit", body: "Chelsea lost on penalties to Liverpool; Alonso called the Premier League his main focus." },
  bournemouth: { title: "Rose hopes to win trophies with Bournemouth", body: "Bournemouth have claimed five straight wins in every competition. Their next match is a Premier League fixture against Leeds United." },
  juventus: { title: "Juventus lose to Genoa in Serie A", body: "Genoa beat Juventus on Wednesday, Juventus' third Serie A loss of the season. The result leaves Luciano Spalletti with a number of questions." },
  burnley: { title: "Burnley complete Fabio Celestini appointment", body: "Nicky Hayen was dismissed while Burnley were in the relegation zone." },
};

describe("card · the text comes only from our note", () => {
  it("the six notes of art direction: score, last 16, 5 straight wins, 3rd loss, focus", () => {
    expect(cardText(NOTES.miami)).toEqual({ type: "score", big: "2-2" });
    expect(cardText(NOTES.bayern)).toEqual({ type: "word", words: "LAST 16" });
    expect(cardText(NOTES.bournemouth)).toEqual({ type: "count", big: "5", words: "STRAIGHT WINS" });
    expect(cardText(NOTES.juventus)).toEqual({ type: "word", words: "3RD LOSS" });
    expect(cardText(NOTES.chelsea)).toEqual({ type: "word", words: "FOCUS" });
    expect(cardText(NOTES.burnley)).toEqual({ type: "none" });
  });
  it("every word of the card is in the note (digits and ordinals may stand for the note's number words)", () => {
    const NUMBERS: Record<string, string> = { "5": "five", "3RD": "third" };
    for (const n of Object.values(NOTES)) {
      const src = new Set(words(`${n.title} ${n.body}`));
      const t = cardText(n);
      for (const tok of expectedText(t).split(/[\s]+/).filter(Boolean)) {
        const w = tok.toLowerCase();
        expect(src.has(w) || src.has(NUMBERS[tok] ?? "") || /^\d+-\d+$/.test(tok) ? true : tok).toBe(true);
      }
    }
  });
  it("never a name: a score card shows only the score", () => {
    expect(expectedText(cardText(NOTES.miami))).toBe("2-2");
  });
  it("a word fits: ≤ 8 characters, or two lines of ≤ 10 split at a space or hyphen", () => {
    expect(fits("FOCUS")).toBe(true);
    expect(fits("STRAIGHT WINS")).toBe(true);
    expect(fits("QUARTER-FINALS")).toBe(true);
    expect(fits("WITHOUT CONVICTION")).toBe(true);
    expect(fits("UNPRECEDENTED RUN")).toBe(false);
    expect(fits("CONSECUTIVELY")).toBe(false);
  });
});

describe("card · the rotation («never two alike»)", () => {
  const row = (r: Partial<LedgerRow>): LedgerRow => ({ at: 0, format: "split", block: "right", dominant: "figure", tint: "red", club: null, ...r });
  it("adjacent cards differ in format AND dominant element; same club → another format; same format+tint in the window → not again", () => {
    const c = { format: "band" as const, block: "lower", dominant: "word" as const, club: "Juventus", tint: "black" };
    expect(violations(c, [])).toEqual([]);
    expect(violations(c, [row({ format: "quote", dominant: "word" })])).toContain("adjacent: same format or dominant");
    expect(violations(c, [row({ format: "band", club: "Juventus", dominant: "figure" }), row({})])).toContain("same club, same format in window");
    expect(violations(c, [row({ format: "band", tint: "black", dominant: "figure" }), row({})])).toContain("same format+tint in window");
    // outside the window it is allowed again
    const old = [row({ format: "band", tint: "black" }), ...Array.from({ length: WINDOW }, () => row({ format: "cutout", block: "full" }))];
    expect(violations(c, old)).not.toContain("same format+tint in window");
  });
  it("the six notes in a row get six cards where no two adjacent share format or dominant element", () => {
    const ledger: LedgerRow[] = [];
    const order = ["bayern", "miami", "chelsea", "bournemouth", "juventus", "burnley"] as const;
    for (const k of order) {
      const n = NOTES[k];
      const c = pickCard(k, sceneKind(n), cardText(n), "red", k, ledger);
      const prev = ledger.at(-1);
      if (prev) {
        expect(c.format).not.toBe(prev.format);
        if (c.text.type !== "none") expect(c.dominant).not.toBe(prev.dominant);
      }
      ledger.push({ at: 0, format: c.format, block: c.block, dominant: c.dominant, tint: c.tint, club: c.club });
    }
  });
  it("deterministic: the same note and ledger give the same card", () => {
    const n = NOTES.miami;
    expect(pickCard("h1", sceneKind(n), cardText(n), "pale pink", "Inter Miami", [])).toEqual(pickCard("h1", sceneKind(n), cardText(n), "pale pink", "Inter Miami", []));
  });
});

describe("card · the prompt", () => {
  it("exact text, one colour, free top corners, FILLED faceless silhouettes from the knees up, no marks; no club, person or league named", () => {
    for (const [k, n] of Object.entries(NOTES)) {
      const c = pickCard(k, sceneKind(n), cardText(n), "royal blue", null, []);
      const p = cardPrompt(c);
      const t = expectedText(c.text);
      if (c.format === "number") {
        expect(p).toContain(`numeral ${c.text.big}`);
        expect(p).toContain(`reading exactly ${c.text.words}`);
      } else if (t) expect(p).toContain(`reading exactly ${t}`);
      else expect(p).toMatch(/no text/i);
      expect(p).toContain("TOP-LEFT and TOP-RIGHT corners clean and empty");
      expect(p).toContain("never an empty or blank face outline");
      expect(p).toContain("framed from the knees up");
      expect(p).toMatch(/no swoosh or stripes/);
      expect(p).not.toMatch(/blue and black|black and blue/i);
      for (const name of ["Bayern", "Miami", "Cincinnati", "Chelsea", "Alonso", "Bournemouth", "Juventus", "Genoa", "Burnley", "DFB", "Serie A", "Premier League"]) expect(p).not.toContain(name);
    }
  });
});

describe("card · the anti-duplicate (dHash 8×8 + colour 4×4)", () => {
  it("both under the thresholds = the same card; one over = different", () => {
    expect(hamming("ffffffffffffffff", "fffffffffffffff0")).toBe(4);
    expect(colourDist([10, 10, 10], [13, 7, 10])).toBe(2);
    const ledger: LedgerRow[] = [{ at: 0, format: "split", block: "right", dominant: "figure", tint: "red", club: null, dhash: "ffffffffffffffff", csig: Array(48).fill(100) }];
    expect(tooSimilar({ dhash: "fffffffffffffff0", csig: Array(48).fill(110) }, ledger)).toMatch(/looks like a recent card \(dHash 4\/64, colour 10\.0\)/);
    expect(tooSimilar({ dhash: "0000000000000000", csig: Array(48).fill(110) }, ledger)).toBeNull();
    expect(tooSimilar({ dhash: "fffffffffffffff0", csig: Array(48).fill(200) }, ledger)).toBeNull();
  });
});

describe("card · after the first dry-run (29/10): no empty placeholders, no navy-on-navy, more notes with a text", () => {
  it("«100 MLS goals» → 100 + GOALS; «made MLS history» → HISTORY", () => {
    expect(cardText({ title: "Brian White has 100 MLS goals", body: "His focus is on the Vancouver Whitecaps winning a title." })).toEqual({ type: "count", big: "100", words: "GOALS" });
    expect(cardText({ title: "Osorio's goal makes MLS history", body: "Jonathan Osorio scored in his most recent match." })).toEqual({ type: "word", words: "HISTORY" });
  });
  it("score has no empty frame; cut-out figure is navy/white on the club colour, chest up", () => {
    const base = { block: "left", dominant: "figure", tint: "red", club: null, figure: "a head coach", object: "a ball" } as const;
    const sc = cardPrompt({ ...base, format: "score", text: { type: "score", big: "2-0" } } as never);
    expect(sc).not.toMatch(/hairline frame runs along the lower third/);
    expect(sc).toMatch(/round soccer ball/); // 30/10: «football» came out as an American football
    for (const text of [{ type: "none" }, { type: "word", words: "FOCUS" }]) {
      const p = cardPrompt({ ...base, format: "cutout", block: "full", text } as never);
      expect(p).toMatch(/filled with solid deep navy #071329/);
      expect(p).toMatch(/the figure is never red/);
      expect(p).toMatch(/from the chest up only/);
      expect(p).not.toMatch(/in plain red kit/);
    }
  });
  it("a card without text asks for no band, box, frame or hairline, and a split panel carries an object instead of nothing", () => {
    for (const format of ["split", "cutout"] as const) {
      const p = cardPrompt({ format, block: "right", dominant: "figure", tint: "teal", club: null, text: { type: "none" }, figure: "a footballer", object: "a huge plain white football with no logo" });
      expect(p).toContain("no typography at all, no band, no box, no frame, no hairline");
      expect(p).not.toMatch(/white band|hairline frame around/);
      if (format === "split") expect(p).toContain("panel with a huge plain white football");
    }
  });
  it("no club colour → a neutral tint by hash, never the navy ink", async () => {
    const { cardTint, NEUTRAL_TINTS } = await import("./card");
    expect(cardTint("deep red", "h")).toBe("deep red");
    expect(NEUTRAL_TINTS).toContain(cardTint(null, "h"));
    expect(cardTint(null, "h")).toBe(cardTint(null, "h"));
  });
});
