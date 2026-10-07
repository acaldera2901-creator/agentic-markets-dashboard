// lib/v3c/record-weeks.test.ts (#REDESIGN-V3C final2) — the weekly chart's extra
// fields: sealed vs settled, awaiting a result, the week in progress and the
// nations break read from the ledger (weeks with no top-five league match).
import { describe, expect, it } from "vitest";
import { buildRecord, TOP_LEAGUE_CODES, type SealedFootballRow } from "./record";

const NOW = new Date("2026-10-07T09:00:00Z"); // a Wednesday: week of 2026-10-05
let k = 0;
const row = (kickoff: string, over: Partial<SealedFootballRow> = {}): SealedFootballRow => ({
  source_id: `m${++k}`,
  league: "PL",
  captured_at: "2026-08-01T08:00:00Z",
  commence_time: kickoff,
  is_paper: false,
  p_home: 0.5, p_draw: 0.3, p_away: 0.2,
  result: "won", outcome: "HOME",
  market_p_home: 0.45, market_p_draw: 0.3, market_p_away: 0.25,
  ...over,
});

const ledger = [
  row("2026-07-08T18:00:00Z", { league: "MLS" }), // summer, before any top-five match: not a break
  row("2026-09-15T18:00:00Z"), // top five
  row("2026-09-16T18:00:00Z", { league: "EL1" }),
  row("2026-09-23T18:00:00Z", { league: "MLS" }), // week of 21/09: no top five → break
  row("2026-09-24T18:00:00Z", { league: "EL1", result: null, outcome: null }), // kicked off, no result
  row("2026-09-30T18:00:00Z", { league: "EL1", result: "void", outcome: null }), // week of 28/09: break, void
  row("2026-10-05T18:00:00Z", { league: "EL2" }), // this week: one settled
  row("2026-10-10T15:00:00Z", { league: "SA", result: null, outcome: null }), // this week, still to play
  row("2026-10-13T18:00:00Z", { league: "BL1", result: null, outcome: null }), // next week: not shown
];

describe("record · weekly chart fields", () => {
  const r = buildRecord(ledger, NOW);
  const w = Object.fromEntries(r.weekly.map((x) => [x.week_start, x]));

  it("the five league codes are the ones measured in pick_ledger", () => {
    expect([...TOP_LEAGUE_CODES].sort()).toEqual(["BL1", "FL1", "PD", "PL", "SA"]);
  });

  it("started weeks only, each with settled n over sealed and the ones awaiting a result", () => {
    expect(r.weekly.map((x) => x.week_start)).toEqual(["2026-07-06", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"]);
    expect([w["2026-09-14"].n, w["2026-09-14"].sealed, w["2026-09-14"].awaiting_result]).toEqual([2, 2, 0]);
    expect([w["2026-09-21"].n, w["2026-09-21"].sealed, w["2026-09-21"].awaiting_result]).toEqual([1, 2, 1]);
    // a void without outcome is sealed but has no outcome, and is not «awaiting»
    expect([w["2026-09-28"].n, w["2026-09-28"].sealed, w["2026-09-28"].awaiting_result]).toEqual([0, 1, 0]);
    // a future match of this week is sealed, not awaiting
    expect([w["2026-10-05"].n, w["2026-10-05"].sealed, w["2026-10-05"].awaiting_result]).toEqual([1, 2, 0]);
  });

  it("an empty started week keeps an honest zero: no interval, bars at 0", () => {
    expect(w["2026-09-28"].expected_top).toBe(0);
    expect(w["2026-09-28"].observed_top_ci95).toBeNull();
  });

  it("only the current week is in progress", () => {
    expect(r.weekly.filter((x) => x.in_progress).map((x) => x.week_start)).toEqual(["2026-10-05"]);
  });

  it("break = no top-five match between weeks that had one; the summer before the season is not", () => {
    expect(r.weekly.filter((x) => x.nations_break).map((x) => x.week_start)).toEqual(["2026-09-21", "2026-09-28"]);
    expect(w["2026-07-06"].nations_break).toBe(false);
  });

  it("rows without a league: no break is guessed", () => {
    const bare = buildRecord(ledger.map((x) => ({ ...x, league: undefined })), NOW);
    expect(bare.weekly.every((x) => x.nations_break === undefined)).toBe(true);
  });
});
