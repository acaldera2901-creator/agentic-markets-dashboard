// lib/v3c/news/card-emma.ts — the «emma» image style (NEWS_IMAGE_STYLE=emma): the BetRedge social look
// (Emma's style-guide v2, drafts/social/2026-11-05-news-sito-stile/): real photo of the person + italic headline + lime,
// crests and a result badge, VERTICAL 4:5. Pure: CardSpec (+ optional assets) in, prompt out.
// Reference images (photo, crests) go to `codex exec -i` — the prompt only says which is which. The BetRedge logo is NEVER
// drawn by the model: the top-left corner stays empty and the logo is composed locally afterwards.
// No runtime import from ./card (it imports this file): types only, the mood comes from the CardSpec (#M3).
import type { CardSpec } from "./card";

export const NEWS_IMAGE_STYLES = ["legacy", "emma"] as const;
export type NewsImageStyle = (typeof NEWS_IMAGE_STYLES)[number];

/** Anything but exactly «emma» is legacy (default; a typo never changes the pictures). */
export const imageStyle = (raw: string | undefined): NewsImageStyle => (raw?.trim().toLowerCase() === "emma" ? "emma" : "legacy");

/** Output size of the vertical card (4:5), what the model is asked for and what postProcess must produce. */
export const EMMA_SIZE = { width: 1080, height: 1350 } as const;

/** What the pipeline found for this note. All optional: nothing found = generic scene, no crest, text from the card only. */
export type EmmaAssets = {
  /** Real photo of the person is attached as reference image 1 (name only for the prompt, e.g. «Raphinha»). */
  photo?: { person: string; kitNote?: string };
  /** Official crests attached as reference images (after the photo), in order; names only, never invented. */
  crests?: string[];
  headline?: string[]; // 1-3 lines, from the rewritten note
  subtitle?: string; // one line, from the note
  label?: string; // «NEWS» or «NEWS · <COMPETITION>» only if the note names it
};

const clean = (s: string) => s.replace(/["`/]/g, " ").replace(/\s+/g, " ").trim();
const ORD = ["first", "second", "third"];

/**
 * The words the card shows, and nothing else: label, headline lines, subtitle, badge. The visual check compares against `expected`.
 * Headline: assets, else the card's caption, else its score/count; a headline that IS the score gets no badge (#M2: no duplicate);
 * a card with no text at all has no headline and no badge (#M5: never an empty badge).
 */
export function emmaText(c: CardSpec, a: EmmaAssets = {}): { label: string; headline: string[]; subtitle: string | null; badge: string | null; expected: string } {
  const label = clean(a.label ?? "NEWS");
  const given = (a.headline ?? []).map(clean).filter(Boolean).slice(0, 3);
  const caption = clean(c.text.words ?? "");
  const big = clean(c.text.big ?? "");
  const headline = given.length ? given : caption ? [caption] : big ? [big] : [];
  const fromBig = !given.length && !caption && !!big;
  const inHeadline = (s: string) => !!s && given.join(" ").toUpperCase().includes(s.toUpperCase());
  // a given headline (the note's title): the figure, or else the caption («INJURY», «WINNER»), is at most a badge — and never one the headline already says
  const badge = given.length
    ? (big && c.text.type !== "none" && !inHeadline(big) ? big : caption && !inHeadline(caption) ? caption : null)
    : !fromBig && big && c.text.type !== "none" ? big : null;
  const subtitle = a.subtitle ? clean(a.subtitle) || null : null;
  return { label, headline, subtitle, badge, expected: [label, ...headline, subtitle, badge].filter(Boolean).join(" ") };
}

export function emmaCardPrompt(c: CardSpec, a: EmmaAssets = {}): string {
  const mood = c.mood ?? "calm and focused";
  const t = emmaText(c, a);
  const crests = (a.crests ?? []).map(clean).filter(Boolean).slice(0, 2);
  const refs: string[] = [];
  if (a.photo) refs.push(`Reference image 1 is a real photo of ${clean(a.photo.person)}: keep face, hair and the kit with ALL its original marks (club badge, sponsor, brand) exactly as in the photo, do not alter, remove or add any mark${a.photo.kitNote ? ` (${clean(a.photo.kitNote)})` : ""}.`);
  if (crests.length) refs.push(`Reference image${crests.length > 1 ? "s" : ""} ${a.photo ? 2 : 1}${crests.length > 1 ? `-${(a.photo ? 1 : 0) + crests.length}` : ""} ${crests.length > 1 ? "are the official crests" : "is the official crest"} (${crests.join(", ")}): reproduce faithfully, never redraw or invent a crest.`);
  const person = a.photo
    ? `The person from the photo, cut out and re-lit as a dramatic night-stadium portrait, large and centred in the UPPER 60% of the frame, from the waist up, keep the person's expression exactly as in the photo (do not make them smile or celebrate), rim light in neon lime #C8FF00 on the contours; a few sharp lime lightning/slash shapes behind.`
    : `${c.figure}, anonymous (no recognisable real face, plain kit with no marks), large in the UPPER 60% of the frame, mood: ${mood}, rim light in neon lime #C8FF00 on the contours; a few sharp lime lightning/slash shapes behind.`;
  const bottom = [crests.length ? "the crest(s) from the reference image(s)" : "", t.badge ? `a skewed lime #C8FF00 badge with black italic bold text: ${t.badge}` : ""].filter(Boolean).join(" next to ");
  const lines = t.headline.length === 1 ? `on one line: ${t.headline[0]}` : `on ${t.headline.length} lines, ${t.headline.map((h, i) => `${ORD[i]} line ${h}`).join(", ")}`; // #M1: no «/» for the model to draw
  return [
    `Create a 4:5 vertical portrait sports-news graphic, ${EMMA_SIZE.width}x${EMMA_SIZE.height} px, in the BetRedge social style.`,
    ...refs,
    `Scene: realistic photographic night stadium, deep navy blue atmosphere (#071329 to #0A1B35), bright floodlights with royal blue (#145AFF) and sky blue (#81D9FF) beams and haze, crowd silhouette far behind. ${person}`,
    `LOWER 38% of the frame, left-aligned text block over a dark navy gradient fade, exactly this and nothing else:`,
    `- a small skewed lime #C8FF00 label with black italic condensed uppercase text: ${t.label}`,
    ...(t.headline.length ? [`- huge white italic condensed uppercase headline ${lines}`, `- a thin lime underline slash under the headline`] : []),
    ...(t.subtitle ? [`- white italic subtitle: ${t.subtitle}`] : []),
    ...(bottom ? [`- bottom-left: ${bottom}`] : []),
    `Keep the TOP-LEFT corner (about 40% width, 9% height) completely empty dark navy: the BetRedge logo is added later, never draw a logo. Keep the top-right corner clean; the head sits below that area. No other text, letters, numbers, watermarks, no betting symbols, no money, no age limits and no disclaimer anywhere. All text fully inside the frame with safe margins. Do not crop the head: leave clear dark space (at least 5% of the height) above the top of the hair.${bottom ? " The bottom-left element(s) must sit fully inside the frame with a clear margin of at least 6% of the height below them, never touching or crossing the bottom edge." : ""} Output a single finished image.`,
  ].join("\n");
}

/**
 * The card's headline from the REWRITTEN note's title (G5, orchestratore finding 1): 1–3 short lines, balanced by words, so a note whose
 * card has no caption and no figure does not come out with the label «NEWS» alone. Longer than 9 words → none (a cut title would change the sense).
 */
const MAX_HEADLINE_WORDS = 7;
const FILLER = new Set(["the", "a", "an", "of", "in", "on", "at", "for", "to", "as", "over", "against", "that", "with", "by", "from", "after", "has", "have", "had", "is", "are", "was", "were", "wanted", "will"]);
const DANGLING = new Set([...FILLER, "and", "but", "or", "until", "while", "back"]);
/** Title → at most 7 words (Emma's rule: the note's title, shortened, never a single generic word): drop filler words after the first, then cut, never ending on a dangling word. */
// T17 (11/11): the 7-word cut produced half sentences («…HEART TREATMENT TWO DAYS» for «…two days before the World Cup»). A title that is too long first loses
// its TRAILING clause (from the last «before/after/amid/while/against/ahead» or a comma/semicolon), plus a dangling «two days» time span, and only then is cut by words.
const CLAUSE = new Set(["before", "after", "amid", "while", "against", "ahead", "despite", "following"]);
const SPAN = /(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:minutes?|hours?|days?|weeks?|months?|years?)$/i;
function dropTrailingClause(words: string[]): string[] {
  for (let i = words.length - 1; i >= 3; i--) {
    const prev = words[i - 1];
    const punct = /[,;]$/.test(prev);
    if (!punct && !CLAUSE.has(words[i].toLowerCase())) continue;
    let head = punct ? [...words.slice(0, i - 1), prev.replace(/[,;]$/, "")] : words.slice(0, i);
    const m = SPAN.exec(head.join(" "));
    const n = m ? m[0].split(" ").length : 0;
    if (n && head.length - n >= 3) head = head.slice(0, head.length - n);
    if (head.length >= 3 && head.length <= MAX_HEADLINE_WORDS + 1) return head;
  }
  return words;
}
function shorten(words: string[]): string[] {
  let w = dropTrailingClause(words);
  for (let i = w.length - 1; i > 0 && w.length > MAX_HEADLINE_WORDS; i--) if (FILLER.has(w[i].toLowerCase())) w = [...w.slice(0, i), ...w.slice(i + 1)];
  w = w.slice(0, MAX_HEADLINE_WORDS);
  while (w.length > 2 && DANGLING.has(w[w.length - 1].toLowerCase())) w = w.slice(0, -1);
  return w;
}
export function headlineLines(title: string): string[] {
  let words = clean(title).replace(/[.!?]+$/, "").split(" ").filter(Boolean);
  // Emma's rule: the title as it is up to ~60 characters; longer (or > 11 words) → shortened to 7 words
  if (words.length > 11 || clean(title).length > 60) words = shorten(words);
  if (words.length < 2) return [];
  const n = words.length <= 3 ? 1 : words.length <= 6 ? 2 : 3;
  // even split (7 words → 3+2+2, never a lone word on the last line)
  const base = Math.floor(words.length / n), extra = words.length % n;
  let at = 0;
  return Array.from({ length: n }, (_, i) => { const len = base + (i < extra ? 1 : 0); const line = words.slice(at, at + len).join(" "); at += len; return line; }).filter(Boolean);
}
