// #REDESIGN-V3C v3c-int — twin fixture rows in the sealed football record.
// The same match is sealed twice (espn:* and oddsapi:* source ids, same teams,
// same kickoff): it must count once in /api/v3/record and /api/v3/calibration.
// Fictitious rows only, no DB.
import { describe, expect, it, vi } from "vitest";
import { buildRecord, dedupeTwinFixtures, twinDroppedIds, TWIN_KICKOFF_WINDOW_HOURS, type SealedFootballRow } from "./record";
import { SEALED_FOOTBALL_SQL } from "./queries";

const row = (over: Partial<SealedFootballRow> = {}): SealedFootballRow => ({
  source_id: "espn:1",
  home_team: "Botafogo",
  away_team: "Grêmio",
  captured_at: "2026-09-10T16:00:00Z",
  commence_time: "2026-09-16T22:00:00Z",
  is_paper: false,
  p_home: 0.5,
  p_draw: 0.3,
  p_away: 0.2,
  result: "void",
  outcome: "HOME",
  market_p_home: 0.48,
  market_p_draw: 0.3,
  market_p_away: 0.22,
  ...over,
});

describe("dedupeTwinFixtures", () => {
  it("same teams, same kickoff: one row, the earliest seal", () => {
    const a = row({ source_id: "oddsapi:x", captured_at: "2026-09-12T00:00:00Z" });
    const b = row({ source_id: "espn:1", captured_at: "2026-09-10T16:00:00Z" });
    expect(dedupeTwinFixtures([a, b]).map((r) => r.source_id)).toEqual(["espn:1"]);
  });
  it("a settled twin beats an unresolved one, whatever the seal order", () => {
    const early = row({ source_id: "espn:1", captured_at: "2026-09-10T00:00:00Z", result: "unresolved", outcome: null });
    const late = row({ source_id: "oddsapi:x", captured_at: "2026-09-12T00:00:00Z", result: "won", outcome: "AWAY" });
    expect(dedupeTwinFixtures([early, late]).map((r) => r.source_id)).toEqual(["oddsapi:x"]);
  });
  it(`kickoffs within ${TWIN_KICKOFF_WINDOW_HOURS}h are the same match, beyond are not`, () => {
    const a = row({ source_id: "a" });
    const near = row({ source_id: "b", commence_time: "2026-09-17T03:00:00Z" }); // +5h
    const far = row({ source_id: "c", commence_time: "2026-09-19T22:00:00Z" }); // +72h: another game (fixdata: the window is 48 h)
    expect(dedupeTwinFixtures([a, near, far]).map((r) => r.source_id).sort()).toEqual(["a", "c"]);
  });
  it("different teams or the reverse fixture are never merged; order is kept", () => {
    const a = row({ source_id: "a" });
    const rev = row({ source_id: "b", home_team: "Grêmio", away_team: "Botafogo" });
    const other = row({ source_id: "c", home_team: "Sabadell", away_team: "Andorra" });
    expect(dedupeTwinFixtures([a, rev, other]).map((r) => r.source_id)).toEqual(["a", "b", "c"]);
  });
  it("rows without team names pass through untouched", () => {
    const a = row({ source_id: "a", home_team: undefined, away_team: undefined });
    const b = row({ source_id: "b", home_team: undefined, away_team: undefined });
    expect(dedupeTwinFixtures([a, b])).toHaveLength(2);
  });
  it("the record counts the match once", () => {
    const rows = [row({ source_id: "espn:1" }), row({ source_id: "oddsapi:x", captured_at: "2026-09-11T00:00:00Z" })];
    const r = buildRecord(dedupeTwinFixtures(rows), new Date("2026-10-01T00:00:00Z"));
    expect(r.counts.sealed).toBe(1);
    expect(r.counts.scored).toBe(1);
    expect(r.counts.paired).toBe(1);
  });
  it("the ledger query selects the team names the rule needs", () => {
    expect(SEALED_FOOTBALL_SQL).toMatch(/l\.home_team/);
    expect(SEALED_FOOTBALL_SQL).toMatch(/l\.away_team/);
  });
});

// polish: the receipts list must show a twin fixture once, like the record.
describe("receipts use the record's twin rule", () => {
  it("twinDroppedIds returns exactly the rows dedupeTwinFixtures removes", () => {
    const a = row({ source_id: "espn:1" });
    const b = row({ source_id: "oddsapi:x", captured_at: "2026-09-11T00:00:00Z" });
    const c = row({ source_id: "c", home_team: "Sabadell", away_team: "Andorra" });
    expect(twinDroppedIds([a, b, c])).toEqual(["oddsapi:x"]);
    expect(twinDroppedIds([c])).toEqual([]);
  });

  it("fetchFootballReceipts excludes the dropped twin in SQL, so paging stays exact", async () => {
    vi.resetModules();
    const sqls: string[] = [];
    vi.doMock("@/lib/db", () => ({
      dbQueryStrict: async (sql: string, params: unknown[]) => {
        sqls.push(sql.replace(/\$(\d+)/g, (_, n) => `'${String(params[Number(n) - 1])}'`));
        if (sqls.length === 1) {
          return [
            { source_id: "espn:1", home_team: "Botafogo", away_team: "Grêmio", captured_at: "2026-09-10T16:00:00Z", commence_time: "2026-09-16T22:00:00Z", result: "won", outcome: "HOME" },
            { source_id: "oddsapi:x", home_team: "Botafogo", away_team: "Grêmio", captured_at: "2026-09-11T16:00:00Z", commence_time: "2026-09-16T22:00:00Z", result: "won", outcome: "HOME" },
          ];
        }
        return [];
      },
    }));
    const q = await import("./queries");
    await q.fetchFootballReceipts(12, 0);
    expect(sqls).toHaveLength(2);
    expect(sqls[1]).toMatch(/NOT IN \('oddsapi:x'\)/);
    expect(sqls[1]).not.toMatch(/'espn:1'/);
    vi.doUnmock("@/lib/db");
  });
});
