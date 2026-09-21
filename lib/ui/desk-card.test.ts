import { describe, it, expect } from "vitest";
import { fromDeskFootball, fromDeskTennis, topFootballKey, type DeskFootballRow, type DeskTennisRow } from "./desk-card";

const football: DeskFootballRow = {
  match_id: "m1",
  league: "PL",
  league_name: "Premier League",
  home_team: "Arsenal",
  away_team: "Chelsea",
  kickoff: "2026-09-21T19:45:00Z",
  p_home: 0.64, p_draw: 0.2, p_away: 0.16,
  odds_home: 1.92, odds_draw: 3.6, odds_away: 5.0,
  best_selection: "HOME",
  explanation: "Model rates Arsenal higher.",
};

const tennis: DeskTennisRow = {
  id: "t1",
  player1: "Sinner", player2: "Alcaraz",
  tournament: "US Open",
  scheduled: "2026-09-21T17:00:00Z",
  p1: 0.58, p2: 0.42,
  odds_p1: 1.8, odds_p2: 2.1,
  best_selection: "P1",
};

describe("topFootballKey", () => {
  it("nomina l'esito più probabile, pareggio compreso", () => {
    expect(topFootballKey({ p_home: 0.64, p_draw: 0.2, p_away: 0.16 })).toBe("HOME");
    expect(topFootballKey({ p_home: 0.2, p_draw: 0.5, p_away: 0.3 })).toBe("DRAW");
    expect(topFootballKey({ p_home: 0.2, p_draw: 0.3, p_away: 0.5 })).toBe("AWAY");
  });
});

describe("fromDeskFootball", () => {
  it("model dalla probabilità della pick, market da 1/quota, edge = differenza", () => {
    const d = fromDeskFootball(football, { winLabel: "to win", kickoffLabel: "Today · 21:45" });
    expect(d.pick).toBe("Arsenal to win");
    expect(Math.round(d.modelPct!)).toBe(64);
    expect(Math.round(d.marketPct!)).toBe(52);
    expect(d.edgePct).toBeCloseTo(11.92, 2);
    expect(d.league).toBe("Premier League");
    expect(d.kickoffLabel).toBe("Today · 21:45");
  });

  it("senza quota sull'esito scelto non c'è mercato e non c'è edge", () => {
    const d = fromDeskFootball({ ...football, odds_home: null }, { winLabel: "to win" });
    expect(d.marketPct).toBeNull();
    expect(d.edgePct).toBeNull();
    expect(d.modelPct).not.toBeNull();
  });

  it("sotto il floor nomina l'esito più probabile ma non dice «vince»", () => {
    const d = fromDeskFootball(
      { ...football, enrichment: { surface: { below_floor: true } } },
      { winLabel: "to win" },
    );
    expect(d.pick).toBe("Arsenal");
  });

  it("senza best_selection ricade sull'esito più probabile", () => {
    const d = fromDeskFootball({ ...football, best_selection: null }, { winLabel: "to win" });
    expect(d.pick).toBe("Arsenal to win");
  });

  it("il pareggio non «vince» e usa l'etichetta localizzata", () => {
    const d = fromDeskFootball(
      { ...football, p_home: 0.2, p_draw: 0.5, p_away: 0.3, best_selection: "DRAW" },
      { winLabel: "to win", drawLabel: "Pareggio" },
    );
    expect(d.pick).toBe("Pareggio");
    expect(Math.round(d.modelPct!)).toBe(50);
  });

  it("propaga locked", () => {
    expect(fromDeskFootball({ ...football, locked: true }).locked).toBe(true);
    expect(fromDeskFootball(football, { locked: true }).locked).toBe(true);
  });
});

describe("fromDeskTennis", () => {
  it("usa il lato scelto per model e market", () => {
    const d = fromDeskTennis(tennis, { winLabel: "to win" });
    expect(d.home).toBe("Sinner");
    expect(d.away).toBe("Alcaraz");
    expect(d.pick).toBe("Sinner to win");
    expect(Math.round(d.modelPct!)).toBe(58);
    expect(Math.round(d.marketPct!)).toBe(56);
    expect(d.edgePct).toBeCloseTo(2.44, 2);
    expect(d.sport).toBe("tennis");
  });

  it("senza best_selection prende il favorito del modello", () => {
    const d = fromDeskTennis({ ...tennis, best_selection: null, p1: 0.4, p2: 0.6 });
    expect(d.pick).toBe("Alcaraz");
  });
});
