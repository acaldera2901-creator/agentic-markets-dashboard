// lib/v3c/news/headline-emma.test.ts (G5) — the emma headline comes from the rewritten note's title; crests only for clubs the title names.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cardJob } from "./card-job";
import { cardText, pickCard } from "./card";
import { headlineLines } from "./card-emma";
import { sceneKind } from "./image";
import { titleCrestRefs } from "./emma-assets";

const PUBLIC = join(__dirname, "../../../public");
const env = { NEWS_IMAGE_STYLE: "emma", NEWS_WATCHER_PUBLIC_DIR: PUBLIC } as unknown as NodeJS.ProcessEnv;
const spec = (note: { title: string; body: string }, teams: string[]) => pickCard("deadbeef", sceneKind(note), cardText(note), null, teams[0] ?? null, []);

describe("headlineLines", () => {
  it("Emma's rule: the title as is up to ~60 chars (1–3 evenly split lines), longer → ≤7 words without filler or dangling end; one word → none", () => {
    expect(headlineLines("Raphinha commits to Barcelona until 2030")).toEqual(["Raphinha commits to", "Barcelona until 2030"]);
    expect(headlineLines("Como equal Champions League record for biggest win against Lens")).toEqual(["Como equal Champions", "League record", "biggest win"]); // 63 chars → shortened
    expect(headlineLines("Kovac wanted to avoid risk over Guirassy injury")).toEqual(["Kovac wanted to", "avoid risk over", "Guirassy injury"]);
    expect(headlineLines("Haaland late winner as RB Leipzig pegged Man City back")).toEqual(["Haaland late winner as", "RB Leipzig pegged", "Man City back"]);
    // T17: a long title loses its trailing clause instead of ending mid-sentence
    expect(headlineLines("Scott McTominay discloses heart treatment two days before the World Cup")).toEqual(["Scott McTominay discloses", "heart treatment"]);
    expect(headlineLines("Pagis earns first France call-up; Konate and Tchouameni are back")).toEqual(["Pagis earns first", "France call-up"]);
    expect(headlineLines("Rooney")).toEqual([]);
    expect(headlineLines("one two three four five six seven eight nine ten eleven twelve").length).toBeLessThanOrEqual(3); // > 11 words → cut to 7
    expect(headlineLines("Short title.")).toEqual(["Short title"]);
  });
});

describe("cardJob emma", () => {
  it("a note with no caption gets a headline (not the label alone): expected contains the title words", () => {
    const note = { title: "Raphinha commits to Barcelona until 2030", body: "Raphinha has agreed a new contract with Barcelona that runs to 2030." };
    const j = cardJob(spec(note, ["Barcelona"]), note, ["Barcelona"], env);
    expect(j.expected).toMatch(/^NEWS RAPHINHA COMMITS TO BARCELONA UNTIL 2030|^NEWS Raphinha commits to Barcelona until 2030/i);
    expect(j.prompt).toMatch(/headline on 2 lines, first line Raphinha commits to, second line Barcelona until 2030/);
  });
  it("crests: only the clubs the TITLE names — Guirassy/Kovac (teams = [Real Betis]) gets none", () => {
    const note = { title: "Kovac wanted to avoid risk over Guirassy injury", body: "Serhou Guirassy left the field during the first half of the match against Real Betis." };
    expect(titleCrestRefs(note.title, PUBLIC)).toEqual([]);
    const j = cardJob(spec(note, ["Real Betis"]), note, ["Real Betis"], env);
    expect(j.refs).toBeUndefined();
    expect(j.prompt).not.toMatch(/Real Betis/i);
  });
  it("crests: the title names the club → its crest, never the opponent only in the body", () => {
    const b = titleCrestRefs("Raphinha commits to Barcelona until 2030", PUBLIC);
    expect(b).toHaveLength(1);
    expect(b[0].file).toMatch(/fc-barcelona\.webp$/);
    expect(titleCrestRefs("Haaland late winner as RB Leipzig pegged Man City back", PUBLIC).length).toBe(2);
  });
});

import { emmaText } from "./card-emma";
describe("caption / figure next to the title headline (Emma: never the headline, at most a badge)", () => {
  const cap = (words: string, big = "") => ({ text: { type: "word", words, big }, figure: "", format: "x", block: "x", dominant: "x", tint: null, club: null, object: "" }) as never;
  it("caption already in the title → no badge; caption not in the title → badge, never the headline", () => {
    expect(emmaText(cap("INJURY"), { headline: ["Kovac wanted to", "avoid risk over", "Guirassy injury"] }).badge).toBeNull();
    const t = emmaText(cap("RECORD"), { headline: ["Como beat Lens", "nine goals"] });
    expect(t.headline).toEqual(["Como beat Lens", "nine goals"]);
    expect(t.badge).toBe("RECORD");
    expect(t.expected).toBe("NEWS Como beat Lens nine goals RECORD");
  });
});
