// lib/news/view.ts (#NEWS-FOTMOB-PROD-1026) — pure helpers between the feed
// and the three places that show it: the News section of /blog (A), the
// «Latest news» strip on the board (B), the News card of the match sheet (C).
// No React, no Next, no Date.now(): every function takes `now`. Times are
// Rome's, on purpose (the brief): one clock for every visitor, declared once.
import { noteBadges, type ClubBadge } from "./clubs";
import { fillNews, newsCopy, type NewsCopy } from "./copy";
import { dedupeKinds, newsImage, newsKind, type NewsImage, type NewsKind } from "./kind";
import type { NoteImage } from "./per-note";
import { matchTeams } from "./teams";
import type { NewsCard, NewsFeed } from "./table";

/**
 * What leaves the server for the browser (the /blog list, /api/news): a note
 * without its source name or source URL — nothing on the wire points back to
 * the source. The picture made for the note is resolved here, server side,
 * from the URL the card keeps in the data layer.
 */
export type WireCard = { guid: string; t: number; note: NewsCard["note"]; teams: string[]; image: NoteImage | null };
export type WireFeed = Exclude<NewsFeed, { state: "ok" }> | { state: "ok"; updatedAt: number; cards: WireCard[] };
export type AnyCard = NewsCard | WireCard;

/** `own` = the picture made for a data card (lib/news/per-note.server.ts noteImage; server only, so it is passed in). */
export const wireCard = (c: NewsCard, own: (c: NewsCard) => NoteImage | null): WireCard => ({ guid: c.guid, t: c.t, note: c.note, teams: c.teams, image: own(c) });

export function wireFeed(feed: NewsFeed, own: (c: NewsCard) => NoteImage | null): WireFeed {
  return feed.state === "ok" ? { state: "ok", updatedAt: feed.updatedAt, cards: feed.cards.map((c) => wireCard(c, own)) } : feed;
}

/** The picture made for this note, whichever side of the wire the card is on. */
/** Only a wire card carries its own picture: a data card is resolved at the wire (wireFeed), never here. */
const ownImage = (c: AnyCard): NoteImage | null => ("image" in c ? c.image : null);

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
export function noteText(card: AnyCard, lang: string): { title: string; body: string; english: boolean } {
  const t = lang === "it" ? card.note.it : card.note.en;
  return { title: t.title, body: t.body, english: lang !== "en" && lang !== "it" };
}

/** One board match a note names, for the «On the board» link (made in the browser, where the board is). */
export type BoardMatch = { id: string; home: string; away: string; league?: string | null };

/** The board matches (at most two) whose home or away team a note names; a match naming both teams comes first. */
export function matchesForNote(card: AnyCard, board: readonly BoardMatch[]): BoardMatch[] {
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
export function notesForMatch<C extends AnyCard>(cards: readonly C[], home: string, away: string): C[] {
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
  title: string;
  body: string;
  /** the language of title/body, for lang= */
  textLang: "en" | "it";
  /** «In English» tag outside EN/IT */
  english: boolean;
  /** the kind of story, from its words (lib/news/kind.ts) */
  kind: NewsKind;
  /** the picture made for this note (lib/news/per-note.ts, with its png fallback) or else our 16:9 picture for its kind; null when we have none */
  image: NoteImage | NewsImage | null;
  /** the clubs the note names (max two, in order): real crest and colours when we have them (lib/news/clubs.ts) */
  badges: ClubBadge[];
};

/** The mapping note → row. `now` null = before mount: no relative time (never a hydration mismatch). `kind` given = already de-duplicated by rowsFor. */
export function rowFor(card: AnyCard, lang: string, now: number | null, kind: NewsKind = newsKind(card)): NewsRow {
  const x = noteText(card, lang);
  const ago = now != null ? relativeLabel(card.t, now, lang) : "";
  return {
    key: card.guid,
    time: timeRome(card.t, lang),
    ago: ago || (now != null && !sameRomeDay(card.t, now) ? dayRome(card.t, lang) : ""),
    iso: new Date(card.t).toISOString(),
    title: x.title,
    body: x.body,
    textLang: lang === "it" ? "it" : "en",
    english: x.english,
    kind,
    image: ownImage(card) ?? newsImage(kind),
    badges: noteBadges(`${card.note.en.title} ${card.note.it.title}`, `${card.note.en.body} ${card.note.it.body}`, card.teams),
  };
}

/** A list of rows in page order, no two neighbours on the same kind picture (lib/news/kind.ts dedupeKinds); a note with its own picture breaks the chain. */
export function rowsFor(cards: readonly AnyCard[], lang: string, now: number | null): NewsRow[] {
  const kinds = cards.map(newsKind);
  const out = [...kinds];
  let start = 0;
  for (let i = 0; i <= cards.length; i++) {
    if (i === cards.length || ownImage(cards[i])) {
      const seg = dedupeKinds(kinds.slice(start, i));
      for (let j = 0; j < seg.length; j++) out[start + j] = seg[j];
      start = i + 1;
    }
  }
  return cards.map((c, i) => rowFor(c, lang, now, out[i]));
}

/** The strip on the board: at most `max` notes, newest first. Anything but «ok» → nothing (the strip hides). */
export function stripCards<F extends NewsFeed | WireFeed>(feed: F, max = 3): (F extends { state: "ok"; cards: (infer C)[] } ? C : never)[] {
  return (feed.state === "ok" ? feed.cards.slice(0, max) : []) as ReturnType<typeof stripCards<F>>;
}

/** The header line of the section: «Updated at 14:21» / «Last update at 12:03» / «News paused». */
export function updatedLine(feed: NewsFeed | WireFeed, lang: string, copy: NewsCopy = newsCopy(lang)): string {
  if (feed.state === "ok" || feed.state === "empty") return fillNews(copy.updatedAt, { time: timeRome(feed.updatedAt, lang) });
  if (feed.state === "paused") return feed.since != null ? `${copy.pausedMeta} · ${fillNews(copy.lastUpdateAt, { time: timeRome(feed.since, lang) })}` : copy.pausedMeta;
  return "";
}

/** The message of a feed that has no notes to show; null when there are notes (or the news is off). */
export function stateMessage(feed: NewsFeed | WireFeed, copy: NewsCopy): string | null {
  switch (feed.state) {
    case "empty": return copy.pending;
    case "paused": return copy.paused;
    case "error": return copy.error;
    default: return null;
  }
}
