// Chiave di join odds↔predizione (#FORTUNEPLAY-LIVE-ODDS-1). Replica TS di
// core/sportsbook/common.py::_pair_key. Calcolata su entrambi i lati in TS →
// consistenza interna (nessuna dipendenza dal path Python→DB).
import { normName } from "./odds-api";
import { canonicalPlayerKey } from "./tennis-names";

// Sport keys as they appear in the BetConstruct feed. #NEWSPORTS (coverage
// verified by Andrea 2026-07-05: MLB and UFC are in the FortunePlay feed —
// the old {soccer,tennis} set was our filter, not a book limit). Person-named
// sports (tennis, mma) key on canonicalPlayerKey, team sports on normName.
export type PairSport = "soccer" | "tennis" | "baseball" | "mma";

export function teamPairKey(
  sport: PairSport,
  a: string,
  b: string,
  commenceIso: string | null
): string | null {
  if (!commenceIso || !a || !b) return null;
  const day = commenceIso.slice(0, 10);
  if (day.length !== 10) return null;
  const key = (n: string) =>
    sport === "tennis" || sport === "mma" ? canonicalPlayerKey(n) : normName(n);
  const ka = key(a);
  const kb = key(b);
  if (!ka || !kb) return null;
  const [x, y] = [ka, kb].sort();
  return `${day}:${x}|${y}`;
}
