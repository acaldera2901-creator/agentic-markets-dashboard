// #GATE-1001 — nothing is published or sealed without a declared result source.
import { describe, it, expect } from "vitest";
import { gateCandidate, recordVerdict, emptySyncReport } from "./publication-gate";
import { resultSourceFor, RESULT_SOURCE_DEBT, RESULT_SOURCES, type ResultSourceTable } from "./result-sources";
import { ESPN_SLUG_BY_FD_LEAGUE, espnSlugForLeague } from "./espn-results";
import { ESPN_SLUGS, ODDS_SPORT_KEYS, SUMMER_LEAGUES } from "./summer-leagues";
import rawTable from "@/data/result_sources.json";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");

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
  it("codice lega normalizzato (spazi, minuscole)", () => {
    expect(resultSourceFor("football", " pl ")).toBe("football-data,espn");
    expect(resultSourceFor("football", "pol")).toBe(RESULT_SOURCE_DEBT);
  });
  it("lega nuova senza fonte → null", () => expect(resultSourceFor("football", "JPN")).toBeNull());
  it("sport nuovo senza fonte → null", () => expect(resultSourceFor("baseball", "MLB")).toBeNull());
  it("lega nel debito dichiarato → debito", () =>
    expect(resultSourceFor("football", "XYZ", conDebito)).toBe(RESULT_SOURCE_DEBT));
  it("POL e VEI (solo Odds API /scores a 3 giorni) → debito dichiarato, non fonte piena", () => {
    expect(resultSourceFor("football", "POL")).toBe(RESULT_SOURCE_DEBT);
    expect(resultSourceFor("football", "VEI")).toBe(RESULT_SOURCE_DEBT);
  });
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
// league added to lib/summer-leagues.ts without a declared source fails here,
// and so does one declared without a source it really has (the inverse).
const CLUB = new Set([
  ...Object.keys(ESPN_SLUG_BY_FD_LEAGUE), ...Object.keys(ESPN_SLUGS),
  ...Object.keys(ODDS_SPORT_KEYS), ...Object.keys(SUMMER_LEAGUES),
]);

function oracleErrors(t: ResultSourceTable): string[] {
  const football = t.sources.football ?? {};
  const errs: string[] = [];
  for (const code of CLUB) {
    if (!(football[code]?.length) && !t.debt.leagues.includes(`football:${code}`)) errs.push(`${code}: undeclared`);
  }
  for (const [code, sources] of Object.entries(football)) {
    if (!CLUB.has(code)) continue; // national codes: checked against the Python client below
    const espn = sources.includes("espn");
    if (espn && !espnSlugForLeague(code)) errs.push(`${code}: espn without slug`);
    if (!espn && espnSlugForLeague(code)) errs.push(`${code}: has ESPN slug but espn not declared`);
    if (sources.includes("oddsapi") && !ODDS_SPORT_KEYS[code]) errs.push(`${code}: oddsapi without key`);
    if (sources.includes("football-data") && !ESPN_SLUG_BY_FD_LEAGUE[code]) errs.push(`${code}: not a football-data league`);
  }
  return errs;
}

describe("data/result_sources.json combacia con le mappe di settle", () => {
  it("la tabella vera non ha errori", () => expect(oracleErrors(RESULT_SOURCES)).toEqual([]));
  it("oracolo: lega con slug ESPN dichiarata solo oddsapi → errore", () =>
    expect(oracleErrors({ ...RESULT_SOURCES, sources: { football: { ...RESULT_SOURCES.sources.football, ELI: ["oddsapi"] } } }))
      .toContain("ELI: has ESPN slug but espn not declared"));
  it("oracolo: lega delle mappe non dichiarata e fuori dal debito → errore", () =>
    expect(oracleErrors({ ...RESULT_SOURCES, debt: { ...RESULT_SOURCES.debt, leagues: [] } })).toContain("POL: undeclared"));

  it("ogni fonte dichiarata e' una fonte descritta in _sources", () => {
    const known = Object.keys(rawTable._sources);
    for (const bySport of Object.values(RESULT_SOURCES.sources))
      for (const sources of Object.values(bySport)) for (const s of sources) expect(known).toContain(s);
  });
  it("FRIENDLY/UNL/CNL: espn ha uno slug nel client Python", () => {
    const client = readFileSync(join(ROOT, "core/espn_soccer_client.py"), "utf8");
    for (const code of ["FRIENDLY", "UNL", "CNL"]) {
      expect(RESULT_SOURCES.sources.football[code]).toContain("espn");
      expect(client).toMatch(new RegExp(`"${code}": "[a-z.]+"`));
    }
  });
  it("tennis '*': i due resolver esistono nel codice", () => {
    expect(RESULT_SOURCES.sources.tennis["*"]).toEqual(["espn-tennis", "betconstruct"]);
    const settle = readFileSync(join(ROOT, "agents/tennis_settlement.py"), "utf8");
    expect(readFileSync(join(ROOT, "core/espn_tennis_client.py"), "utf8")).toContain("def get_completed_results_for_days");
    expect(readFileSync(join(ROOT, "core/partner_tennis_results.py"), "utf8")).toContain("def get_partner_results_for_days");
    expect(settle).toContain("_resolve_via_espn");
    expect(settle).toContain("_resolve_via_partner");
  });
  it("il debito ha owner e data", () => {
    expect(RESULT_SOURCES.debt.owner).toBeTruthy();
    expect(RESULT_SOURCES.debt.due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
