// «Yesterday» (/api/v3/yesterday, home «Ieri»): the sealed picks of one UTC day
// and how they settled, from pick_ledger + pick_settlement_current ONLY. Pure:
// the SQL lives in queries.ts. No hit-rate, no ROI: integers (won, lost) next
// to the sum of the sealed probabilities, which is what the estimates expected.
import { LIMITED_SAMPLE_N, type V3DayPick, type V3DaySummary, type V3YesterdayResponse } from "./contracts";
import { parseOutcome, roundP } from "./prob";
import { brier3, mean } from "./scoring";

export type SealedDayRow = {
  sport: "football" | "tennis";
  home: string;
  away: string;
  competition: string | null;
  pick: string | null;
  /** picked-outcome probability as sealed (0..1) */
  confidence: number | null;
  p_home: number | null;
  p_draw: number | null;
  p_away: number | null;
  commence_time: string;
  captured_at: string;
  is_paper: boolean;
  result: string;
  outcome: string | null;
  final_score: string | null;
  /** fidelity: market at seal, margin removed (football only; null = not paired) */
  market_p_home?: number | null;
  market_p_draw?: number | null;
  market_p_away?: number | null;
};

/** The UTC day before `now`, as YYYY-MM-DD, and its [from, to) bounds. */
export function yesterdayUtc(now: Date = new Date()): { day: string; from: string; to: string } {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to.getTime() - 86_400_000);
  return { day: from.toISOString().slice(0, 10), from: from.toISOString(), to: to.toISOString() };
}

function parseResult(raw: string): V3DayPick["result"] | null {
  const r = raw.trim().toLowerCase();
  return r === "won" || r === "lost" || r === "void" || r === "unresolved" ? r : null;
}

/** Sealed probability of the pick: `confidence` first, else the 1X2 leg named by `pick`. */
export function pickProbability(r: SealedDayRow): number | null {
  if (!r.pick) return null;
  if (r.confidence != null && Number.isFinite(r.confidence)) return r.confidence;
  const k = r.pick.trim().toUpperCase();
  if (k === "HOME") return r.p_home;
  if (k === "DRAW") return r.p_draw;
  if (k === "AWAY") return r.p_away;
  return null;
}

function summarise(picks: V3DayPick[]): V3DaySummary {
  let won = 0;
  let lost = 0;
  let other = 0;
  let expected = 0;
  let nExp = 0;
  for (const p of picks) {
    if (p.result === "won") won += 1;
    else if (p.result === "lost") lost += 1;
    else other += 1;
    if ((p.result === "won" || p.result === "lost") && p.p != null) {
      expected += p.p;
      nExp += 1;
    }
  }
  return {
    settled: picks.length,
    won,
    lost,
    other,
    expected_wins: nExp ? roundP(expected) : null,
    limited_sample: won + lost < LIMITED_SAMPLE_N,
  };
}

export function buildYesterday(rows: SealedDayRow[], day: string, now: Date = new Date()): V3YesterdayResponse {
  const picks: V3DayPick[] = [];
  for (const r of rows) {
    const result = parseResult(r.result);
    if (!result) continue;
    picks.push({
      sport: r.sport,
      home: r.home,
      away: r.away,
      competition: r.competition,
      pick: r.pick,
      p: pickProbability(r),
      result,
      outcome: r.outcome,
      final_score: r.final_score,
      kickoff: new Date(r.commence_time).toISOString(),
      sealed_at: new Date(r.captured_at).toISOString(),
      is_paper: r.is_paper,
    });
  }
  picks.sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.home.localeCompare(b.home));
  // fidelity: Brier of yesterday's football estimates next to the market's, on the SAME paired rows (as the record)
  const paired = rows.flatMap((r) => {
    const happened = r.sport === "football" ? parseOutcome(r.outcome) : null;
    if (!happened || r.p_home == null || r.p_draw == null || r.p_away == null) return [];
    if (r.market_p_home == null || r.market_p_draw == null || r.market_p_away == null) return [];
    return [{ e: brier3({ home: r.p_home, draw: r.p_draw, away: r.p_away }, happened), m: brier3({ home: r.market_p_home, draw: r.market_p_draw, away: r.market_p_away }, happened) }];
  });
  const be = mean(paired.map((x) => x.e));
  const bm = mean(paired.map((x) => x.m));
  return {
    contract: "v3.yesterday.1",
    generated_at: now.toISOString(),
    day,
    football: summarise(picks.filter((p) => p.sport === "football")),
    tennis: summarise(picks.filter((p) => p.sport === "tennis")),
    picks,
    brier: paired.length && be != null && bm != null ? { n: paired.length, estimate: roundP(be), market: roundP(bm) } : null,
    notes: [
      "Source: pick_ledger (sealed before kickoff, append-only) joined to pick_settlement_current. Only rows that kicked off on this UTC day and have a settlement.",
      "won/lost are the settlement of the sealed pick. expected_wins = Σ sealed probability of the pick over the won+lost rows: what the estimates expected, to read next to what happened.",
      "Rows without a declared pick settle as void/unresolved and are counted in `other`. No hit-rate, ROI or CLV is published.",
      "brier: football rows paired with the market at seal (prediction_log row whose served probabilities equal the sealed ones), same rule as /api/v3/record. Lower is better; a measure, not a profit claim.",
      "Football = the ledger model of the public record (match_predictions, football-v4-xg-model); tennis = every non-backfill sealed tennis pick.",
    ],
  };
}
