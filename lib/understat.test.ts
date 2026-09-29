// #XG-PARSER-0930 — audit agentic_codex 29/09. Il payload qui sotto ha la forma
// VERA di `getLeagueData/EPL/2026` scaricato il 30/09 (h_a "h"/"a", numeri come
// number, ppda {att,def}); i valori sono ridotti a due partite per squadra.
import { describe, it, expect } from "vitest";
import { extractTeamsFromHtml, leagueXGAverages, parseUnderstatTeams } from "./understat";

const row = (h_a: "h" | "a", xG: number, xGA: number, result: string) => ({
  h_a, xG, xGA, npxG: xG, npxGA: xGA, ppda: { att: 300, def: 20 }, xpts: 1.2, result,
  date: "2026-08-23 13:00:00",
});

function teams(n: number) {
  const out: Record<string, { id: string; title: string; history: Record<string, unknown>[] }> = {};
  for (let i = 0; i < n; i++) {
    out[String(i)] = { id: String(i), title: `Team ${i}`, history: [row("h", 1.6, 0.9, "w"), row("a", 1.1, 1.4, "l")] };
  }
  return out;
}

describe("parser Understat", () => {
  it("h_a divide casa e trasferta (prima il filtro su isHome restava vuoto)", () => {
    const xg = parseUnderstatTeams(teams(8));
    expect(xg["Team 0"].xg_home).toBe(1.6);
    expect(xg["Team 0"].xg_away).toBe(1.1);
    expect(xg["Team 0"].xga_home).toBe(0.9);
    expect(xg["Team 0"].ppda).toBe(15);
    expect(xg["Team 0"].form).toBe("WL");
  });

  it("con cifre casa/trasferta vere la baseline di lega esiste", () => {
    const base = leagueXGAverages(parseUnderstatTeams(teams(8)))!;
    expect(base.home).toBeCloseTo(1.6, 6);
    expect(base.away).toBeCloseTo(1.1, 6);
  });

  it("il vecchio formato con isHome stringa resta leggibile", () => {
    const t = teams(1);
    t["0"].history = [{ isHome: "1", xG: "2.0", xGA: "0.5" }, { isHome: "0", xG: "0.8", xGA: "1.0" }];
    const xg = parseUnderstatTeams(t);
    expect(xg["Team 0"].xg_home).toBe(2);
    expect(xg["Team 0"].xg_away).toBe(0.8);
  });

  it("la pagina di oggi non incorpora piu' teamsData: dall'HTML non esce niente", () => {
    expect(extractTeamsFromHtml("<html><script>var THEME = 'DARK';</script></html>")).toBeNull();
  });
});
