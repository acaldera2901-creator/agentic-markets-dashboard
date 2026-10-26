// lib/news/kind.test.ts (#NEWS-FOTMOB-PROD-1026) — the picture of a note from
// its words: the five real notes of the 26/10 dry run, the art direction's
// priority (02 > 06 > 05 > 03 > 04 > 01 > 07), the de-dup between neighbours,
// and the picture map pointing only at files that exist in /public/news.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dedupeKinds, KIND_BY_NUMBER, KIND_NUMBER, NEWS_IMAGES, NEWS_KINDS, newsImage, newsKind, pickNewsImage } from "./kind";

const note = (en: [string, string], it: [string, string] = en) => ({ note: { kind: "ai" as const, en: { title: en[0], body: en[1] }, it: { title: it[0], body: it[1] }, model: "" } });

describe("newsKind · the five real notes of 26/10", () => {
  it("a score line is a result (01)", () => {
    expect(newsKind(note(["Real Madrid beat Barcelona 2-1, Mourinho not satisfied", "Real Madrid beat Barcelona 2-1 on Sunday, and Barcelona are the LaLiga leaders. Jose Mourinho nonetheless is not satisfied with the outcome."], ["Il Real Madrid batte il Barcellona 2-1, Mourinho non è soddisfatto", "Il Real Madrid ha battuto il Barcellona 2-1 domenica."]))).toBe("risultato");
    expect(newsKind(note(["Los Angeles FC secure playoff place after 2-2 draw", "Los Angeles FC have secured a playoff place after recovering from 2-0 behind to finish level at 2-2 against LA Galaxy in the El Trafico derby."]))).toBe("risultato");
  });
  it("a pundit criticising and a coach under strain is a bench story (04) even when the body carries a score", () => {
    expect(newsKind(note(["Neville criticises Manchester United players; Carrick under growing strain", "Manchester United went down 3-0 at home to Bournemouth, a result that extended a poor run for the club. Carrick's position is increasingly under strain."], ["Neville critica i giocatori del Manchester United; Carrick sotto crescente pressione", "Il Manchester United è stato sconfitto 3-0 in casa dal Bournemouth."]))).toBe("panchina");
  });
  it("an injury headline is an injury story (02) even after a defeat", () => {
    expect(newsKind(note(["Andrich concerned after Bade's serious head injury against Hoffenheim", "Bayer Leverkusen lost to Hoffenheim, ending their unbeaten league run. Loic Bade left the field on a stretcher late in the match."], ["Andrich preoccupato dopo il grave infortunio alla testa di Bade contro l'Hoffenheim", "Il Bayer Leverkusen ha perso con l'Hoffenheim. Loic Bade è uscito dal campo in barella."]))).toBe("infortunio");
  });
  it("a Best XI is an award (05)", () => {
    expect(newsKind(note(["Jackson, Gabriel and Rayan named in FotMob's MD8 Best XI", "Jackson, Gabriel and Rayan are included in the FotMob Best XI for MD8. The Premier League round finished on Sunday, and with it Manchester City's 100% record ended."]))).toBe("premi");
  });
});

describe("pickNewsImage · priority and edges", () => {
  it("squad lists → 3; a signing → 6; a stadium story → 7", () => {
    expect(pickNewsImage("Milan and Inter name their squads for Saturday's derby", "Both clubs published their squad lists on Friday.")).toBe(3);
    expect(pickNewsImage("Club signs defender on loan until June", "The deal includes an option to buy.")).toBe(6);
    expect(pickNewsImage("Stadium roof works to start in spring", "The club confirmed the timetable on Monday.")).toBe(7);
  });
  it("on a tie the art direction's order wins: injury over result, market over award, line-ups over bench", () => {
    expect(pickNewsImage("Injury and defeat", "")).toBe(2);
    expect(pickNewsImage("Transfer and award", "")).toBe(6);
    expect(pickNewsImage("Squad and coach", "")).toBe(3);
  });
  it("the title counts double: a result headline with a passing knee mention stays a result", () => {
    expect(pickNewsImage("Rangers win 2-0 at Hearts", "One player was treated for a knee knock after the match.")).toBe(1);
  });
  it("accents and curly apostrophes do not matter; IT keywords count", () => {
    expect(pickNewsImage("Pallone d’Oro: la classifica", "I candidati sono stati annunciati.")).toBe(5);
    expect(pickNewsImage("Il tecnico in conferenza: le dichiarazioni", "")).toBe(4);
  });
  it("numbers and kinds map both ways", () => {
    for (const k of NEWS_KINDS) expect(KIND_BY_NUMBER[KIND_NUMBER[k]]).toBe(k);
  });
});

describe("dedupeKinds · no two neighbours on the same picture", () => {
  it("the second of a pair moves to its near kind: 01→07, 07→01, 04→06, 06→04, 03→04, the rest → 07", () => {
    expect(dedupeKinds(["risultato", "risultato", "risultato"])).toEqual(["risultato", "generica", "risultato"]);
    expect(dedupeKinds(["generica", "generica"])).toEqual(["generica", "risultato"]);
    expect(dedupeKinds(["panchina", "panchina", "mercato", "mercato"])).toEqual(["panchina", "mercato", "panchina", "mercato"]);
    expect(dedupeKinds(["formazioni", "formazioni"])).toEqual(["formazioni", "panchina"]);
    expect(dedupeKinds(["infortunio", "infortunio", "premi", "premi"])).toEqual(["infortunio", "generica", "premi", "generica"]);
    expect(dedupeKinds([])).toEqual([]);
  });
  it("different neighbours are left alone", () => {
    expect(dedupeKinds(["risultato", "infortunio", "risultato"])).toEqual(["risultato", "infortunio", "risultato"]);
  });
});

describe("the pictures", () => {
  it("every kind has its picture in /public/news, ours (not fotmob), 16:9 — generica included: the fallback is a real picture, not a placeholder", () => {
    for (const k of NEWS_KINDS) {
      const img = NEWS_IMAGES[k];
      expect(img, k).toBeDefined();
      expect(img!.src).toBe(`/news/news-0${KIND_NUMBER[k]}-${k}.webp`);
      expect(img!.src).not.toMatch(/fotmob/i);
      expect(existsSync(join(process.cwd(), "public", img!.src)), img!.src).toBe(true);
      expect(img!.width / img!.height).toBeCloseTo(16 / 9, 2);
    }
    expect(newsImage("generica")?.src).toBe("/news/news-07-generica.webp");
  });
});
