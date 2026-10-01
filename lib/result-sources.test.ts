// #GATE-1001 — nothing is published or sealed without a declared result source.
import { describe, it, expect } from "vitest";
import { gateCandidate, recordVerdict, emptySyncReport } from "./publication-gate";
import { resultSourceFor, RESULT_SOURCE_DEBT, RESULT_SOURCES, type ResultSourceTable } from "./result-sources";
import { ESPN_SLUG_BY_FD_LEAGUE, espnSlugForLeague } from "./espn-results";
import { ESPN_SLUGS, ODDS_SPORT_KEYS, SUMMER_LEAGUES } from "./summer-leagues";

const NOW = new Date("2026-10-01T12:00:00Z");
const FUTURE = "2026-10-02T18:00:00Z";
const ctx = { worldCupSignalReady: false, now: NOW };
const base = { startsAt: FUTURE, pick: "HOME", odds: 2.1, edge: 0.03, isWorldCup: false };

const conDebito: ResultSourceTable = {
  sources: { football: { PL: ["football-data"] } },
  debt: { owner: "Andrea", due: "2026-10-08", leagues: ["football:XYZ"] },
};

describe("resultSourceFor", () => {
  it("lega con fonte → la fonte", () => expect(resultSourceFor("football", "PL")).toBe("football-data,espn"));
  it("lega nuova senza fonte → null", () => expect(resultSourceFor("football", "JPN")).toBeNull());
  it("sport nuovo senza fonte → null", () => expect(resultSourceFor("baseball", "MLB")).toBeNull());
  it("lega nel debito dichiarato → debito", () =>
    expect(resultSourceFor("football", "XYZ", conDebito)).toBe(RESULT_SOURCE_DEBT));
  it("tennis partner (ITF/Challenger) → ha la fonte del feed", () =>
    expect(resultSourceFor("tennis", "Partner feed")).toBe("espn-tennis,betconstruct"));
  it("tennis ESPN, qualunque torneo → fonte", () =>
    expect(resultSourceFor("tennis", "Delta Motors Tolentino Open")).toContain("espn-tennis"));
});

describe("gateCandidate + resultSource", () => {
  it("lega nuova senza fonte → rifiutata no_result_source (non paper)", () => {
    const v = gateCandidate({ ...base, resultSource: resultSourceFor("football", "JPN") }, ctx);
    expect(v).toEqual({ publish: false, reason: "no_result_source" });
  });
  it("senza fonte anche senza quote → rifiutata, non degradata a paper", () => {
    const v = gateCandidate({ ...base, odds: null, resultSource: null }, ctx);
    expect(v.publish).toBe(false);
  });
  it("lega con fonte → passa come prima", () => {
    const v = gateCandidate({ ...base, resultSource: resultSourceFor("football", "PL") }, ctx);
    expect(v).toEqual({ publish: true, signalType: "signal", isPaper: false, reasons: [], sourceDebt: false });
  });
  it("lega nel debito → passa con avviso, contato nel report", () => {
    const v = gateCandidate({ ...base, resultSource: resultSourceFor("football", "XYZ", conDebito) }, ctx);
    expect(v.publish && v.sourceDebt).toBe(true);
    const r = emptySyncReport();
    recordVerdict(r, v);
    expect(r.source_debt).toBe(1);
    expect(r.synced).toBe(1);
  });
  it("tennis partner → passa", () => {
    const v = gateCandidate({ ...base, resultSource: resultSourceFor("tennis", "Partner feed") }, ctx);
    expect(v.publish).toBe(true);
  });
  it("report: il rifiuto per fonte mancante si conta", () => {
    const r = emptySyncReport();
    recordVerdict(r, gateCandidate({ ...base, resultSource: null }, ctx));
    expect(r.rejected_reasons).toEqual({ no_result_source: 1 });
  });
});

// The declarations must agree with the maps the settle code actually uses: a
// league added to lib/summer-leagues.ts without a declared source fails here.
describe("data/result_sources.json combacia con le mappe di settle", () => {
  const football = RESULT_SOURCES.sources.football;
  const club = new Set([
    ...Object.keys(ESPN_SLUG_BY_FD_LEAGUE), ...Object.keys(ESPN_SLUGS),
    ...Object.keys(ODDS_SPORT_KEYS), ...Object.keys(SUMMER_LEAGUES),
  ]);
  for (const code of club) {
    it(`${code} dichiarata`, () => expect(football[code]?.length ?? 0).toBeGreaterThan(0));
  }
  for (const [code, sources] of Object.entries(football)) {
    if (sources.includes("espn") && club.has(code))
      it(`${code}: espn ha uno slug`, () => expect(espnSlugForLeague(code)).toBeTruthy());
    if (sources.includes("oddsapi"))
      it(`${code}: oddsapi ha una sport key`, () => expect(ODDS_SPORT_KEYS[code]).toBeTruthy());
    if (sources.includes("football-data"))
      it(`${code}: football-data e' una lega fd`, () => expect(ESPN_SLUG_BY_FD_LEAGUE[code]).toBeTruthy());
  }
  it("il debito ha owner e data", () => {
    expect(RESULT_SOURCES.debt.owner).toBeTruthy();
    expect(RESULT_SOURCES.debt.due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
