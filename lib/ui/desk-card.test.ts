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

  // #RESTYLING-0921 round 2 — il bug «MODEL 0%» trovato da QA sul round 1.
  // Su una riga chiusa il server manda i due numeri dell'esito di punta e NON
  // la tripla: l'adapter deve leggere quelli, e non moltiplicare per 100 un
  // null (in JS fa 0, non null — è da lì che nasceva lo zero falso).
  it("riga chiusa: legge i due numeri dell'esito di punta e non nomina la pick", () => {
    const d = fromDeskFootball(
      {
        ...football,
        locked: true,
        p_home: null, p_draw: null, p_away: null,
        odds_home: null, odds_draw: null, odds_away: null,
        best_selection: null,
        model_prob: 0.64, market_odds: 1.92,
      },
      { winLabel: "to win" },
    );
    expect(d.pick).toBeNull();
    expect(Math.round(d.modelPct!)).toBe(64);
    expect(Math.round(d.marketPct!)).toBe(52);
    expect(d.edgePct).toBeCloseTo(11.92, 2);
  });

  it("riga chiusa senza nemmeno i due numeri: «—», non zero", () => {
    const d = fromDeskFootball({
      ...football,
      locked: true,
      p_home: null, p_draw: null, p_away: null,
      odds_home: null, odds_draw: null, odds_away: null,
      best_selection: null,
    });
    expect(d.modelPct).toBeNull();
    expect(d.marketPct).toBeNull();
    expect(d.edgePct).toBeNull();
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

  // È la board tennis che serviva `p1: null` esplicito: qui lo zero falso si
  // vedeva davvero in produzione (il football ometteva i campi → NaN → «—»).
  it("riga chiusa: numeri veri dall'esito di punta, nessun nome, nessuno zero", () => {
    const d = fromDeskTennis(
      { ...tennis, locked: true, p1: null, p2: null, odds_p1: null, odds_p2: null, best_selection: null, model_prob: 0.58, market_odds: 1.8 },
      { winLabel: "to win" },
    );
    expect(d.pick).toBeNull();
    expect(Math.round(d.modelPct!)).toBe(58);
    expect(Math.round(d.marketPct!)).toBe(56);
  });
});
