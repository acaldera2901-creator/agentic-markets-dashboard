import { describe, it, expect } from "vitest";
import { computeTeamForms, computeCrossCompetitionForms } from "@/lib/pi-rating";
import type { MatchResult } from "@/lib/poisson-model";

const m = (homeTeam: string, homeGoals: number, awayGoals: number, awayTeam: string): MatchResult => ({
  homeTeam,
  awayTeam,
  homeGoals,
  awayGoals,
});

// Real Ligue 1 results from football-data.org (FL1, FINISHED), oldest first —
// the order fetchHistory returns them in. Snapshot taken 2026-10-26.
const PSG = "Paris Saint-Germain FC";
const OL = "Olympique Lyonnais";
const FL1: MatchResult[] = [
  m("Toulouse FC", 0, 2, OL),
  m("Stade Rennais FC 1901", 2, 2, PSG),
  m("Lille OSC", 2, 2, PSG),
  m(OL, 1, 1, "Le Havre AC"),
  m(PSG, 1, 2, "AS Monaco FC"),
  m(OL, 3, 1, "AJ Auxerre"),
  m("Paris FC", 0, 0, OL),
  m("Stade Brestois 29", 0, 1, PSG),
  m(OL, 4, 0, "Stade Rennais FC 1901"),
  m("Olympique de Marseille", 1, 2, PSG),
  m("Racing Club de Lens", 2, 1, OL),
  m(PSG, 3, 1, "Le Mans FC"),
  m("RC Strasbourg Alsace", 1, 3, PSG),
  m(OL, 2, 1, "OGC Nice"),
];

describe("computeTeamForms", () => {
  // #FORMA-RECENTE-1026 — the badges are labelled "Recent form (last 5)", but
  // the site showed PSG's last 5 HOME games (W D W L W) and Lyon's last 5 AWAY
  // games (W L W D L). The real last 5 are L W W W W and W D W L W.
  it("returns the last 5 matches overall, home and away together, oldest first", () => {
    const forms = computeTeamForms(FL1);
    expect(forms[PSG].form).toBe("LWWWW");
    expect(forms[OL].form).toBe("WDWLW");
  });

  it("scores each match from the team's own side", () => {
    const forms = computeTeamForms([m("A", 2, 0, "B"), m("B", 1, 1, "A"), m("B", 3, 1, "A")]);
    expect(forms.A.form).toBe("WDL");
    expect(forms.B.form).toBe("LDW");
  });
});

// #FORMA-TUTTE-1026 — Andrea: the form badge counts every competition we have,
// not only the one the fixture belongs to. Real football-data.org results for
// PSG, 2026-09-04 → 2026-10-20 (FL1 + CL), checked against /teams/524/matches.
describe("computeCrossCompetitionForms", () => {
  const dated = (utcDate: string, homeTeam: string, homeGoals: number, awayGoals: number, awayTeam: string) => ({
    utcDate, homeTeam, awayTeam, homeGoals, awayGoals,
  });
  const PSG_FL1 = [
    dated("2026-09-04T19:00:00Z", PSG, 1, 2, "AS Monaco FC"),
    dated("2026-09-13T19:00:00Z", "Stade Brestois 29", 0, 1, PSG),
    dated("2026-09-20T19:00:00Z", "Olympique de Marseille", 1, 2, PSG),
    dated("2026-10-10T19:00:00Z", PSG, 3, 1, "Le Mans FC"),
    dated("2026-10-17T19:00:00Z", "RC Strasbourg Alsace", 1, 3, PSG),
  ];
  const PSG_CL = [
    dated("2026-09-09T19:00:00Z", PSG, 6, 1, "ŠK Slovan Bratislava"),
    dated("2026-10-14T19:00:00Z", "Manchester City FC", 2, 4, PSG),
    dated("2026-10-20T19:00:00Z", PSG, 4, 2, "FC Barcelona"),
  ];

  it("merges competitions in kickoff order: PSG is WWWWW overall, LWWWW in Ligue 1 only", () => {
    expect(computeTeamForms(PSG_FL1)[PSG].form).toBe("LWWWW");
    // Competitions arrive one block after the other (FL1 then CL), never interleaved.
    expect(computeCrossCompetitionForms([PSG_FL1, PSG_CL])[PSG].form).toBe("WWWWW");
  });

  it("does not depend on the order the competition blocks arrive in", () => {
    const a = computeCrossCompetitionForms([PSG_FL1, PSG_CL]);
    const b = computeCrossCompetitionForms([PSG_CL, PSG_FL1]);
    expect(b[PSG].form).toBe(a[PSG].form);
  });

  it("a team seen only in one competition keeps that competition's form", () => {
    expect(computeCrossCompetitionForms([PSG_FL1, PSG_CL])["FC Barcelona"].form).toBe("L");
  });

  it("drops rows without a parseable kickoff instead of guessing their place", () => {
    const forms = computeCrossCompetitionForms([[...PSG_CL, dated("", PSG, 0, 5, "X")]]);
    expect(forms[PSG].form).toBe("WWW");
  });
});
