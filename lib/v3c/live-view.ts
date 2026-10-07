// lib/v3c/live-view.ts (#V3C-LIVESCORES) — what a live item looks like on
// screen, pure and tested. Rows never show a number the source did not give:
// no item → «score n/a», never a 0–0.
import type { V3LiveFootball, V3LiveItem, V3LiveTennis, V3LiveTennisSet } from "./live-contract";
import type { V3cLiveCopy } from "./live-copy";

/** Poll cadence while the tab is visible, and the error backoff ceiling. */
export const LIVE_POLL_MS = 45_000;
export const LIVE_BACKOFF_MAX_MS = 300_000;

/** 45 s, then 90, 180, 300, 300… after consecutive errors. */
export function nextDelay(errors: number): number {
  return errors <= 0 ? LIVE_POLL_MS : Math.min(LIVE_BACKOFF_MAX_MS, LIVE_POLL_MS * 2 ** errors);
}

/** Should this kick-off be polled at `now`? Same window as the endpoint (−15′ … +180′). */
export function wantsLive(kickoffIso: string, now: Date): boolean {
  const k = Date.parse(kickoffIso);
  if (!Number.isFinite(k)) return false;
  const d = now.getTime() - k;
  return d >= -15 * 60_000 && d < 180 * 60_000;
}

export type LiveTone = "live" | "done" | "quiet";

export type LiveBadge = {
  /** the word in the badge */
  label: string;
  /** a shorter word for the phone's narrow time column (only when it differs) */
  short?: string;
  tone: LiveTone;
  /** the line under it: minute, set, FT/AET… */
  sub: string | null;
  /** the scoreline («2–1», «6-3 4-1»), null when the source has none */
  score: string | null;
  /** live2: the label goes BEFORE the kick-off time («Kick-off · 14:00»): a started match no source covers */
  lead?: boolean;
};

export function footballScore(x: Pick<V3LiveFootball, "home" | "away">): string | null {
  return x.home == null || x.away == null ? null : `${x.home}–${x.away}`;
}

function setText(s: V3LiveTennisSet): string {
  // a finished tie-break prints the loser's points («7-6(4)»); one in play prints both («6-6(5-1)»)
  // a match tie-break in place of a deciding set (doubles): ESPN gives it as a 1-0 set → «[10-4]»
  if (s.tb1 != null && s.tb2 != null && s.p1 + s.p2 === 1) return `[${s.tb1}-${s.tb2}]`;
  const done = s.p1 === 7 || s.p2 === 7;
  const tb = s.tb1 == null || s.tb2 == null ? "" : done ? `(${Math.min(s.tb1, s.tb2)})` : `(${s.tb1}-${s.tb2})`;
  return `${s.p1}-${s.p2}${tb}`;
}

export function tennisScore(x: Pick<V3LiveTennis, "sets">): string | null {
  return x.sets.length ? x.sets.map(setText).join(" ") : null;
}

export function scoreOf(item: V3LiveItem): string | null {
  return item.sport === "football" ? footballScore(item) : tennisScore(item);
}

/**
 * The badge of a row in the live window.
 *   item          → state from the source;
 *   no item, ok   → live2: «Kick-off» before the kick-off time, quiet — no source covers it, so we
 *                   do not even claim it is in play (it may be over, or postponed), and never a minute;
 *   still loading → null (the caller keeps today's time-based «Live»).
 */
export function liveBadge(item: V3LiveItem | undefined, loaded: boolean, c: V3cLiveCopy, sport: "football" | "tennis" = "football"): LiveBadge | null {
  if (!item) return loaded ? { label: sport === "football" ? c.kickoff : c.start, tone: "quiet", sub: null, score: null, lead: true } : null;
  const score = scoreOf(item);
  switch (item.state) {
    case "pre":
      return { label: c.notStarted, tone: "quiet", sub: null, score: null };
    case "off":
      return { label: c.off, tone: "quiet", sub: null, score };
    case "break":
      return { label: item.sport === "football" ? c.ht : c.breakShort, tone: "live", sub: null, score };
    case "final": {
      const sub =
        item.sport === "football"
          ? item.final_kind === "aet"
            ? c.aet
            : item.final_kind === "pen" && item.pens
              ? c.pens(item.pens.home, item.pens.away)
              : item.final_kind === "ft"
                ? c.ft
                : null // live2: The Odds API says «completed» without FT/AET/pens: no word we would have to guess
          : item.final_kind === "ret"
            ? c.ret
            : null;
      return { label: c.finished, short: c.finishedShort, tone: "done", sub, score };
    }
    default:
      return {
        label: c.live,
        tone: "live",
        sub: item.sport === "football" ? item.minute : item.sets.length ? c.set(item.sets.length) : null,
        score,
      };
  }
}

/**
 * What changed worth saying out loud (aria-live polite): a football score that
 * moved, or a match that just ended. Minutes ticking and tennis games are NOT
 * announced — that would be noise every 45 seconds.
 */
export function announcements(
  prev: Record<string, V3LiveItem> | null,
  next: Record<string, V3LiveItem>,
  names: (id: string) => [string, string] | null,
  c: V3cLiveCopy,
): string[] {
  if (!prev) return [];
  const out: string[] = [];
  for (const [id, n] of Object.entries(next)) {
    const p = prev[id];
    const nm = names(id);
    if (!p || !nm) continue;
    if (n.sport === "football" && p.sport === "football" && n.home != null && n.away != null) {
      if (n.state === "final" && p.state !== "final") out.push(c.announceFinal(nm[0], n.home, nm[1], n.away));
      else if (n.home !== p.home || n.away !== p.away) out.push(c.announceScore(nm[0], n.home, nm[1], n.away));
    } else if (n.sport === "tennis" && p.sport === "tennis" && n.state === "final" && p.state !== "final" && n.sets.length) {
      const won = (who: "p1" | "p2") => n.sets.filter((s) => (who === "p1" ? s.p1 > s.p2 : s.p2 > s.p1)).length;
      out.push(c.announceFinal(nm[0], won("p1"), nm[1], won("p2")));
    }
  }
  return out;
}
