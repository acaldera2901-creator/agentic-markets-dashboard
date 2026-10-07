// lib/v3c/fixdata3.ts (#REDESIGN-V3C fixdata3) — the data fixes of QA-REPORT-3, pure functions, no I/O:
//   R2/B6 one tennis match = one unordered pair of players, each player an unordered set of name tokens:
//         the Elo agent (ESPN) writes «Bai Zhuoxuan», the partner feed «Zhuoxuan Bai» (family name first or
//         last). Measured 07/10 (SELECT on tennis_predictions, last 7 days, ±48 h): 35 twin pairs whose names
//         differ only by token order — Bai–Jones and Bu–Van Assche on the board twice with different numbers.
//   R3    a tennis market has an age. A stored price older than TENNIS_MARKET_MAX_AGE_H at the moment it is
//         read (or, once play has started, at the start) is not the market: the partner books' prices are, and
//         without them the old price is shown as «may be outdated», with its age, and no estimate or gap on it.
import { canonicalPlayerKey } from "@/lib/tennis-names";

/** A player's identity for matching: the canonical name's tokens, sorted («Bai Zhuoxuan» = «Zhuoxuan Bai»). */
export function playerKey(name: string | null | undefined): string {
  return canonicalPlayerKey(name ?? "").split(" ").filter(Boolean).sort().join(" ");
}

/** A match's identity: the two players' keys without order (who is listed first never matters). */
export function tennisPairId(a: string | null | undefined, b: string | null | undefined): string {
  return [playerKey(a), playerKey(b)].sort().join("|");
}

// ─── R3: how old a stored tennis market may be ───────────────────────────────

/** A stored market older than this at the moment of reading (before the start) or at the start is stale. */
export const TENNIS_MARKET_MAX_AGE_H = 6;

/**
 * Age in whole minutes of a price stored at `asOf`, measured at the moment it is read, or at the start once play
 * has started (a pre-start price does not age during the match). null = no usable time.
 */
export function marketAgeMin(asOf: string | null | undefined, kickoff: string, now: Date): number | null {
  const t = asOf ? Date.parse(asOf) : NaN;
  if (!Number.isFinite(t)) return null;
  const k = Date.parse(kickoff);
  const ref = Number.isFinite(k) ? Math.min(now.getTime(), k) : now.getTime();
  return Math.max(0, Math.round((ref - t) / 60_000));
}

/** true when the stored price is recent enough to be the market (age known and ≤ TENNIS_MARKET_MAX_AGE_H). */
export function marketFresh(asOf: string | null | undefined, kickoff: string, now: Date): boolean {
  const age = marketAgeMin(asOf, kickoff, now);
  return age != null && age <= TENNIS_MARKET_MAX_AGE_H * 60;
}

/** «52:07» — the age of a price in hours and minutes (hh:mm, hours not capped at 24). */
export function ageHhMm(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min) || min < 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
