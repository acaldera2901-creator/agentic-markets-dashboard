// Grading of a settled tennis row. Extracted from app/api/cron/settle/route.ts
// (#TENNIS-VOID-NOT-LOST-0805) because the bug it fixes only existed as long as
// the rule lived inline as a ternary nobody could test:
//
//   const outcome = winner === String(row.pick) ? "won" : "lost";
//
// With `pick` null — every tennis row below its surfacing floor — `String(null)`
// is the literal "null", which never equals a player's name, so a row on which
// we deliberately declined to pick was graded a LOSS. Measured on prod: 13 such
// rows, 13 lost, 0 won. It never surfaced as a wrong number on the site because
// /api/v2/history counts only `pick != null`, but it is a landmine for anyone
// who counts by `result` — and it can only ever lean pessimistic.

export type TennisGrade = "won" | "lost" | "void";

// `void` is not a third outcome of the match: it is the absence of a bet. It is
// already the value the rest of the pipeline carries for "shown without a pick",
// which is why below-floor rows settled elsewhere read `void` and only this path
// disagreed.
export function gradeTennisPick(
  pick: string | null | undefined,
  winner: string | null | undefined
): TennisGrade | null {
  if (winner == null || winner === "") return null; // not settled upstream yet
  if (pick == null || pick === "") return "void";   // nothing was picked, nothing can lose
  return pick === winner ? "won" : "lost";
}

// Which side of a 2-way tennis market won, in the home/away vocabulary the
// prediction_log shadow speaks (`home` = player1). Returns null when the winner
// cannot be matched to either side — better no settlement than a wrong one.
export function tennisWinnerSide(
  winner: string | null | undefined,
  playerOne: string | null | undefined,
  playerTwo: string | null | undefined
): "home" | "away" | null {
  if (!winner) return null;
  if (playerOne && winner === playerOne) return "home";
  if (playerTwo && winner === playerTwo) return "away";
  return null;
}
