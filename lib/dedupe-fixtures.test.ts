import { describe, it, expect } from "vitest";
import { dedupeByFixture } from "./dedupe-fixtures";

// #DUP-FIXTURES-0821 — la stessa partita arriva da due fonti con due match_id
// diversi (espn:… e oddsapi:…) e finiva DUE VOLTE in board, con due edge
// diversi. La deduplica che c'era usava match_id, cioè la chiave che per
// costruzione non collide mai fra fonti.
const base = {
  league: "ALL",
  home_team: "IK Sirius",
  away_team: "BK Häcken",
  kickoff: "2026-08-21T17:00:00+00:00",
};

describe("dedupeByFixture", () => {
  it("collassa la stessa partita servita da due fonti, tenendo la piu' fresca", () => {
    const rows = [
      { ...base, match_id: "oddsapi:31bd07", computed_at: "2026-08-20T14:01:45Z", edge: 0.0207 },
      { ...base, match_id: "espn:401873989", computed_at: "2026-08-21T12:01:54Z", edge: 0.004 },
    ];
    const out = dedupeByFixture(rows);
    expect(out).toHaveLength(1);
    expect(out[0].match_id).toBe("espn:401873989"); // la piu' recente vince
  });

  it("collassa anche quando i nomi differiscono solo per gli accenti", () => {
    const rows = [
      { ...base, away_team: "BK Häcken", match_id: "espn:1", computed_at: "2026-08-21T12:00:00Z" },
      { ...base, away_team: "BK Hacken", match_id: "oddsapi:2", computed_at: "2026-08-20T12:00:00Z" },
    ];
    expect(dedupeByFixture(rows)).toHaveLength(1);
  });

  // Caso reale trovato in produzione il 2026-08-21: la chiave che aggancia le
  // quote (normName) piega gli accenti ma NON la punteggiatura, quindi
  // "Saint-Étienne" e "Saint Etienne" restavano due partite.
  it("collassa quando i nomi differiscono per trattino E accento", () => {
    const rows = [
      { league: "FL2", home_team: "Saint-Étienne", away_team: "Grenoble", kickoff: "2026-08-22T18:00:00+00:00", match_id: "espn:401876774", computed_at: "2026-08-21T12:00:00Z" },
      { league: "FL2", home_team: "Saint Etienne", away_team: "Grenoble", kickoff: "2026-08-22T18:00:00+00:00", match_id: "oddsapi:738c1a", computed_at: "2026-08-20T12:00:00Z" },
    ];
    const out = dedupeByFixture(rows);
    expect(out).toHaveLength(1);
    expect(out[0].match_id).toBe("espn:401876774");
  });

  it("non collassa partite diverse", () => {
    const rows = [
      { ...base, match_id: "espn:1", computed_at: "2026-08-21T12:00:00Z" },
      { ...base, home_team: "Sochaux", away_team: "Guingamp", match_id: "espn:2", computed_at: "2026-08-21T12:00:00Z" },
    ];
    expect(dedupeByFixture(rows)).toHaveLength(2);
  });

  it("non collassa lo stesso incontro in giorni diversi", () => {
    const rows = [
      { ...base, match_id: "espn:1", computed_at: "2026-08-21T12:00:00Z" },
      { ...base, kickoff: "2026-09-05T17:00:00+00:00", match_id: "espn:2", computed_at: "2026-08-21T12:00:00Z" },
    ];
    expect(dedupeByFixture(rows)).toHaveLength(2);
  });

  it("FAIL-OPEN: se la chiave non si puo' calcolare, la riga NON si butta", () => {
    // kickoff assente → identita' sconosciuta. Meglio un doppione che una
    // partita che sparisce dal board.
    const rows = [
      { ...base, kickoff: "", match_id: "espn:1", computed_at: "2026-08-21T12:00:00Z" },
      { ...base, kickoff: "", match_id: "oddsapi:2", computed_at: "2026-08-20T12:00:00Z" },
    ];
    expect(dedupeByFixture(rows)).toHaveLength(2);
  });

  it("a parita' di freschezza tiene la prima, in modo stabile", () => {
    const rows = [
      { ...base, match_id: "espn:1", computed_at: "2026-08-21T12:00:00Z" },
      { ...base, match_id: "oddsapi:2", computed_at: "2026-08-21T12:00:00Z" },
    ];
    const out = dedupeByFixture(rows);
    expect(out).toHaveLength(1);
    expect(out[0].match_id).toBe("espn:1");
  });

  it("conserva l'ordine delle righe sopravvissute", () => {
    const rows = [
      { ...base, home_team: "A", away_team: "B", match_id: "1", computed_at: "2026-08-21T12:00:00Z" },
      { ...base, home_team: "C", away_team: "D", match_id: "2", computed_at: "2026-08-21T12:00:00Z" },
      { ...base, home_team: "A", away_team: "B", match_id: "3", computed_at: "2026-08-20T12:00:00Z" },
    ];
    expect(dedupeByFixture(rows).map((r) => r.match_id)).toEqual(["1", "2"]);
  });
});
