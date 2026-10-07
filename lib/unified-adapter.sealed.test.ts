// #LEDGER-SIGILLATA-1007 — (a) l'adapter sigilla la prima pick PUBBLICATA.
// Flag spento: sigilla tutto come main (anche la pick NULL del primo sync).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbQuery: mock.query }));
vi.mock("@/lib/world-cup-readiness", () => ({ isWorldCupSignalReady: async () => false }));
vi.mock("@/lib/result-sources", async (orig) => ({ ...(await orig<typeof import("@/lib/result-sources")>()), resultSourceFor: () => "football-data" }));
import { syncMatchPredictionsToUnified } from "./unified-adapter";

const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
const base = {
  league: "SA", league_name: "Serie A", kickoff: future,
  odds_home: 2.1, odds_draw: 3.3, odds_away: 3.6, edge: 0.01, enrichment: null,
};
// favorito al 40%: sotto il floor del calcio → pubblicata SENZA pick
const sottoFloor = { ...base, id: 1, match_id: "m-null", home_team: "A", away_team: "B", p_home: 0.40, p_draw: 0.33, p_away: 0.27, best_selection: "HOME" };
// favorito al 65%: pick HOME
const conPick = { ...base, id: 2, match_id: "m-home", home_team: "C", away_team: "D", p_home: 0.65, p_draw: 0.2, p_away: 0.15, best_selection: "HOME" };

function ledgerWrites() {
  return mock.query.mock.calls
    .filter(([sql]) => String(sql).includes("INSERT INTO pick_ledger"))
    .map(([, params]) => ({ source_id: params[1], pick: params[9] }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.query.mockImplementation(async (sql: string) =>
    sql.includes("FROM match_predictions") ? [sottoFloor, conPick] : []);
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("pick_ledger: quando si sigilla", () => {
  it("flag spento = main: sigilla anche la pick NULL", async () => {
    await syncMatchPredictionsToUnified();
    expect(ledgerWrites()).toEqual([
      { source_id: "m-null", pick: null },
      { source_id: "m-home", pick: "HOME" },
    ]);
  });

  it("flag acceso: la NULL non si sigilla (resta libera per la prima pick vera)", async () => {
    vi.stubEnv("LEDGER_SEALED_GRADING", "1");
    vi.stubEnv("LEDGER_SEALED_FROM", "2026-10-20T00:00:00Z");
    await syncMatchPredictionsToUnified();
    expect(ledgerWrites()).toEqual([{ source_id: "m-home", pick: "HOME" }]);
    // la riga servita si pubblica comunque, pick NULL compresa
    const served = mock.query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO unified_predictions"));
    expect(served).toHaveLength(2);
  });

  it("flag acceso senza data valida = spento", async () => {
    vi.stubEnv("LEDGER_SEALED_GRADING", "1");
    vi.stubEnv("LEDGER_SEALED_FROM", "");
    await syncMatchPredictionsToUnified();
    expect(ledgerWrites()).toHaveLength(2);
  });
});
