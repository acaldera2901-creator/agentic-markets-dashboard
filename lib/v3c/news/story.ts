// lib/v3c/news/story.ts — «is this the same story we already have?», asked BEFORE the
// paid rewrite. The guid/url dedup (watcher.ts) misses the same match told by two
// sources: on 05/11 the site published «Crystal Palace take a point versus Hoffenheim»
// (21:46) and «Crystal Palace and Hoffenheim draw 1-1 after Kamada's late leveller»
// (19:56). Deterministic and conservative: a missed duplicate is better than a
// different story dropped, so every rule is time-windowed and needs two signals.
//  - match report: BOTH titles read as a result (a score or a result word) AND name
//    the same two clubs/people (capitalised name runs) — inside STORY_WINDOW_MS only,
//    so the same fixture months apart never merges.
//  - any other news: title-token Jaccard ≥ TITLE_JACCARD_MIN on ≥ MIN_TOKENS words each.
import { words } from "./rewrite";

/** Two items further apart than this (source time) are never the same story. */
export const STORY_WINDOW_MS = 36 * 3_600_000;
export const TITLE_JACCARD_MIN = 0.6;
const MIN_TOKENS = 4;

/** What the watcher keeps of a story it queued or published (original title stays local, like the queue file). */
export type StoryKey = { at: number; title: string };

const RESULT = /\b\d{1,2}\s*[-–]\s*\d{1,2}\b|\b(draws?|drew|drawn|beats?|beaten|wins?|won|victory|defeats?|defeated|loses?|lost|loss|points?|held|edges?|edged|thrash(es|ed)?|stuns?|stunned|routs?|routed|hammers?|hammered|sinks?|sank|leveller|equali[sz]er|stalemate|comeback|fightback)\b/i;
/** Capitalised words that open a title without being a name. */
const NOT_NAMES = new Set(["the", "a", "an", "report", "watch", "live", "breaking", "why", "how", "what", "who", "when", "after", "late", "big", "new"]);
/** A competition is not a club: two different matches of the same league share it. */
const COMPETITION = /\b(league|liga|cup|serie|bundesliga|ligue|eredivisie|champions|europa|conference|uefa|fifa|mls|premier|world|nations|copa|coppa|pokal|supercup)\b/;
const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "at", "by", "with", "as", "is", "are", "was", "his", "her", "their", "after", "from", "into", "over", "vs", "versus"]);

/** Runs of capitalised words, possessive cut («Kamada's» → kamada, and it ends the run). */
export function names(title: string): string[] {
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length) out.push(run.join(" "));
    run = [];
  };
  for (const raw of title.split(/\s+/)) {
    const poss = /['’]s\W*$/.test(raw);
    const w = raw.replace(/['’]s\W*$/, "").replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    if (!w || !/^\p{Lu}/u.test(w) || (run.length === 0 && NOT_NAMES.has(w.toLowerCase()))) {
      flush();
      continue;
    }
    run.push(words(w).join(" "));
    if (poss || /[,:;.!?]$/.test(raw)) flush();
  }
  flush();
  return [...new Set(out.filter((n) => n && !COMPETITION.test(n)))];
}

/** «palace» and «crystal palace» are the same name: one's words inside the other's. */
const sameName = (a: string, b: string): boolean => {
  const [s, l] = a.length <= b.length ? [a.split(" "), new Set(b.split(" "))] : [b.split(" "), new Set(a.split(" "))];
  return s.every((w) => l.has(w));
};

const tokens = (t: string): Set<string> => new Set(words(t).filter((w) => w.length >= 3 && !STOP.has(w)));

/** The reason `a` and `b` are the same story, or null. */
export function sameStory(a: StoryKey, b: StoryKey): string | null {
  if (Math.abs(a.at - b.at) > STORY_WINDOW_MS) return null;
  if (RESULT.test(a.title) && RESULT.test(b.title)) {
    const na = names(a.title);
    const nb = names(b.title);
    const shared = na.filter((x) => nb.some((y) => sameName(x, y)));
    if (shared.length >= 2) return `same match (${shared.slice(0, 2).join(" · ")})`;
  }
  const ta = tokens(a.title);
  const tb = tokens(b.title);
  if (ta.size >= MIN_TOKENS && tb.size >= MIN_TOKENS) {
    const inter = [...ta].filter((w) => tb.has(w)).length;
    const j = inter / (ta.size + tb.size - inter);
    if (j >= TITLE_JACCARD_MIN) return `same title (overlap ${j.toFixed(2)})`;
  }
  return null;
}

/** The first story of `known` that `cand` repeats, as a reason. */
export function repeats(cand: StoryKey, known: readonly StoryKey[]): string | null {
  for (const k of known) {
    const why = sameStory(cand, k);
    if (why) return `duplicate story: ${why} — «${k.title.slice(0, 60)}»`;
  }
  return null;
}
