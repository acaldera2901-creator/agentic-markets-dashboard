// lib/v3c/news/daily-pick.ts (#NEWSWATCH-TOP3-1120, APPROVE Andrea 20/11) — which
// item is worth a rewrite and a card, and when. FotMob exposes no ranking (no
// order but time, no top flag, no counter: checked on the live page and RSS
// 20/11), so the importance is ours, deterministic, computed on the ORIGINAL
// title + teaser BEFORE any model call: the cap must sit upstream of the costs.
//
// What the score measures: relevance to the clubs/leagues BetRedge predicts,
// the chance the note moves a market (injury, return, ban, manager change),
// and how much the aggregated press is covering the same club. What it does
// NOT measure: the real gravity of an injury, stories without a club named in
// the original, anything FotMob itself considers «top».
//
// Pure: no I/O, no model.
import { CLUBS, clubsInText, type Club } from "../../news/clubs";

export type Sport = "football" | "tennis";

/** One rewrite spent on a pick; `image` = written, waiting for its card. */
export type DailyPick = { hash: string; sport: Sport; at: number; score: number; status: "image" | "published" | "dead"; title: string };
export type DailyState = { day: string; picks: DailyPick[] };
export type PickConfig = {
  /** notes published per Rome day, per sport (absent sport = not picked) */
  perDay: Partial<Record<Sport, number>>;
  /** rewrites (model calls) per Rome day, per sport: a refused pick hands its place over, up to this */
  maxRewrites: Partial<Record<Sport, number>>;
};

export const TIME_ZONE = "Europe/Rome";
/** Slot opening hours, Rome time (Andrea 20/11): the n-th note of the day can start from the n-th hour. */
export const SLOT_HOURS = [9, 14, 19] as const;
/** A candidate older than this is not news for a slot. */
export const PICK_MAX_AGE_MS = 18 * 3_600_000;
/** Coverage looks back this far. */
export const COVERAGE_WINDOW_MS = 24 * 3_600_000;
/** Runs (5 min each) a picked note may wait for a real photo before it hands its place over. */
export const NO_PHOTO_RUNS = 2;
export const DEFAULT_PICK: PickConfig = { perDay: { football: 3 }, maxRewrites: { football: 6 } };

function romeParts(ts: number): { day: string; hour: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(ts))
      .map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
/** The Rome calendar day, explicit zone (the Mac runs on Atlantic/Canary). */
export const romeDay = (ts: number): string => romeParts(ts).day;
/** Slots opened so far today, 0..3. */
export const slotsOpen = (ts: number): number => SLOT_HOURS.filter((h) => romeParts(ts).hour >= h).length;

// Top-5 leagues = LEAGUE_TIER_TOP5 of config/settings.py (PL, SA, PD, BL1, FL1).
// lib/news/clubs.ts lists them first, in its «Serie A … Ligue 1» sections (lower
// divisions of those countries included), then «Primeira Liga» onward: the
// boundary is the first club of that section. Checked by the test.
const TOP5_END = CLUBS.findIndex((c) => c.name === "Benfica");
const DECOYS = new Set(["FC Inter Turku"]);
export const isTop5 = (c: Club): boolean => CLUBS.indexOf(c) >= 0 && CLUBS.indexOf(c) < TOP5_END;

/** Market-moving notes: availability and the bench. A keyword heuristic, declared as such. */
const ACTIONABLE = /\b(injur(?:y|ies|ed)|ruled out|sidelined|setback|out for|miss(?:es|ed)? (?:the|next|out)|suspen(?:ded|sion)|ban(?:ned)?|red card|returns?|returned|back in training|fitness|doubt(?:ful)?|sacked|fired|dismissed|appointed|new (?:head )?(?:coach|manager)|resign(?:s|ed)?|steps? down)\b/i;

export type Scored = { score: number; why: string };
type Candidate = { title: string; text: string; source: string };

/** `others`: titles+teasers of the other items of the last COVERAGE_WINDOW_MS (queue and written stories). */
export function scoreFootball(it: Candidate, others: readonly string[]): Scored {
  const clubs = clubsInText(`${it.title}. ${it.text}`, 3).filter((c) => !DECOYS.has(c.name));
  const parts: string[] = [];
  let score = 0;
  if (clubs.some(isTop5)) (score += 2), parts.push("top5+2");
  else if (clubs.length) (score += 1), parts.push("club+1");
  if (ACTIONABLE.test(`${it.title} ${it.text}`)) (score += 2), parts.push("market+2");
  if (clubs.length) {
    const cov = Math.min(2, others.filter((o) => clubsInText(o, 3).some((c) => clubs.includes(c))).length);
    if (cov) (score += cov), parts.push(`coverage+${cov}`);
  }
  if (/^fotmob$/i.test(it.source)) (score += 0.5), parts.push("fotmob+0.5");
  return { score, why: parts.join(" ") || "none" };
}

/** Today's state, rolled at Rome midnight; a note still waiting for its card moves to the new day. */
export function dailyFor(prev: DailyState | undefined, now: number): DailyState {
  const day = romeDay(now);
  if (prev?.day === day) return prev;
  // limit: a carried note that publishes after midnight counts on the new day (at most one per sport)
  return { day, picks: (prev?.picks ?? []).filter((p) => p.status === "image") };
}

/** Whether `sport` may spend a rewrite now: a slot is open, nothing in flight, caps not reached. */
export function mayPick(d: DailyState, sport: Sport, cfg: PickConfig, now: number): { ok: boolean; why: string } {
  const perDay = cfg.perDay[sport] ?? 0;
  const mine = d.picks.filter((p) => p.sport === sport);
  const published = mine.filter((p) => p.status === "published").length;
  const inFlight = mine.filter((p) => p.status === "image").length;
  const quota = Math.min(perDay, slotsOpen(now));
  if (published >= perDay) return { ok: false, why: `${published}/${perDay} published today` };
  if (inFlight) return { ok: false, why: "one note already waiting for its card" };
  if (published >= quota) return { ok: false, why: `slot not open (${quota} of ${perDay} open, ${published} published)` };
  if (mine.length >= (cfg.maxRewrites[sport] ?? perDay)) return { ok: false, why: `rewrite cap ${mine.length}/${cfg.maxRewrites[sport] ?? perDay}` };
  return { ok: true, why: `slot ${published + 1}/${perDay}` };
}

/** The best candidate: highest score, then newest. */
export function topPick<T extends { t: number }>(cands: readonly { item: T; s: Scored }[]): { item: T; s: Scored } | null {
  let top: { item: T; s: Scored } | null = null;
  for (const c of cands) if (!top || c.s.score > top.s.score || (c.s.score === top.s.score && c.item.t > top.item.t)) top = c;
  return top;
}
