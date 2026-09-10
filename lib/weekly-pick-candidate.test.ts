// #WEEKLY-PICK-FOOTBALL-0910 — quali righe diventano una GAMBA della weekly pick.
//
// Il difetto: la probabilità del calcio si leggeva SOLO dal JSON `notes`
// (p_home/p_draw/p_away), che su unified_predictions è vuoto su ogni riga di
// calcio. Misurato il 10/09 sulla settimana del 07/09: 245 righe di calcio
// pubblicate, 18 con una pick, `p_home` presente in ZERO. Il calcio non veniva
// «battuto» dal tennis — non arrivava al confronto, e 8 weekly pick su 10
// finivano al 100% tennis.
//
// Come in lib/v2-coverage.test.ts, il predicato è specchiato qui perché una
// regola che decide cosa entra in un prodotto venduto merita un test proprio.
import { describe, it, expect } from "vitest";
import { WEEKLY_PICK_MIN_LEG_PROB } from "./weekly-pick";

type Riga = {
  sport: string;
  pick: string | null;
  home_team: string | null;
  away_team: string | null;
  confidence_score: number | null;
  notes: string | null;
};

/** Specchio della derivazione di `prob` in app/api/weekly-pick/generate/route.ts. */
function probDi(r: Riga): number | null {
  let pH: number | null = null, pD: number | null = null, pA: number | null = null;
  if (r.notes) {
    try {
      const n = JSON.parse(r.notes);
      if (typeof n?.p_home === "number") {
        pH = n.p_home;
        pD = typeof n?.p_draw === "number" ? n.p_draw : null;
        pA = typeof n?.p_away === "number" ? n.p_away : null;
      }
    } catch { /* notes malformati */ }
  }
  if (!r.home_team || !r.away_team || !r.pick) return null;
  let prob = r.pick === "HOME" ? pH : r.pick === "AWAY" ? pA : r.pick === "DRAW" ? pD : null;
  if (prob == null && r.sport === "tennis" && typeof r.confidence_score === "number"
      && (r.pick === r.home_team || r.pick === r.away_team)) {
    prob = r.confidence_score / 100;
  }
  if (prob == null && r.sport === "football" && typeof r.confidence_score === "number"
      && (r.pick === "HOME" || r.pick === "AWAY")) {
    prob = r.confidence_score / 100;
  }
  if (prob == null || !Number.isFinite(prob) || prob <= 0 || prob > 1) return null;
  if (prob < WEEKLY_PICK_MIN_LEG_PROB) return null;
  return prob;
}

const calcio = (over: Partial<Riga> = {}): Riga => ({
  sport: "football", pick: "HOME", home_team: "Porto", away_team: "Casa Pia",
  confidence_score: 74, notes: null, ...over,
});

describe("il calcio entra in gara", () => {
  it("una riga di calcio con notes VUOTO diventa comunque una gamba", () => {
    // È il caso reale di 245 righe su 245: prima tornava null e veniva scartata.
    expect(probDi(calcio())).toBeCloseTo(0.74, 5);
  });

  it("funziona su HOME e su AWAY", () => {
    expect(probDi(calcio({ pick: "HOME" }))).toBeCloseTo(0.74, 5);
    expect(probDi(calcio({ pick: "AWAY" }))).toBeCloseTo(0.74, 5);
  });

  it("il JSON `notes`, quando c'è, VINCE sul ripiego", () => {
    // Il ripiego non deve mascherare la distribuzione vera: se un giorno i
    // notes verranno popolati, sono loro il dato buono.
    const r = calcio({ confidence_score: 74, notes: JSON.stringify({ p_home: 0.61, p_draw: 0.2, p_away: 0.19 }) });
    expect(probDi(r)).toBeCloseTo(0.61, 5);
  });
});

describe("i pareggi restano fuori dal ripiego", () => {
  it("un DRAW ad alta confidenza NON diventa una gamba", () => {
    // Il caso reale: 1 pick DRAW a confidenza 63 passerebbe il pavimento ed
    // entrerebbe come «favorito». Ma i DRAW pubblicati hanno fatto 3 vinte su
    // 14 decise (21%): su un pareggio quella confidenza non è una probabilità.
    expect(probDi(calcio({ pick: "DRAW", confidence_score: 63 }))).toBeNull();
  });

  it("ma un DRAW con una distribuzione VERA nei notes si grada", () => {
    const r = calcio({
      pick: "DRAW", confidence_score: 63,
      notes: JSON.stringify({ p_home: 0.3, p_draw: 0.58, p_away: 0.12 }),
    });
    expect(probDi(r)).toBeCloseTo(0.58, 5);
  });
});

describe("il tennis continua a funzionare come prima", () => {
  it("pick col nome del giocatore + confidence", () => {
    const r: Riga = {
      sport: "tennis", pick: "Alexander Zverev", home_team: "Alexander Zverev",
      away_team: "Karen Khachanov", confidence_score: 82, notes: null,
    };
    expect(probDi(r)).toBeCloseTo(0.82, 5);
  });
});

describe("il pavimento tiene fuori le gambe deboli", () => {
  it("sotto la soglia non entra, in nessuno sport", () => {
    expect(probDi(calcio({ confidence_score: 40 }))).toBeNull();
    expect(probDi({
      sport: "tennis", pick: "A", home_team: "A", away_team: "B",
      confidence_score: 45, notes: null,
    })).toBeNull();
  });

  it("esattamente sulla soglia entra", () => {
    expect(probDi(calcio({ confidence_score: WEEKLY_PICK_MIN_LEG_PROB * 100 })))
      .toBeCloseTo(WEEKLY_PICK_MIN_LEG_PROB, 5);
  });

  it("una riga senza pick o senza squadre non entra mai", () => {
    expect(probDi(calcio({ pick: null }))).toBeNull();
    expect(probDi(calcio({ home_team: null }))).toBeNull();
    expect(probDi(calcio({ confidence_score: null }))).toBeNull();
  });
});
