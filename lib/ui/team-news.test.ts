import { describe, it, expect } from "vitest";
import { buildTeamNews } from "./team-news";

// #INFORTUNI-1001 — «fonte che non dice nulla» ≠ «fonte che dice zero assenti».
const base = { homeName: "Italia", awayName: "Francia" };

describe("buildTeamNews — Pro", () => {
  it("[] / [] non è un dato: blocco vuoto, mai una lista di assenti", () => {
    const tn = buildTeamNews({ ...base, injHome: [], injAway: [], isPremium: true });
    expect(tn).not.toBeNull();
    expect(tn!.home.items).toEqual([]);
    expect(tn!.away.items).toEqual([]);
  });
  it("null e assente danno lo stesso blocco vuoto del []", () => {
    const a = buildTeamNews({ ...base, injHome: null, injAway: null, isPremium: true });
    const b = buildTeamNews({ ...base, injHome: undefined, injAway: undefined, isPremium: true });
    expect(a).toEqual(b);
    expect(a!.home.items).toEqual([]);
  });
  it("con i nomi, la lista resta com'è (e il lato vuoto resta vuoto)", () => {
    const tn = buildTeamNews({ ...base, injHome: ["Chiesa", "Bastoni"], injAway: [], isPremium: true });
    expect(tn!.home.items).toEqual(["Chiesa", "Bastoni"]);
    expect(tn!.away.items).toEqual([]);
    expect(tn!.home.name).toBe("Italia");
  });
  it("stringhe vuote non contano come nomi", () => {
    const tn = buildTeamNews({ ...base, injHome: ["", "  "], injAway: null, isPremium: true });
    expect(tn!.home.items).toEqual([]);
  });
});

describe("buildTeamNews — non-Pro", () => {
  it("senza dato resta null: la scheda lo legge come «dietro Pro»", () => {
    expect(buildTeamNews({ ...base, injHome: [], injAway: [], isPremium: false })).toBeNull();
    expect(buildTeamNews({ ...base, injHome: null, injAway: undefined, isPremium: false })).toBeNull();
  });
  it("se un dato arriva, lo si mostra", () => {
    const tn = buildTeamNews({ ...base, injHome: [], injAway: ["Mbappé"], isPremium: false });
    expect(tn!.away.items).toEqual(["Mbappé"]);
  });
});
