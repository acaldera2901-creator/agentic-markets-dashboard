import { describe, it, expect } from "vitest";
import { fetchSummerHistory, matchModelTeam } from "./summer-leagues";
import { buildModel } from "./poisson-model";

// #TEAM-MATCHER-1007 — `matchModelTeam` returned the FIRST roster team whose
// normalized name was a raw SUBSTRING of the fixture name (or vice versa),
// before ever looking for an exact match. Measured in production on 2026-10-07:
// "Cercle Brugge KSV" was computed as Club Brugge ("brugge" ⊂ "cercle brugge
// ksv"), "Dundee FC" as Dundee United, "Aris" as Larisa ("aris" ⊂ "larisa"),
// "Los Angeles FC" as LA Galaxy. Which side won depended on roster order, which
// changes with every snapshot refresh — so the bug flipped direction over time.

const ROSTER_PAIRS: Array<[string, string]> = [
  ["Club Brugge", "Cercle Brugge KSV"],
  ["Dundee", "Dundee United"],
  ["Aris", "Larisa"],
  ["Los Angeles Galaxy", "Los Angeles FC"],
];

function bothOrders(roster: string[]): string[][] {
  return [roster, [...roster].reverse()];
}

describe("#TEAM-MATCHER-1007 exact match always wins, in any roster order", () => {
  it("Cercle Brugge KSV is never Club Brugge, and vice versa", () => {
    for (const r of bothOrders(["Club Brugge", "Anderlecht", "Cercle Brugge KSV", "KAA Gent"])) {
      expect(matchModelTeam("Cercle Brugge KSV", r)).toBe("Cercle Brugge KSV");
      expect(matchModelTeam("Club Brugge", r)).toBe("Club Brugge");
    }
  });

  it("Dundee / Dundee FC is never Dundee United, and vice versa", () => {
    for (const r of bothOrders(["Dundee United", "Celtic", "Dundee", "Falkirk"])) {
      expect(matchModelTeam("Dundee", r)).toBe("Dundee");
      expect(matchModelTeam("Dundee FC", r)).toBe("Dundee");
      expect(matchModelTeam("Dundee United", r)).toBe("Dundee United");
    }
  });

  it("Aris is never Larisa (raw substring 'aris' ⊂ 'larisa')", () => {
    for (const r of bothOrders(["Larisa", "PAOK", "Aris", "Volos"])) {
      expect(matchModelTeam("Aris", r)).toBe("Aris");
      expect(matchModelTeam("Aris Thessaloniki", r)).toBe("Aris");
      expect(matchModelTeam("Larisa", r)).toBe("Larisa");
    }
    // Larisa absent: "aris" must not be read inside "larisa".
    expect(matchModelTeam("Aris", ["Larisa", "PAOK"])).toBeNull();
    expect(matchModelTeam("Aris", ["Larisa"])).toBeNull();
  });

  it("Los Angeles FC is never LA Galaxy, and vice versa", () => {
    for (const r of bothOrders(["Los Angeles Galaxy", "Austin FC", "Los Angeles FC"])) {
      expect(matchModelTeam("Los Angeles FC", r)).toBe("Los Angeles FC");
      expect(matchModelTeam("Los Angeles Galaxy", r)).toBe("Los Angeles Galaxy");
    }
  });

  it("Wieczysta Krakow is never Rakow ('rakow' ⊂ 'krakow'), Wisla is never Wisla Plock", () => {
    for (const r of bothOrders(["Rakow", "Wisla Plock", "Wieczysta Krakow", "Wisla"])) {
      expect(matchModelTeam("Wieczysta Krakow", r)).toBe("Wieczysta Krakow");
      expect(matchModelTeam("Rakow", r)).toBe("Rakow");
      expect(matchModelTeam("Wisla", r)).toBe("Wisla");
      expect(matchModelTeam("Wisła Płock", r)).toBe("Wisla Plock");
    }
  });

  it("the KSV suffix is noise: 'Cercle Brugge' finds Cercle, not Club Brugge", () => {
    for (const r of bothOrders(["Club Brugge", "Cercle Brugge KSV"])) {
      expect(matchModelTeam("Cercle Brugge", r)).toBe("Cercle Brugge KSV");
    }
  });

  it("names that drift by a word ENDING still match (replay on prediction_log, 2026-10-07)", () => {
    expect(matchModelTeam("FC Lausanne-Sport", ["Lausanne Sports", "FC Basel"])).toBe("Lausanne Sports");
    expect(matchModelTeam("Djurgardens IF", ["Djurgården", "AIK"])).toBe("Djurgården");
    expect(matchModelTeam("Stade Lavallois", ["Stade Laval", "Sochaux"])).toBe("Stade Laval");
    expect(matchModelTeam("Sint Truiden", ["Sint-Truidense", "Genk"])).toBe("Sint-Truidense");
    expect(matchModelTeam("Asteras Tripolis", ["Asteras Tripoli", "Aris"])).toBe("Asteras Tripoli");
    expect(matchModelTeam("Amed SK", ["Amedspor", "Bodrumspor"])).toBe("Amedspor");
    // ...but never a piece from the MIDDLE of a word, nor a prefix under 4 letters
    expect(matchModelTeam("Aris", ["Larisa"])).toBeNull();
    expect(matchModelTeam("Rakow", ["Wieczysta Krakow"])).toBeNull();
    expect(matchModelTeam("St Mirren", ["Stade Mirren"])).toBeNull();
  });

  it("an ambiguous token containment returns null, never the first candidate", () => {
    // "Los Angeles" is contained in BOTH roster names → no match.
    for (const r of bothOrders(["Los Angeles Galaxy", "Los Angeles FC United"])) {
      expect(matchModelTeam("Los Angeles", r)).toBeNull();
    }
  });

  it("a unique whole-token containment still matches", () => {
    expect(matchModelTeam("Legia Warsaw", ["Legia", "Lech"])).toBe("Legia");
    expect(matchModelTeam("Aris Thessaloniki", ["Aris", "PAOK"])).toBe("Aris");
  });
});

describe("#TEAM-MATCHER-1007 on the real shipped snapshot", () => {
  it("the 4 production cases resolve to themselves on the real roster, both orders", () => {
    const leagueOf: Record<string, string> = {
      "Cercle Brugge KSV": "BEL", "Club Brugge": "BEL",
      "Dundee": "SCO", "Dundee United": "SCO",
      "Aris": "GRE", "Larisa": "GRE",
      "Los Angeles FC": "MLS", "Los Angeles Galaxy": "MLS",
    };
    for (const [a, b] of ROSTER_PAIRS) {
      const model = buildModel(fetchSummerHistory(leagueOf[a]));
      expect(model).not.toBeNull();
      for (const r of bothOrders(Object.keys(model!.strengths))) {
        expect(matchModelTeam(a, r)).toBe(a);
        expect(matchModelTeam(b, r)).toBe(b);
      }
    }
    const sco = Object.keys(buildModel(fetchSummerHistory("SCO"))!.strengths);
    expect(matchModelTeam("Dundee FC", sco)).toBe("Dundee");
  });

  it("every roster name of every summer league maps to itself, in both orders", () => {
    const history = fetchSummerHistory;
    const codes = ["ELI", "ALL", "VEI", "LOI", "CSL", "SB", "AUT", "DNK", "POL", "SWZ", "BEL", "ARG", "BRA",
      "MEX", "MLS", "EFLC", "EL1", "EL2", "SCO", "BL2", "FL2", "PD2", "NED", "POR", "TUR", "GRE"];
    const wrong: string[] = [];
    for (const code of codes) {
      const model = buildModel(history(code));
      if (!model) continue;
      for (const r of bothOrders(Object.keys(model.strengths))) {
        for (const team of r) {
          const got = matchModelTeam(team, r);
          if (got !== team) wrong.push(`${code}: ${team} → ${got}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});
