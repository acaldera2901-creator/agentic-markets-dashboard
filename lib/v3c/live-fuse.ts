// lib/v3c/live-fuse.ts (#V3C-LIVE2) — the second and third live sources for
// football (API-Football, The Odds API) and how their scores are merged with
// ESPN's for the same board row. Pure: the service passes rows and parsed feeds.
//
// Matching keeps the ESPN rule — ambiguity means NO score, never «take the
// first»:
//   1. the source id is in our id (`oddsapi:<id>` rows ↔ The Odds API event id);
//   2. else kick-off within 30', one team with the strong identity
//      (live-match.strongSameTeam) and the other at least contained in the
//      source's name («PSV» ⊂ «PSV Eindhoven»), the same age/sex/reserve markers on both
//      sides («Seoul» ≠ «Seoul W», «Real Madrid» ≠ «Real Madrid III»), either
//      orientation, exactly one candidate.
//
// Fusion, one row at a time, on the SAME key (the board id):
//   * the candidate with the most recent `updated_at` wins (a source's own
//     timestamp when it gives one, else when we read it);
//   * a tie goes to the source order ESPN → API-Football → The Odds API;
//   * the winner keeps its score. A minute or the goal list missing from the
//     winner is borrowed from another source ONLY if it shows the same state
//     and the same score — never mixed across two different scorelines.
import { SOURCE_NAMES, type V3LiveItem, type V3LiveSourceId } from "./live-contract";

export { SOURCE_NAMES };
import type { SourceSoccerEvent } from "./live-apifootball";
import { tokenSquadra } from "@/lib/dedupe-fixtures";
import { FOOTBALL_KICKOFF_MS, footballItem, strongSameTeam, type LiveRow } from "./live-match";

export const SOURCE_ORDER: readonly V3LiveSourceId[] = ["espn", "api_football", "odds_api"];

const SOURCE_PREFIX: Record<V3LiveSourceId, string> = { espn: "espn", api_football: "apif", odds_api: "oddsapi" };

const WOMEN = new Set(["w", "women", "womens", "ladies", "fem", "femenino", "feminino", "femminile", "feminine", "frauen", "dames", "damer", "kobiety"]);
const RESERVE = new Set(["b", "ii", "reserves", "res"]);

/** The markers that make two clubs of the same name different teams: «u19», «w», «ii», «iii». */
export function teamMarkers(name: string): string {
  const out = new Set<string>();
  for (const t of name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean)) {
    if (/^u\d{2}$/.test(t) || /^sub\d{2}$/.test(t)) out.add(`u${t.replace(/\D/g, "")}`);
    else if (WOMEN.has(t)) out.add("w");
    else if (RESERVE.has(t)) out.add("ii");
    else if (t === "iii") out.add("iii");
    else if (t === "youth" || t === "academy" || t === "juniors") out.add("youth");
  }
  return [...out].sort().join(",");
}

function sameTeam(ours: string, theirs: string): boolean {
  return teamMarkers(ours) === teamMarkers(theirs) && strongSameTeam(ours, theirs);
}

/** One name's tokens all inside the other's, even short ones («PSV» ⊂ «PSV Eindhoven»); same markers. */
function weakSameTeam(ours: string, theirs: string): boolean {
  if (teamMarkers(ours) !== teamMarkers(theirs)) return false;
  const x = new Set(tokenSquadra(ours));
  const y = new Set(tokenSquadra(theirs));
  const [small, big] = x.size <= y.size ? [x, y] : [y, x];
  return small.size > 0 && [...small].every((t) => big.has(t));
}

/** Both teams: one with the strong identity, the other at least the weak one (a short name like «PSV», «AZ»). */
function samePair(h: string, a: string, eh: string, ea: string): boolean {
  return (sameTeam(h, eh) && weakSameTeam(a, ea)) || (weakSameTeam(h, eh) && sameTeam(a, ea));
}

/** The Odds API id carried by our own id, if any. */
export function oddsApiIdOf(row: Pick<LiveRow, "id">): string | null {
  const m = /^oddsapi:([0-9a-f]{16,64})$/i.exec(row.id);
  return m ? m[1] : null;
}

export type SourceHit = { ev: SourceSoccerEvent; swapped: boolean; by: "id" | "names" };

export function matchSourceEvent(row: LiveRow, events: readonly SourceSoccerEvent[], ownId: string | null): SourceHit | null {
  if (ownId) {
    const ev = events.find((e) => e.id === ownId);
    if (ev) {
      // our row was created from this very event: same orientation unless the names say otherwise
      const swapped = !sameTeam(row.home, ev.home) && sameTeam(row.home, ev.away) && sameTeam(row.away, ev.home);
      return { ev, swapped, by: "id" };
    }
  }
  const k = Date.parse(row.kickoff);
  if (!Number.isFinite(k)) return null;
  const found: { ev: SourceSoccerEvent; swapped: boolean }[] = [];
  for (const ev of events) {
    const t = Date.parse(ev.kickoff);
    if (!Number.isFinite(t) || Math.abs(t - k) > FOOTBALL_KICKOFF_MS) continue;
    if (samePair(row.home, row.away, ev.home, ev.away)) found.push({ ev, swapped: false });
    else if (samePair(row.home, row.away, ev.away, ev.home)) found.push({ ev, swapped: true });
  }
  return found.length === 1 ? { ...found[0], by: "names" } : null;
}

export function sourceItem(hit: SourceHit, source: V3LiveSourceId, readAt: string): V3LiveItem {
  return {
    ...footballItem(hit.ev, hit.swapped),
    source_id: `${SOURCE_PREFIX[source]}:${hit.ev.id}`,
    matched_by: hit.by,
    source,
    updated_at: hit.ev.updatedAt ?? readAt,
  };
}

function rank(x: V3LiveItem): [number, number] {
  const t = Date.parse(x.updated_at);
  return [Number.isFinite(t) ? t : 0, SOURCE_ORDER.indexOf(x.source)];
}

/** The one item shown for a row, from every source that matched it. */
export function fuse(cands: readonly V3LiveItem[]): V3LiveItem | null {
  if (!cands.length) return null;
  const sorted = [...cands].sort((a, b) => {
    const [ta, pa] = rank(a);
    const [tb, pb] = rank(b);
    return tb - ta || pa - pb;
  });
  const best = sorted[0];
  if (best.sport !== "football") return best;
  let out = best;
  for (const o of sorted.slice(1)) {
    if (o.sport !== "football" || o.state !== out.state || o.home !== out.home || o.away !== out.away || out.home == null) continue;
    if (out.minute == null && o.minute != null && out.state === "live") out = { ...out, minute: o.minute };
    if (!out.events.length && o.events.length) out = { ...out, events: o.events };
  }
  return out;
}
