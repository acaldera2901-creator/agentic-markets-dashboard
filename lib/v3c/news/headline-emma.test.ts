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
  it("1–3 balanced lines; one word or more than 9 words → none", () => {
    expect(headlineLines("Raphinha commits to Barcelona until 2030")).toEqual(["Raphinha commits to", "Barcelona until 2030"]);
    expect(headlineLines("Como equal Champions League record for biggest win against Lens")).toEqual([]); // 11 words: too long, no headline
    expect(headlineLines("Rooney")).toEqual([]);
    expect(headlineLines("one two three four five six seven eight nine ten")).toEqual([]);
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
