import { describe, it, expect } from "vitest";
import { footballWhyReasons, tennisWhyReasons, formCounts } from "./why-reasons";

describe("formCounts", () => {
  it("conta una striscia di risultati", () => {
    expect(formCounts("WWDLL")).toEqual({ w: 2, d: 1, l: 2 });
    expect(formCounts("wwd")).toEqual({ w: 2, d: 1, l: 0 });
  });
  it("accetta i conteggi già fatti (righe Mondiale)", () => {
    expect(formCounts({ w: 3, d: 1, l: 1 })).toEqual({ w: 3, d: 1, l: 1 });
  });
  it("una forma assente non è una forma di zero partite", () => {
    expect(formCounts(null)).toBeNull();
    expect(formCounts("")).toBeNull();
    expect(formCounts("   ")).toBeNull();
    expect(formCounts({})).toBeNull();
    expect(formCounts({ w: 0, d: 0, l: 0 })).toBeNull();
  });
});

describe("footballWhyReasons", () => {
  const base = { home: "Arsenal", away: "Chelsea", modelPct: 64, marketPct: 52 };

  it("con dati poveri resta cortissimo: nessuna riga di riempimento", () => {
    const r = footballWhyReasons(base, "en");
    expect(r).toHaveLength(1);
    expect(r[0].label).toBe("Reliability");
  });

  it("ogni riga nasce da un campo presente, e non se ne inventano", () => {
    const r = footballWhyReasons({
      ...base,
      formHome: "WWWDL", formAway: "LLDWW",
      xgHome: 1.8, xgaHome: 0.9, xgAway: 1.2, xgaAway: 1.4,
      expectedGoals: 2.7, goalsBandLow: 1.5, goalsBandHigh: 3.9,
      matchesHome: 20, matchesAway: 18,
      topScorer: { name: "Saka", pScores: 0.34 },
    }, "en");
    expect(r.map((x) => x.label)).toEqual(["Form", "xG", "Goals", "Scorer", "Reliability"]);
    expect(r[0].text).toContain("3W-1D-1L");
    expect(r[3].text).toContain("34%");
    expect(r[4].text).toContain("the market says 52%");
  });

  it("mai più di cinque righe", () => {
    const r = footballWhyReasons({
      ...base,
      formHome: "WWWDL", formAway: "LLDWW",
      xgHome: 1.8, xgaHome: 0.9, xgAway: 1.2, xgaAway: 1.4,
      expectedGoals: 2.7, matchesHome: 20, matchesAway: 18,
      topScorer: { name: "Saka", pScores: 0.9 },
    }, "en");
    expect(r.length).toBeLessThanOrEqual(5);
  });

  it("un marcatore sotto il 15% non è un argomento", () => {
    const r = footballWhyReasons({ ...base, topScorer: { name: "X", pScores: 0.1 } }, "en");
    expect(r.some((x) => x.label === "Scorer")).toBe(false);
  });

  it("senza prezzo di mercato non si dichiara un edge", () => {
    const r = footballWhyReasons({ ...base, marketPct: null }, "en");
    expect(r.at(-1)!.text).toContain("not an edge");
  });

  it("il motivo di una copertura scarsa prevale sul resto", () => {
    const r = footballWhyReasons({ ...base, matchesHome: 3, matchesAway: 4, reliability: "insufficient_data" }, "en");
    expect(r.at(-1)!.text).toContain("Few matches");
  });

  it("un campione piccolo si dichiara", () => {
    const r = footballWhyReasons({ ...base, matchesHome: 5, matchesAway: 20 }, "en");
    expect(r.at(-1)!.text).toContain("Small sample");
  });

  it("xG a metà non produce la riga", () => {
    const r = footballWhyReasons({ ...base, xgHome: 1.8, xgaHome: 0.9 }, "en");
    expect(r.some((x) => x.label === "xG")).toBe(false);
  });
});

describe("tennisWhyReasons", () => {
  const base = { p1: "Sinner", p2: "Alcaraz", modelPct: 58, marketPct: 56 };

  it("senza campi non produce nulla", () => {
    expect(tennisWhyReasons(base, "en")).toEqual([]);
  });

  it("usa Elo, campione, servizio, risposta e precedenti", () => {
    const r = tennisWhyReasons({
      ...base,
      surface: "HARD", eloP1: 2100, eloP2: 2050,
      surfaceMatchesP1: 30, surfaceMatchesP2: 25,
      serveFormP1: 0.68, serveFormP2: 0.65,
      returnFormP1: 0.41, returnFormP2: 0.39,
      h2hP1: 3, h2hP2: 5,
    }, "en");
    expect(r.map((x) => x.label)).toEqual(["Elo on hard", "Sample", "Serve", "Return", "Head to head"]);
    expect(r[0].text).toContain("Sinner ahead by 50");
  });

  it("dichiara un campione sottile sulla superficie", () => {
    const r = tennisWhyReasons({ ...base, surfaceMatchesP1: 4, surfaceMatchesP2: 30 }, "en");
    expect(r[0].text).toContain("Thin sample");
  });

  it("il riposo conta solo se squilibrato", () => {
    expect(tennisWhyReasons({ ...base, eloP1: 2100, eloP2: 2000, restDaysP1: 3, restDaysP2: 3 }, "en")
      .some((x) => x.label === "Rest")).toBe(false);
    expect(tennisWhyReasons({ ...base, eloP1: 2100, eloP2: 2000, restDaysP1: 5, restDaysP2: 1 }, "en")
      .some((x) => x.label === "Rest")).toBe(true);
  });

  it("nessun precedente, nessuna riga precedenti", () => {
    const r = tennisWhyReasons({ ...base, eloP1: 2100, eloP2: 2000, h2hP1: 0, h2hP2: 0 }, "en");
    expect(r.some((x) => x.label === "Head to head")).toBe(false);
  });
});
