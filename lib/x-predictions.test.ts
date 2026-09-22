// lib/x-predictions.test.ts — #X-PIPELINE-0810
//
// Le righe di questo file sono le righe VERE servite il 2026-08-10, copiate dal
// dry run. Ognuna produceva un numero sbagliato con la mappatura ingenua
// pick→favorito: sono la regressione, non un esempio inventato.

import { describe, it, expect } from "vitest";
import { mapRow, mapRows, type UnifiedRowForX } from "./x-predictions";

function row(over: Partial<UnifiedRowForX> = {}): UnifiedRowForX {
  return {
    id: 1,
    sport: "football",
    competition: "Allsvenskan",
    home_team: "IK Sirius",
    away_team: "IF Brommapojkarna",
    player_one: null,
    player_two: null,
    market: "1X2",
    pick: "AWAY",
    confidence_score: 12,
    odds: 10,
    starts_at: "2026-08-10T17:00:00Z",
    notes: null,
    ...over,
  };
}

describe("il complemento non è valido in un mercato a tre vie", () => {
  it("un pick AWAY al 12% in 1X2 NON diventa home all'88%", () => {
    // Il difetto: in 1X2 il pareggio assorbe il resto, quindi p(away)=12% non dice
    // nulla su p(home). "IK Sirius 88%" era un numero inventato.
    const r = mapRow(row());
    expect(r).toEqual({ drop: "three_way_pick_below_50" });
  });

  it("in un mercato a due vie il complemento è corretto e il favorito si ribalta", () => {
    const r = mapRow(
      row({ sport: "tennis", market: "ML", home_team: null, away_team: null, player_one: "Eala", player_two: "Bencic", pick: "Bencic", confidence_score: 42, odds: 2.3 })
    );
    expect("prediction" in r).toBe(true);
    if (!("prediction" in r)) return;
    expect(r.prediction.favorite).toBe("Eala");
    expect(r.prediction.modelPct).toBe(58);
    // La quota descriveva Bencic: nessuna àncora di mercato onesta per Eala.
    expect(r.prediction.marketPct).toBeNull();
    expect(r.prediction.edgePct).toBeNull();
  });

  it("un pick 1X2 sopra il 50% è il più probabile per costruzione ed è pubblicabile", () => {
    const r = mapRow(row({ pick: "HOME", confidence_score: 61, odds: 1.7 }));
    expect("prediction" in r).toBe(true);
    if (!("prediction" in r)) return;
    expect(r.prediction.favorite).toBe("IK Sirius");
    expect(r.prediction.modelPct).toBe(61);
    expect(r.prediction.marketPct).toBeCloseTo(58.82, 2);
    expect(r.prediction.edgePct).toBeCloseTo(2.18, 2);
  });

  it("un pareggio sotto il 50% non si ribalta mai", () => {
    expect(mapRow(row({ pick: "DRAW", confidence_score: 30 }))).toEqual({
      drop: "three_way_pick_below_50",
    });
  });
});

describe("con pick NULL non si indovina il lato", () => {
  it("53% senza pick viene scartata, non attribuita al padrone di casa", () => {
    // Riga vera: Alexandra Eala v Belinda Bencic, pick=null, conf=53, odds=1.8.
    // La mappatura ingenua pubblicava "Alexandra Eala 53%": una scelta a caso fra
    // due giocatrici.
    const r = mapRow(
      row({ sport: "tennis", market: "ML", home_team: null, away_team: null, player_one: "Alexandra Eala", player_two: "Belinda Bencic", pick: null, confidence_score: 53, odds: 1.8 })
    );
    expect(r).toEqual({ drop: "no_pick_side" });
  });

  it("senza confidence_score non c'è niente da pubblicare", () => {
    expect(mapRow(row({ confidence_score: null, pick: "HOME" }))).toEqual({ drop: "no_confidence" });
  });

  it("senza nomi non c'è partita", () => {
    expect(mapRow(row({ home_team: null, away_team: null }))).toEqual({ drop: "no_team_names" });
  });

  it("un kickoff non valido viene scartato prima di diventare una data Invalid", () => {
    expect(mapRow(row({ starts_at: "domani" }))).toEqual({ drop: "no_kickoff" });
  });
});

describe("lo split 1/X/2 in notes batte il pick", () => {
  it("il favorito è l'argmax dello split, non il pick", () => {
    const r = mapRow(
      row({
        pick: "AWAY",
        confidence_score: 12,
        notes: JSON.stringify({ p_home: 0.58, p_draw: 0.25, p_away: 0.17 }),
      })
    );
    expect("prediction" in r).toBe(true);
    if (!("prediction" in r)) return;
    expect(r.prediction.favorite).toBe("IK Sirius");
    expect(r.prediction.modelPct).toBeCloseTo(58, 6);
    // La quota è del pick (AWAY), che NON è il favorito: nessuna àncora.
    expect(r.prediction.marketPct).toBeNull();
  });

  it("quando pick e favorito coincidono l'àncora di mercato resta", () => {
    const r = mapRow(
      row({ pick: "HOME", odds: 1.8, notes: JSON.stringify({ p_home: 0.6, p_draw: 0.2, p_away: 0.2 }) })
    );
    if (!("prediction" in r)) throw new Error("attesa una predizione");
    expect(r.prediction.marketPct).toBeCloseTo(55.56, 2);
    expect(r.prediction.edgePct).toBeCloseTo(4.44, 2);
  });

  it("uno split incompleto non viene usato a metà", () => {
    // Solo p_home: cadere nel ramo argmax con un away null sarebbe un confronto
    // contro undefined. Si torna al pick.
    const r = mapRow(row({ pick: "HOME", confidence_score: 62, notes: JSON.stringify({ p_home: 0.62 }) }));
    if (!("prediction" in r)) throw new Error("attesa una predizione");
    expect(r.prediction.modelPct).toBe(62);
  });

  it("notes che non è JSON non fa esplodere niente", () => {
    const r = mapRow(row({ pick: "HOME", confidence_score: 62, notes: "nota scritta a mano" }));
    expect("prediction" in r).toBe(true);
  });
});

describe("mapRows — il funnel", () => {
  it("deduplica la stessa partita scritta da due pipeline", () => {
    const rows = [
      row({ id: 1, pick: "HOME", confidence_score: 88 }),
      row({ id: 2, pick: "HOME", confidence_score: 87 }),
    ];
    const report = mapRows(rows);
    expect(report.predictions).toHaveLength(1);
    expect(report.predictions[0].modelPct).toBe(88); // la prima vince
    expect(report.dropped.duplicate_fixture).toBe(1);
  });

  it("non deduplica due partite diverse alla stessa ora", () => {
    const rows = [
      row({ id: 1, pick: "HOME", confidence_score: 60 }),
      row({ id: 2, home_team: "Västerås SK", away_team: "Djurgården", pick: "HOME", confidence_score: 55 }),
    ];
    expect(mapRows(rows).predictions).toHaveLength(2);
  });

  it("conta ogni scarto invece di perderlo in silenzio", () => {
    const report = mapRows([
      row({ id: 1 }), // three_way_pick_below_50
      row({ id: 2, pick: null, confidence_score: 53 }), // no_pick_side
      row({ id: 3, confidence_score: null, pick: "HOME" }), // no_confidence
      row({ id: 4, pick: "HOME", confidence_score: 70 }), // ok
    ]);
    expect(report.rowsIn).toBe(4);
    expect(report.predictions).toHaveLength(1);
    expect(report.dropped.three_way_pick_below_50).toBe(1);
    expect(report.dropped.no_pick_side).toBe(1);
    expect(report.dropped.no_confidence).toBe(1);
    // Il totale torna: nessuna riga sparisce senza essere contata.
    const totalDropped = Object.values(report.dropped).reduce((a, b) => a + b, 0);
    expect(report.predictions.length + totalDropped).toBe(report.rowsIn);
  });

  it("la giornata vera del 2026-08-10 non produce nemmeno un favorito pubblicabile", () => {
    // Le otto righe servite quel giorno, copiate dal dry run: notes vuoto su
    // tutte, pick null su cinque, e le tre col pick sono 1X2 sotto il 50%.
    const real: UnifiedRowForX[] = [
      row({ id: 1, sport: "tennis", market: "ML", home_team: null, away_team: null, player_one: "Alexandra Eala", player_two: "Belinda Bencic", pick: null, confidence_score: 53, odds: 1.8 }),
      row({ id: 2, home_team: "Västerås SK", away_team: "Djurgardens IF", pick: null, confidence_score: 22, odds: 4.8 }),
      row({ id: 3, pick: "AWAY", confidence_score: 12, odds: 10 }),
      row({ id: 4, pick: "AWAY", confidence_score: 13, odds: 9.6 }),
      row({ id: 5, home_team: "Västerås SK", away_team: "Djurgården", pick: null, confidence_score: 22, odds: 4.9 }),
      row({ id: 6, sport: "tennis", market: "ML", home_team: null, away_team: null, player_one: "Arthur Fils", player_two: "Rafael Jodar", pick: null, confidence_score: 51, odds: 2.13 }),
      row({ id: 7, sport: "tennis", market: "ML", home_team: null, away_team: null, player_one: "Diana Shnaider", player_two: "Iga Swiatek", pick: "Iga Swiatek", confidence_score: 76, odds: 1.34 }),
      row({ id: 8, sport: "tennis", market: "ML", home_team: null, away_team: null, player_one: "Brandon Nakashima", player_two: "Luciano Darderi", pick: null, confidence_score: 72, odds: null }),
    ];
    const report = mapRows(real);
    // Una sola riga porta abbastanza informazione: Swiatek, col pick esplicito.
    expect(report.predictions.map((p) => p.favorite)).toEqual(["Iga Swiatek"]);
    expect(report.dropped.no_pick_side).toBe(5);
    expect(report.dropped.three_way_pick_below_50).toBe(2);
  });
});
