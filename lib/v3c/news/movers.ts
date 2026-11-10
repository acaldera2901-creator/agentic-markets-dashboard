// lib/v3c/news/movers.ts (#REDESIGN-V3C news) — «Most moved today»: the board
// matches whose lead price moved most in the last 24 h, each with the news
// item nearest in time to its biggest single move. Pure. It states WHEN, never
// WHY: the page writes «news at hh:mm», never «because of».

export type Point = { t: number; v: number };
export const DAY_MS = 24 * 3_600_000;
/** a news item further than this from the move is not «near» it */
export const NEAR_MS = 72 * 3_600_000;

export type DayMove = { from: number; to: number; pct: number; stepAt: number; firstAt: number; lastAt: number };

/**
 * The move over the last 24 h on one price line (captures sorted by time):
 * from = the price in force 24 h ago (or the first capture after), to = the
 * last capture. null when there is nothing to compare or nothing moved.
 */
export function dayMove(points: readonly Point[], now: number): DayMove | null {
  const pts = points.filter((p) => Number.isFinite(p.t) && p.v > 1 && p.t <= now).sort((a, b) => a.t - b.t);
  if (pts.length < 2) return null;
  const cut = now - DAY_MS;
  let start = 0;
  for (let i = 0; i < pts.length; i++) if (pts[i].t <= cut) start = i;
  const win = pts.slice(start);
  if (win.length < 2) return null;
  const from = win[0].v;
  const to = win[win.length - 1].v;
  if (from === to) return null;
  let stepAt = win[1].t;
  let big = -1;
  for (let i = 1; i < win.length; i++) {
    const d = Math.abs(win[i].v - win[i - 1].v);
    if (d > big) [big, stepAt] = [d, win[i].t];
  }
  return { from, to, pct: Math.abs(to - from) / from, stepAt, firstAt: win[0].t, lastAt: win[win.length - 1].t };
}

/** The item nearest to `at` within `near` ms, ties to the earlier one. */
export function nearestInTime<T extends { t: number }>(items: readonly T[], at: number, near = NEAR_MS): T | null {
  let best: T | null = null;
  for (const it of items) {
    const d = Math.abs(it.t - at);
    if (d > near) continue;
    if (!best || d < Math.abs(best.t - at) || (d === Math.abs(best.t - at) && it.t < best.t)) best = it;
  }
  return best;
}

/** The n biggest relative moves, largest first (ties: earlier kick-off). */
export function topMoves<T extends { move: DayMove; kickoff: string }>(rows: readonly T[], n = 3): T[] {
  return [...rows].sort((a, b) => b.move.pct - a.move.pct || Date.parse(a.kickoff) - Date.parse(b.kickoff)).slice(0, n);
}

export type MoverCard = {
  id: string;
  home: string;
  away: string;
  league: string | null;
  kickoff: string;
  outcome: "home" | "draw" | "away";
  from: number;
  to: number;
  stepAt: number;
  /** the nearest note naming either team, within NEAR_MS of the biggest step */
  news: { guid: string; t: number } | null;
};

type BoardRow = { m: { id: string; home: string; away: string; league: string | null; competition: string | null; kickoff: string }; outcome: MoverCard["outcome"]; points: Point[] };

/** «Most moved today» from each match's lead price line; `teamsByGuid` = board teams each note names. */
export function mostMoved(rows: readonly BoardRow[], teamsByGuid: ReadonlyMap<string, readonly string[]>, notes: readonly { guid: string; t: number }[], now: number, n = 3): MoverCard[] {
  const moved = rows.flatMap((r) => {
    const move = dayMove(r.points, now);
    return move ? [{ ...r, move, kickoff: r.m.kickoff }] : [];
  });
  return topMoves(moved, n).map(({ m, outcome, move }) => {
    const mine = notes.filter((c) => (teamsByGuid.get(c.guid) ?? []).some((t) => t === m.home || t === m.away));
    const near = nearestInTime(mine, move.stepAt);
    return {
      id: m.id, home: m.home, away: m.away, league: m.competition || m.league, kickoff: m.kickoff, outcome,
      from: move.from, to: move.to, stepAt: move.stepAt, news: near ? { guid: near.guid, t: near.t } : null,
    };
  });
}
