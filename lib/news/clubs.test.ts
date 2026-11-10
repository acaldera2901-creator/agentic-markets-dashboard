// lib/news/clubs.test.ts (#NEWS-FOTMOB-PROD-1026) — the clubs a note names
// (EN/IT spellings, order of appearance, at most two), the curated colour
// table (two valid hex per entry, no duplicate spelling), and the fallbacks:
// no club → nothing; a club with no bundled crest → no crest, never a
// substitute; an unsure entry → no tint.
import { describe, expect, it } from "vitest";
import { badgeFor, CLUBS, clubsInText, noteBadges } from "./clubs";
import { norm } from "./teams";

const HEX = /^#[0-9A-F]{6}$/;

describe("the table", () => {
  it("every entry has a name, two valid hex colours (or none), and no spelling is claimed by two clubs", () => {
    const seen = new Map<string, string>();
    for (const c of CLUBS) {
      expect(c.name.trim().length).toBeGreaterThan(0);
      expect(c.names[0]).toBe(c.name);
      if (c.colors) { expect(c.colors[0]).toMatch(HEX); expect(c.colors[1]).toMatch(HEX); expect(c.colors[0]).not.toBe(c.colors[1]); }
      for (const n of c.names) {
        const k = norm(n);
        expect(seen.get(k) ?? c.name, `«${n}» claimed by ${seen.get(k)} and ${c.name}`).toBe(c.name);
        seen.set(k, c.name);
      }
    }
    expect(CLUBS.length).toBeGreaterThan(100);
  });
});

describe("clubsInText · the five real notes of 26/10 and the mock", () => {
  it("Real Madrid then Barcelona; Manchester United then Bournemouth; LAFC then LA Galaxy; Leverkusen then Hoffenheim", () => {
    expect(clubsInText("Real Madrid beat Barcelona 2-1, Mourinho not satisfied. Real Madrid beat Barcelona 2-1 on Sunday, and Barcelona are the LaLiga leaders.").map((c) => c.name)).toEqual(["Real Madrid CF", "FC Barcelona"]);
    expect(clubsInText("Neville criticises Manchester United players; Carrick under growing strain. Manchester United went down 3-0 at home to Bournemouth.").map((c) => c.name)).toEqual(["Manchester United FC", "AFC Bournemouth"]);
    expect(clubsInText("Los Angeles FC secure playoff place after 2-2 draw. Los Angeles FC have secured a playoff place after recovering from 2-0 behind to finish level at 2-2 against LA Galaxy in the El Trafico derby.").map((c) => c.name)).toEqual(["Los Angeles FC", "LA Galaxy"]);
    expect(clubsInText("Andrich concerned after Bade's serious head injury against Hoffenheim. Bayer Leverkusen lost to Hoffenheim, ending their unbeaten league run.").map((c) => c.name)).toEqual(["TSG Hoffenheim", "Bayer 04 Leverkusen"]);
  });
  it("the Best XI note names Manchester City only; the derby names Milan then Inter", () => {
    expect(clubsInText("Jackson, Gabriel and Rayan named in FotMob's MD8 Best XI. The Premier League round finished on Sunday, and with it Manchester City's 100% record ended.").map((c) => c.name)).toEqual(["Manchester City FC"]);
    expect(clubsInText("Milan and Inter name their squads for Saturday's derby. AC Milan and Internazionale Milano meet at San Siro on Saturday evening.").map((c) => c.name)).toEqual(["AC Milan", "FC Internazionale Milano"]);
  });
  it("Italian spellings: Barcellona, Bayern Monaco, Lione, Man Utd", () => {
    expect(clubsInText("Il Real Madrid batte il Barcellona 2-1").map((c) => c.name)).toEqual(["Real Madrid CF", "FC Barcelona"]);
    expect(clubsInText("Il Bayern Monaco passa a Lione").map((c) => c.name)).toEqual(["FC Bayern München", "Olympique Lyonnais"]);
    expect(clubsInText("Man Utd beat Spurs").map((c) => c.name)).toEqual(["Manchester United FC", "Tottenham Hotspur FC"]);
  });
  it("at most two, in order of appearance; the longer name owns its words (Inter Miami is not Inter; Espanyol de Barcelona is not Barcelona)", () => {
    expect(clubsInText("Juventus, Napoli and Roma all won").map((c) => c.name)).toEqual(["Juventus FC", "SSC Napoli"]);
    expect(clubsInText("Messi scores for Inter Miami").map((c) => c.name)).toEqual(["Inter Miami CF"]);
    expect(clubsInText("Espanyol de Barcelona held Girona").map((c) => c.name)).toEqual(["RCD Espanyol de Barcelona", "Girona FC"]);
    expect(clubsInText("A quiet day for the referees")).toEqual([]);
  });
});

describe("badges · crest and colours, never invented", () => {
  it("the note clubs have their real crest from the board's map and their colours", () => {
    const b = noteBadges("Real Madrid beat Barcelona 2-1", "");
    expect(b).toEqual([
      { name: "Real Madrid CF", crest: "/crests/football/real-madrid-cf.webp", colors: ["#FFFFFF", "#00529F"] },
      { name: "FC Barcelona", crest: "/crests/football/fc-barcelona.webp", colors: ["#A50044", "#004D98"] },
    ]);
    for (const n of ["AC Milan", "FC Internazionale Milano", "Manchester United FC", "Manchester City FC", "Los Angeles FC", "AFC Bournemouth", "LA Galaxy", "Bayer 04 Leverkusen", "TSG Hoffenheim"]) {
      const c = CLUBS.find((x) => x.name === n)!;
      expect(badgeFor(c).crest, n).toMatch(/^\/crests\/football\/[a-z0-9-]+\.webp$/);
    }
  });
  it("a club without a bundled crest keeps its name and colours but no crest; an unsure entry gives no tint", () => {
    const ajax = CLUBS.find((c) => c.name === "Ajax")!;
    expect(badgeFor(ajax)).toEqual({ name: "Ajax", crest: null, colors: ["#FFFFFF", "#D2122E"] });
    const venezia = CLUBS.find((c) => c.name === "Venezia FC")!;
    expect(venezia.unsure).toBe(true);
    expect(badgeFor(venezia).colors).toBeNull();
  });
  it("no club in the text → no badge", () => {
    expect(noteBadges("Stadium roof works to start in spring", "The club confirmed the timetable.")).toEqual([]);
  });
});
