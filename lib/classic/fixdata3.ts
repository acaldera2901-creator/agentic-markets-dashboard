// lib/classic/fixdata3.ts — #CLASSIC-CARD-1008: le funzioni pure di betredge/v3c-fixq:lib/v3c/fixdata3.ts
// (0909e2eb) che servono alla scheda classic — identità della coppia di giocatori e
// età di un prezzo di tennis. Copiate così come sono; ageHuman/ageHhMm (copy) restano fuori.
import { canonicalPlayerKey } from "@/lib/tennis-names";

/** A player's identity for matching: the canonical name's tokens, sorted («Bai Zhuoxuan» = «Zhuoxuan Bai»). */
export function playerKey(name: string | null | undefined): string {
  return canonicalPlayerKey(name ?? "").split(" ").filter(Boolean).sort().join(" ");
}

/** A match's identity: the two players' keys without order (who is listed first never matters). */
export function tennisPairId(a: string | null | undefined, b: string | null | undefined): string {
  return [playerKey(a), playerKey(b)].sort().join("|");
}

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
