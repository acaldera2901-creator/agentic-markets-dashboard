// lib/classic/tennis-estimate.test.ts — #CLASSIC-CARD-1008: portato da betredge/v3c-fixq (0909e2eb),
// senza il caso di buildTennisBoardMatch (servizio v3c non portato).
// tennis2 — the tennis Market → Estimate → Gap (redesign/proposals/tennis-estimate.md).
// Fixtures only: no network, no DB. Player names are real (lengths/accents), numbers invented.
import { describe, expect, it } from "vitest";
import {
  TENNIS_ELO_WEIGHT,
  dedupeTennisRows,
  splitTennisCategories,
  isMainTourElo,
  tennisCategory,
  tennisEstimate,
  tennisEstimateOf,
  type TennisEstimateInput,
} from "./tennis-estimate";

const NOW = new Date("2026-10-07T13:00:00Z");
const ELO = "elo_surface_v4_features_odds";
const PARTNER = "partner-market-v1";

function inp(over: Partial<TennisEstimateInput> = {}): TennisEstimateInput {
  return {
    tournament: "Rolex Shanghai Masters",
    partner_tournament: null,
    player1: "Jan-Lennard Struff",
    player2: "Martin Landaluce",
    model_version: ELO,
    market_p1: 0.4845,
    market_p2: 0.5155,
    elo_p1: 0.672,
    elo_p2: 0.328,
    elo_as_of: "2026-10-07T11:30:00Z",
    elo_home: "Jan-Lennard Struff",
    ...over,
  };
}

type TennisBoardSourceRow = Record<string, unknown> & { id: string; kickoff: string; player1: string; player2: string; model_version: string; tournament: string | null; partner_tournament?: string | null };
function src(over: Partial<TennisBoardSourceRow> = {}): TennisBoardSourceRow {
  return {
    id: "tennis:espn:184841:jan-lennard-struff:martin-landaluce",
    tournament: "Rolex Shanghai Masters",
    kickoff: "2026-10-08T07:00:00Z",
    player1: "Jan-Lennard Struff",
    player2: "Martin Landaluce",
    p1: 0.48,
    p2: 0.52,
    odds_p1: 2.0,
    odds_p2: 1.88,
    edge: null,
    model_version: ELO,
    computed_at: "2026-10-07T11:30:00Z",
    odds_bookmaker: null,
    surfaced_pick: null,
    model_p1: 0.672,
    model_p2: 0.328,
    model_as_of: "2026-10-07T11:30:00Z",
    sealed_at: null,
    sealed_p1: null,
    sealed_p2: null,
    sealed_odds: null,
    sealed_signal_type: null,
    partner_tournament: null,
    elo_p1: 0.672,
    elo_p2: 0.328,
    elo_as_of: "2026-10-07T11:30:00Z",
    elo_home: "Jan-Lennard Struff",
    ...over,
  };
}

describe("tennis estimate — 0.1·Elo + 0.9·market, else market only", () => {
  it("blends 10/90 with a fresh Elo on the main tour, untempered", () => {
    const e = tennisEstimate(inp(), NOW);
    expect(TENNIS_ELO_WEIGHT).toBe(0.1);
    expect(e.estimate_kind).toBe("elo_blend_unsealed");
    expect(e.estimate_p!.p1).toBeCloseTo(0.1 * 0.672 + 0.9 * 0.4845, 4);
    expect(e.estimate_p!.p1 + e.estimate_p!.p2).toBeCloseTo(1, 3);
    // gap = estimate − market = 0.1·(Elo − market), in pp
    expect(e.gap_pp!.p1).toBeCloseTo(10 * (0.672 - 0.4845), 1);
    expect(e.gap_pp!.p2).toBeCloseTo(-e.gap_pp!.p1, 2);
    expect(e.gap_visible).toBe(true);
    expect(e.elo_age_min).toBe(90);
    expect(e.elo_p_raw).toEqual({ p1: 0.672, p2: 0.328 });
  });

  it("Elo older than 6 h → market only, no estimate, no gap", () => {
    const e = tennisEstimate(inp({ elo_as_of: "2026-10-07T06:59:00Z" }), NOW);
    expect(e.estimate_kind).toBe("market_only");
    expect(e.estimate_p).toBeNull();
    expect(e.gap_pp).toBeNull();
    expect(e.gap_visible).toBe(false);
    expect(e.elo_age_min).toBe(361);
    // exactly 6 h is still fresh
    expect(tennisEstimate(inp({ elo_as_of: "2026-10-07T07:00:00Z" }), NOW).estimate_kind).toBe("elo_blend_unsealed");
  });

  it("no Elo snapshot, no market, or the partner feed → market only", () => {
    expect(tennisEstimate(inp({ elo_p1: null, elo_p2: null, elo_as_of: null }), NOW).estimate_kind).toBe("market_only");
    expect(tennisEstimate(inp({ market_p1: null, market_p2: null }), NOW).estimate_kind).toBe("market_only");
    expect(tennisEstimate(inp({ model_version: PARTNER }), NOW).estimate_kind).toBe("market_only");
  });

  it("Challenger, ITF, WTT, UTR, 125, doubles and padel are not covered", () => {
    for (const t of ["ATP Challenger Braga - Clay", "ITF M25 Monastir", "WTT Women - Lexington - Hard", "UTR Pro Series San Diego", "WTA 125 Suzhou", "WTA Samsun - Hard (Doubles)", "Padel Tour Dusseldorf"]) {
      expect(isMainTourElo({ ...inp(), tournament: t }), t).toBe(false);
      expect(tennisEstimate(inp({ tournament: t }), NOW).estimate_kind, t).toBe("market_only");
    }
    expect(isMainTourElo(inp())).toBe(true);
    expect(isMainTourElo(inp({ tournament: "China Open" }))).toBe(true);
  });

  it("gap hidden when |Elo − market| > 25 pp, estimate kept", () => {
    const e = tennisEstimate(inp({ elo_p1: 0.8, elo_p2: 0.2, market_p1: 0.5, market_p2: 0.5 }), NOW);
    expect(e.estimate_kind).toBe("elo_blend_unsealed");
    expect(e.gap_visible).toBe(false);
    expect(tennisEstimateOf(e, "p1")).toEqual({ kind: "elo_blend_unsealed", estimate: e.estimate_p!.p1, gap: null });
    // 25 pp exactly stays visible
    expect(tennisEstimate(inp({ elo_p1: 0.75, elo_p2: 0.25, market_p1: 0.5, market_p2: 0.5 }), NOW).gap_visible).toBe(true);
  });

  it("orients a snapshot stored the other way round; refuses another pairing", () => {
    const flipped = tennisEstimate(inp({ elo_home: "Martin Landaluce", elo_p1: 0.328, elo_p2: 0.672 }), NOW);
    expect(flipped.elo_p_raw).toEqual({ p1: 0.672, p2: 0.328 });
    expect(tennisEstimate(inp({ elo_home: "Holger Rune" }), NOW).estimate_kind).toBe("market_only");
  });

  it("never applies the temperature: the estimate stays between market and Elo", () => {
    const e = tennisEstimate(inp({ market_p1: 0.85, market_p2: 0.15, elo_p1: 0.9, elo_p2: 0.1 }), NOW);
    expect(e.estimate_p!.p1).toBeCloseTo(0.855, 4);
  });

});

describe("tennis board — categories and duplicates", () => {
  it("recognises padel and doubles from the partner tournament or the «/» pairs", () => {
    const base = { tournament: "Partner feed", player1: "A B", player2: "C D" };
    expect(tennisCategory({ ...base, partner_tournament: "Padel Tour Dusseldorf - Women", player1: "Jana Montes/Marta Barrera", player2: "Ariadna Canellas/Patricia Martinez" })).toBe("padel");
    expect(tennisCategory({ ...base, partner_tournament: "WTA Samsun - Hard (Doubles)" })).toBe("doubles");
    expect(tennisCategory({ ...base, partner_tournament: null, player1: "Rutuja Bhosale/Elena Micic", player2: "Weronika Falkowska/Alana Smith" })).toBe("doubles");
    expect(tennisCategory({ ...base, partner_tournament: "ATP Masters Shanghai - Hard" })).toBe("singles");
    const { singles, removed } = splitTennisCategories([
      src(),
      src({ id: "p1", model_version: PARTNER, partner_tournament: "Padel Tour Dusseldorf", player1: "Federico Chingotto/Alejandro Galan", player2: "Javier Garrido/Juan Ignacio De Pascual" }),
      src({ id: "d1", model_version: PARTNER, partner_tournament: "ATP Challenger Antofagasta - Clay (Doubles)", player1: "X Y/Z W", player2: "K L/M N" }),
    ]);
    expect(singles.map((s) => s.id)).toEqual([src().id]);
    expect(removed).toEqual({ padel: 1, doubles: 1 });
  });

  it("dedupes partner + Elo rows of the same match: Elo kept with an estimate, partner kept without", () => {
    const elo = src();
    const twin = src({ id: "tennis:partner:2026-10-08_jan lennard struff|martin landaluce", model_version: PARTNER, kickoff: "2026-10-08T02:00:00Z", elo_p1: null, elo_p2: null });
    const other = src({ id: "tennis:partner:2026-10-08_hubert hurkacz|james duckworth", model_version: PARTNER, player1: "Hubert Hurkacz", player2: "James Duckworth" });
    const withEst = dedupeTennisRows([elo, twin, other], () => true);
    expect(withEst.kept.map((r) => r.id)).toEqual([elo.id, other.id]);
    expect(withEst.dropped.get(twin.id)).toBe(elo.id);
    const noEst = dedupeTennisRows([elo, twin, other], () => false);
    expect(noEst.kept.map((r) => r.id)).toEqual([twin.id, other.id]);
    expect(noEst.dropped.get(elo.id)).toBe(twin.id);
  });

  it("matches a spelling variant (surname + initial) but not a different day or a different player", () => {
    const elo = src({ id: "e", player1: "Darya Khamutsianskaya", player2: "Katarina Zavatska" });
    const twin = src({ id: "p", model_version: PARTNER, player1: "Katarina Zavatska", player2: "Daria Khamutsianskaya", kickoff: "2026-10-08T02:00:00Z" });
    expect(dedupeTennisRows([elo, twin], () => false).kept.map((r) => r.id)).toEqual(["p"]);
    const farAway = src({ id: "p2", model_version: PARTNER, kickoff: "2026-10-11T07:00:00Z" });
    expect(dedupeTennisRows([src(), farAway], () => true).kept).toHaveLength(2);
    const otherPlayer = src({ id: "p3", model_version: PARTNER, player2: "Mariano Navone" });
    expect(dedupeTennisRows([src(), otherPlayer], () => true).kept).toHaveLength(2);
    // two partner rows are never merged with each other
    expect(dedupeTennisRows([twin, { ...twin, id: "p4" }], () => true).kept).toHaveLength(2);
  });
});
