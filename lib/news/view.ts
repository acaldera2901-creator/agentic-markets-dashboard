// lib/news/view.ts (#NEWS-FOTMOB-PROD-1026) — pure helpers between the feed
// and the three places that show it: the News section of /blog (A), the
// «Latest news» strip on the board (B), the News card of the match sheet (C).
// No React, no Next, no Date.now(): every function takes `now`. Times are
// Rome's, on purpose (the brief): one clock for every visitor, declared once.
import { fillNews, newsCopy, type NewsCopy } from "./copy";
import { matchTeams } from "./teams";
import type { NewsCard, NewsFeed } from "./table";

export const ROME_TZ = "Europe/Rome";

/** «14:21» in Rome, whatever the visitor's clock. */
export function timeRome(t: number, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ROME_TZ }).format(new Date(t));
}

/** «Mon 26 Oct» in Rome, for a note older than today. */
export function dayRome(t: number, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: ROME_TZ }).format(new Date(t));
}

/** Same calendar day in Rome? */
export function sameRomeDay(a: number, b: number): boolean {
  const f = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: ROME_TZ });
  return f.format(new Date(a)) === f.format(new Date(b));
}

/** «12 minutes ago» / «3 hours ago» / «yesterday» in the page language. */
export function relativeLabel(t: number, now: number, locale = "en"): string {
  const f = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const min = Math.round((t - now) / 60_000);
  if (Math.abs(min) < 60) return f.format(min, "minute");
  const h = Math.round(min / 60);
  if (Math.abs(h) < 24) return f.format(h, "hour");
  return f.format(Math.round(h / 24), "day");
}

/** The text the visitor reads: IT for Italian, EN otherwise (tagged «In English» outside EN/IT). */
export function noteText(card: NewsCard, lang: string): { title: string; body: string; english: boolean } {
  const t = lang === "it" ? card.note.it : card.note.en;
  return { title: t.title, body: t.body, english: lang !== "en" && lang !== "it" };
}

/** One board match a note names, for the «On the board» link (made in the browser, where the board is). */
export type BoardMatch = { id: string; home: string; away: string; league?: string | null };

/** The board matches (at most two) whose home or away team a note names; a match naming both teams comes first. */
export function matchesForNote(card: NewsCard, board: readonly BoardMatch[]): BoardMatch[] {
  if (!card.teams.length || !board.length) return [];
  const found = matchTeams(card.teams.join(". "), board.flatMap((m) => [m.home, m.away]));
  if (!found.size) return [];
  const hits = (m: BoardMatch) => Number(found.has(m.home)) + Number(found.has(m.away));
  return board
    .map((m, i) => ({ m, n: hits(m), i }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, 2)
    .map((x) => x.m);
}

/** The notes that name either team of a match, newest first (the match sheet). */
export function notesForMatch(cards: readonly NewsCard[], home: string, away: string): NewsCard[] {
  return cards.filter((c) => c.teams.length && matchTeams(c.teams.join(". "), [home, away]).size > 0).sort((a, b) => b.t - a.t);
}

/** One row of the News section / strip / card, with every string already in the page language. */
export type NewsRow = {
  key: string;
  /** «14:21», Rome */
  time: string;
  /** «12 minutes ago» when `now` is known, else the day («Mon 26 Oct») for a note not of today, else "" */
  ago: string;
  /** the ISO instant, for <time dateTime> */
  iso: string;
  source: string;
  title: string;
  body: string;
  /** the language of title/body, for lang= */
  textLang: "en" | "it";
  /** «In English» tag outside EN/IT */
  english: boolean;
  url: string;
  aiLabel: string;
};

/** The mapping note → row. `now` null = before mount: no relative time (never a hydration mismatch). */
export function rowFor(card: NewsCard, lang: string, now: number | null, copy: NewsCopy = newsCopy(lang)): NewsRow {
  const x = noteText(card, lang);
  const ago = now != null ? relativeLabel(card.t, now, lang) : "";
  return {
    key: card.guid,
    time: timeRome(card.t, lang),
    ago: ago || (now != null && !sameRomeDay(card.t, now) ? dayRome(card.t, lang) : ""),
    iso: new Date(card.t).toISOString(),
    source: card.source,
    title: x.title,
    body: x.body,
    textLang: lang === "it" ? "it" : "en",
    english: x.english,
    url: card.url,
    aiLabel: fillNews(copy.aiLabel, { source: card.source }),
  };
}

/** The strip on the board: at most `max` notes, newest first. Anything but «ok» → nothing (the strip hides). */
export function stripCards(feed: NewsFeed, max = 3): NewsCard[] {
  return feed.state === "ok" ? feed.cards.slice(0, max) : [];
}

/** The header line of the section: «Updated at 14:21» / «Last update at 12:03» / «News paused». */
export function updatedLine(feed: NewsFeed, lang: string, copy: NewsCopy = newsCopy(lang)): string {
  if (feed.state === "ok" || feed.state === "empty") return fillNews(copy.updatedAt, { time: timeRome(feed.updatedAt, lang) });
  if (feed.state === "paused") return feed.since != null ? `${copy.pausedMeta} · ${fillNews(copy.lastUpdateAt, { time: timeRome(feed.since, lang) })}` : copy.pausedMeta;
  return "";
}

/** The message of a feed that has no notes to show; null when there are notes (or the news is off). */
export function stateMessage(feed: NewsFeed, copy: NewsCopy): string | null {
  switch (feed.state) {
    case "empty": return copy.pending;
    case "paused": return copy.paused;
    case "error": return copy.error;
    default: return null;
  }
}
