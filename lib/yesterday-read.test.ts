// #HOOK-A-LITE-0928 — la selezione della «lettura di ieri» è cieca all'esito,
// prende UNA riga per sport, preferisce ieri e non inventa mai una card.
import { describe, it, expect } from "vitest";
import { pickYesterdayReads, yesterdayPickLabel, shiftUtcDay, type YesterdayCandidateRow } from "./yesterday-read";

const TODAY = "2026-09-28";

function row(over: Partial<YesterdayCandidateRow> & { id: string }): YesterdayCandidateRow {
  return {
    sport: "football", competition: "Premier League", league: "PL",
    home_team: "Arsenal", away_team: "Chelsea", market: "1X2", pick: "HOME",
    confidence_score: 64, fair_odds: 1.56, odds: 1.9, edge_percent: 3,
    explanation: "Arsenal are stronger at home.", result: "won",
    starts_at: "2026-09-27T19:00:00Z", settled_at: "2026-09-27T21:00:00Z",
    notes: JSON.stringify({ final_score: "2-1" }), verification_state: "verified",
    ...over,
  };
}

describe("pickYesterdayReads", () => {
  it("prende la confidenza più alta di ieri, anche se ha PERSO (cieca all'esito)", () => {
    const reads = pickYesterdayReads([
      row({ id: "a", confidence_score: 61, result: "won" }),
      row({ id: "b", confidence_score: 78, result: "lost", home_team: "Bayern", away_team: "Dortmund", notes: JSON.stringify({ final_score: "0-2" }) }),
    ], { today: TODAY });
    expect(reads).toHaveLength(1);
    expect(reads[0].id).toBe("b");
    expect(reads[0].result).toBe("lost");
    expect(reads[0].final_score).toBe("0-2");
    expect(reads[0].is_yesterday).toBe(true);
    expect(reads[0].day).toBe("2026-09-27");
  });

  it("una per sport, calcio prima del tennis; lo sport senza righe manca", () => {
    const reads = pickYesterdayReads([
      row({ id: "t1", sport: "tennis", competition: "ATP Tokyo", league: "ATP Tokyo", home_team: "Sinner", away_team: "Fritz", pick: "Sinner", market: "ML", confidence_score: 71 }),
      row({ id: "f1" }),
      row({ id: "f2", confidence_score: 55 }),
    ], { today: TODAY });
    expect(reads.map((r) => r.sport)).toEqual(["football", "tennis"]);
    expect(reads.find((r) => r.sport === "tennis")?.pick).toBe("Sinner");
    expect(pickYesterdayReads([row({ id: "f1" })], { today: TODAY }).map((r) => r.sport)).toEqual(["football"]);
    expect(pickYesterdayReads([], { today: TODAY })).toEqual([]);
  });

  it("se ieri è vuoto risale al giorno più recente e lo dichiara (is_yesterday=false)", () => {
    const reads = pickYesterdayReads([
      row({ id: "old", starts_at: "2026-09-25T19:00:00Z", confidence_score: 60 }),
      row({ id: "older", starts_at: "2026-09-24T19:00:00Z", confidence_score: 90 }),
    ], { today: TODAY });
    expect(reads[0].id).toBe("old");
    expect(reads[0].is_yesterday).toBe(false);
    expect(reads[0].day).toBe("2026-09-25");
  });

  it("mai oggi, mai oltre il lookback", () => {
    const reads = pickYesterdayReads([
      row({ id: "today", starts_at: "2026-09-28T10:00:00Z" }),
      row({ id: "far", starts_at: "2026-09-10T10:00:00Z" }),
    ], { today: TODAY, maxLookbackDays: 7 });
    expect(reads).toEqual([]);
  });

  it("esclude ciò che il track record esclude: senza pick, sotto floor, non verificata, pending", () => {
    const reads = pickYesterdayReads([
      row({ id: "nopick", pick: null, confidence_score: 99 }),
      row({ id: "floor", confidence_score: 99, notes: JSON.stringify({ surface: { below_floor: true } }) }),
      row({ id: "unverified", confidence_score: 99, verification_state: "unverified" }),
      row({ id: "pending", confidence_score: 99, result: "pending" }),
      row({ id: "ok", confidence_score: 60 }),
    ], { today: TODAY });
    expect(reads.map((r) => r.id)).toEqual(["ok"]);
  });

  it("void è un esito settlato e resta candidabile", () => {
    const reads = pickYesterdayReads([row({ id: "v", result: "void" })], { today: TODAY });
    expect(reads[0]?.result).toBe("void");
  });
});

describe("yesterdayPickLabel", () => {
  const labels = { winLabel: "vince", drawLabel: "Pareggio" };
  it("calcio: HOME/AWAY/DRAW → nome squadra + vince, o Pareggio", () => {
    const base = { sport: "football" as const, home: "Arsenal", away: "Chelsea" };
    expect(yesterdayPickLabel({ ...base, pick: "HOME" }, labels)).toBe("Arsenal vince");
    expect(yesterdayPickLabel({ ...base, pick: "AWAY" }, labels)).toBe("Chelsea vince");
    expect(yesterdayPickLabel({ ...base, pick: "DRAW" }, labels)).toBe("Pareggio");
  });
  it("tennis: il pick è già il nome", () => {
    expect(yesterdayPickLabel({ sport: "tennis", pick: "Sinner", home: "Sinner", away: "Fritz" }, labels)).toBe("Sinner vince");
  });
});

it("shiftUtcDay attraversa il mese", () => {
  expect(shiftUtcDay("2026-10-01", -1)).toBe("2026-09-30");
});
