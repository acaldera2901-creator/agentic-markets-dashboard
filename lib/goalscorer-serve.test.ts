import { describe, it, expect } from "vitest";
import {
  buildGoalscorerByMatch,
  groupProfilesByTeam,
  groupOddsByMatch,
  fixMojibake,
  GsPrediction,
  ProfileRow,
  OddRow,
} from "./goalscorer-serve";

const pred = (over: Partial<GsPrediction> = {}): GsPrediction => ({
  matchId: "m1", homeTeam: "Spain", awayTeam: "Italy",
  lambdaHome: 1.5, lambdaAway: 1.0, ...over,
});

describe("groupProfilesByTeam", () => {
  it("raggruppa per team normalizzato e mappa i campi", () => {
    const rows: ProfileRow[] = [
      { player_id: "1", name: "A", team: "  SPAIN ", goals_per90_season: 0.6, minutes_share: 0.9, tier: 1 },
      { player_id: "2", name: "B", team: "Spain", goals_per90_season: 0.4, minutes_share: 1.0, tier: 1 },
    ];
    const m = groupProfilesByTeam(rows);
    expect(m.get("spain")).toHaveLength(2);
    expect(m.get("spain")![0].goalsPer90).toBe(0.6);
  });
  it("tollera null (g90/minuti/tier mancanti -> 0)", () => {
    const rows: ProfileRow[] = [
      { player_id: null, name: "X", team: "Italy", goals_per90_season: null, minutes_share: null, tier: null },
    ];
    const p = groupProfilesByTeam(rows).get("italy")![0];
    expect(p.goalsPer90).toBe(0);
    expect(p.tier).toBe(0);
  });
  it("#GS-DEDUP: fonde varianti accento/iniziale dello stesso giocatore (stessa squadra)", () => {
    const rows: ProfileRow[] = [
      { player_id: "1", name: "Marko Arnautović", team: "Austria", goals_per90_season: 0.4, minutes_share: 1.0, tier: 1 },
      { player_id: "2", name: "M. Arnautovic", team: "Austria", goals_per90_season: 0.3, minutes_share: 0.6, tier: 2 },
      { player_id: "3", name: "R. Schmid", team: "Austria", goals_per90_season: 0.2, minutes_share: 0.5, tier: 2 },
      { player_id: "4", name: "Romano Schmid", team: "Austria", goals_per90_season: 0.5, minutes_share: 1.0, tier: 1 },
    ];
    const players = groupProfilesByTeam(rows).get("austria")!;
    expect(players).toHaveLength(2); // Arnautović + Schmid, non 4
    // tiene il record più rilevante (peso g90×minuti maggiore) per ciascuno
    expect(players.find((p) => /arnaut/i.test(p.name))!.goalsPer90).toBe(0.4);
    expect(players.find((p) => /schmid/i.test(p.name))!.goalsPer90).toBe(0.5);
  });
  it("#GS-DEDUP: NON fonde cognomi diversi né iniziali diverse", () => {
    const rows: ProfileRow[] = [
      { player_id: "1", name: "M. Arnautovic", team: "Austria", goals_per90_season: 0.4, minutes_share: 1.0, tier: 1 },
      { player_id: "2", name: "D. Alaba", team: "Austria", goals_per90_season: 0.3, minutes_share: 1.0, tier: 1 },
      { player_id: "3", name: "K. Schmid", team: "Austria", goals_per90_season: 0.2, minutes_share: 1.0, tier: 2 },
      { player_id: "4", name: "R. Schmid", team: "Austria", goals_per90_season: 0.2, minutes_share: 1.0, tier: 2 },
    ];
    expect(groupProfilesByTeam(rows).get("austria")!).toHaveLength(4);
  });
  it("#GOLIVE: fixMojibake ripara il nome nel profilo, guardato sui non-mojibake", () => {
    const mojibake = Buffer.from("L. Östman", "utf8").toString("latin1"); // "L. Ã–stman"
    expect(mojibake).not.toBe("L. Östman");
    expect(fixMojibake(mojibake)).toBe("L. Östman");
    expect(fixMojibake("Kevin De Bruyne")).toBe("Kevin De Bruyne"); // niente firma → invariato
    const row: ProfileRow = { player_id: "1", name: mojibake, team: "Sweden", goals_per90_season: 0.5, minutes_share: 1.0, tier: 1 };
    expect(groupProfilesByTeam([row]).get("sweden")![0].name).toBe("L. Östman");
  });
});

describe("groupOddsByMatch", () => {
  it("raggruppa per match_id, salta righe senza match_id o price", () => {
    const rows: OddRow[] = [
      { match_id: "m1", player_name: "A", price: 2.0, bookmaker: "fanduel" },
      { match_id: null, player_name: "B", price: 3.0, bookmaker: "x" },
      { match_id: "m1", player_name: "C", price: null, bookmaker: "y" },
    ];
    const m = groupOddsByMatch(rows);
    expect(m.get("m1")).toHaveLength(1);
    expect(m.get("m1")![0].playerName).toBe("A");
  });
});

describe("buildGoalscorerByMatch", () => {
  const profiles = groupProfilesByTeam([
    { player_id: "1", name: "Striker ES", team: "Spain", goals_per90_season: 0.7, minutes_share: 1.0, tier: 1 },
    { player_id: "2", name: "Striker IT", team: "Italy", goals_per90_season: 0.5, minutes_share: 1.0, tier: 2 },
  ]);

  it("produce mercati per match con join team + quote", () => {
    const odds = groupOddsByMatch([
      { match_id: "m1", player_name: "Striker ES", price: 2.0, bookmaker: "draftkings" },
    ]);
    const out = buildGoalscorerByMatch([pred()], profiles, odds);
    const markets = out.get("m1")!;
    expect(markets.length).toBe(2); // un home + un away
    const es = markets.find((m) => m.name === "Striker ES")!;
    expect(es.side).toBe("home");
    expect(es.bestPrice).toBe(2.0); // quota agganciata
    const it = markets.find((m) => m.name === "Striker IT")!;
    expect(it.side).toBe("away");
    expect(it.marketImplied).toBeNull(); // nessuna quota -> null onesto
    expect(it.confidence).toBe("media"); // tier 2
  });

  it("salta match con lambda null", () => {
    const out = buildGoalscorerByMatch([pred({ lambdaHome: null })], profiles, new Map());
    expect(out.size).toBe(0);
  });

  it("salta match senza dati giocatore per nessuna delle due squadre", () => {
    const out = buildGoalscorerByMatch(
      [pred({ homeTeam: "Brazil", awayTeam: "Argentina" })], profiles, new Map());
    expect(out.size).toBe(0);
  });
});
