// lib/v3c/news/card.ts (#NEWSWATCH-2-IMG) — the picture of a note is a flat
// GRAPHIC CARD, not a photograph (Andrea 29/10, art direction «stile v3 inspo»,
// preview-news-prod/2026-10-29-stile-v3-inspo/README.md). Pure:
//  - cardText: the one word / number the card shows, taken ONLY from our rewritten
//    note (a score, «last 16», an ordinal, «N straight wins», a keyword) — never a
//    name, never anything the note does not say;
//  - pickCard: the format from a rotation over the last published cards («never two
//    alike»: adjacent cards differ in format AND dominant element, the same club in
//    the window gets another format, a (format, block) pair is not repeated);
//  - cardPrompt: the `gptimg -r` prompt (flat, faceless FILLED silhouettes from the
//    knees up, top corners free for the crests the site lays on top, one club colour);
//  - tooSimilar: the mechanical anti-duplicate on dHash 8×8 + 4×4 colour signature.
import { createHash } from "node:crypto";
import { words, type NoteText } from "./rewrite";
import type { SceneKind } from "./image";

export type TextType = "score" | "count" | "word" | "none";
/** `big`: the giant numeral/score; `words`: the condensed caption. Both from the note. */
export type CardText = { type: TextType; big?: string; words?: string };

const NUM: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const ORD: Record<string, string> = { first: "1ST", second: "2ND", third: "3RD", fourth: "4TH", fifth: "5TH", sixth: "6TH", seventh: "7TH", eighth: "8TH", ninth: "9TH", tenth: "10TH" };
/** Keywords a card may show, in priority order; each ≤ 8 characters. Only used when the note writes them. */
const KEYWORDS = ["unbeaten", "comeback", "history", "record", "derby", "playoffs", "playoff", "debut", "return", "focus", "unity", "injury", "injured", "loan", "sacked", "exit", "draw", "winner", "defeat", "loss", "title", "trophies", "trophy", "final", "victory", "win", "points", "pressure", "praise"];

/** The text must fit: one line of ≤ 8 characters, or two lines (split at a space or hyphen) of ≤ 10. */
export function fits(s: string): boolean {
  if (s.length <= 8) return true;
  for (let i = 1; i < s.length - 1; i++) {
    if (s[i] !== " " && s[i] !== "-") continue;
    const a = s.slice(0, s[i] === "-" ? i + 1 : i).trim();
    const b = s.slice(i + 1).trim();
    if (a.length <= 10 && b.length <= 10) return true;
  }
  return false;
}

export function cardText(note: NoteText): CardText {
  const src = `${note.title}. ${note.body}`;
  const score = src.match(/\b(\d{1,2})-(\d{1,2})\b/);
  if (score) return { type: "score", big: `${score[1]}-${score[2]}` };
  const count = src.match(/\b(two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\s+(straight|consecutive|successive)\s+(wins|victories|defeats|losses|games|matches)\b/i);
  if (count) {
    const n = NUM[count[1].toLowerCase()] ?? Number(count[1]);
    const w = `${count[2]} ${count[3]}`.toUpperCase();
    if (fits(w)) return { type: "count", big: String(n), words: w };
  }
  const goals = src.match(/\b(\d{2,3})\s+(?:[A-Z]{2,4}\s+|career\s+|league\s+)?goals\b/);
  if (goals) return { type: "count", big: goals[1], words: "GOALS" };
  const stage = src.match(/\blast\s+(16|32|8)\b|\b(quarter|semi)-?finals?\b/i);
  if (stage) return { type: "word", words: stage[1] ? `LAST ${stage[1]}` : stage[2].toLowerCase() === "quarter" ? "QUARTER-FINALS" : "SEMI-FINAL" };
  const ord = src.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d{1,2}(?:st|nd|rd|th))\s+(?:[A-Za-z]+\s+){0,3}?(win|loss|defeat|goal|title|victory)\b/i);
  if (ord) {
    const o = ORD[ord[1].toLowerCase()] ?? ord[1].toUpperCase();
    return { type: "word", words: `${o} ${ord[2].toUpperCase()}` };
  }
  for (const part of [note.title, note.body]) {
    const w = new Set(words(part));
    for (const k of KEYWORDS) if (w.has(k)) return { type: "word", words: k.toUpperCase() };
  }
  return { type: "none" };
}

/** What the visual check must read, nothing else: the card's text tokens (or none). */
export const expectedText = (t: CardText): string => [t.big, t.words].filter(Boolean).join(" ");

// ─── formats and the rotation ────────────────────────────────────────────────

export type Format = "split" | "score" | "quote" | "cutout" | "number" | "band";
export type Dominant = "figure" | "number" | "word";
const FORMATS: Record<Format, { dominant: Dominant; blocks: string[] }> = {
  split: { dominant: "figure", blocks: ["right", "left"] },
  score: { dominant: "number", blocks: ["left", "right"] },
  quote: { dominant: "word", blocks: ["full"] },
  cutout: { dominant: "figure", blocks: ["full"] },
  number: { dominant: "number", blocks: ["left", "right"] },
  band: { dominant: "word", blocks: ["lower"] },
};
/** Which formats can carry which text. */
const FOR_TEXT: Record<TextType, Format[]> = {
  score: ["score", "band", "split"],
  count: ["number", "band", "split"],
  word: ["quote", "band", "split", "cutout"],
  // no text: no band, no frame (an empty one reads as a placeholder — art direction 29/10)
  none: ["split", "cutout"],
};
/** A colour for a note with no club colour: never the navy ink, one of these by the note's hash. */
export const NEUTRAL_TINTS = ["cobalt blue", "teal", "coral red", "amber"];
export const WINDOW = 12;

export type CardSpec = { format: Format; block: string; dominant: Dominant; tint: string | null; club: string | null; text: CardText; figure: string; object: string; kind?: SceneKind; mood?: string; quoted?: boolean };
/** One published card, as the rotation and the duplicate check remember it. */
export type LedgerRow = { at: number; format: Format; block: string; dominant: Dominant; tint: string | null; club: string | null; dhash?: string; csig?: number[]; figure?: string };

/** Two poses per scene: two notes of the same kind in a row never get the same composition (30/10: Arsenal and Tottenham, same hug). */
const FIGURE: Record<SceneKind, [string, string]> = {
  unity: ["four footballers huddled together, seen from behind", "a line of three footballers standing shoulder to shoulder, seen from behind"],
  late: ["a footballer celebrating with both arms raised, seen from behind", "a footballer sliding on his knees in celebration, seen from the side"],
  win: ["two footballers celebrating together, seen from behind", "a single footballer punching the air with one fist, seen from the side"],
  loss: ["a footballer standing with head bowed and hands on his hips, seen from behind", "a footballer crouching with his head down and forearms on his knees, seen from the side"],
  preview: ["a footballer standing ready with one foot on a ball, looking ahead, seen from behind", "two footballers walking out side by side towards the pitch, seen from behind"],
  coach: ["a head coach in a long plain coat with arms folded", "a head coach in a long plain coat pointing forward, seen from the side"],
  exit: ["a footballer walking away with head lowered, seen from behind", "a footballer sitting on the grass with head in his hands, seen from the side"],
  injury: ["a footballer kneeling on the grass holding his knee, seen from the side", "a footballer limping off with one arm over a teammate's shoulder, seen from behind"],
  transfer: ["a footballer walking with a plain holdall bag over his shoulder, seen from behind", "a footballer standing calmly holding up a plain blank shirt, seen from behind"],
  lineup: ["a row of plain shirts hanging on hooks, no people", "a plain tactics board with magnets on it, no people"],
  award: ["a generic plain trophy with no engraving, no people", "a generic plain medal on a ribbon, no people"],
  other: ["a footballer standing with a ball under his arm, seen from behind", "a footballer jogging with a ball at his feet, seen from the side"],
};
/** The mood the pose and the word must share; the visual check gets it too. */
export const MOOD: Record<SceneKind, string> = {
  win: "joyful celebration",
  late: "joyful celebration",
  unity: "together, determined",
  loss: "dejected or neutral — NEVER celebrating, no raised arms or fists",
  exit: "dejected — NEVER celebrating, no raised arms or fists",
  injury: "concerned — NEVER celebrating, no raised arms or fists",
  preview: "anticipation, calm and focused — not celebrating yet",
  transfer: "neutral and calm — no celebration",
  coach: "neutral and serious — no celebration",
  lineup: "neutral",
  award: "neutral",
  other: "neutral and calm — no celebration",
};
/** The card's word decides the mood when it has one: «DEFEAT» is never drawn as a win. */
const WORD_KIND: Record<string, SceneKind> = { DEFEAT: "loss", LOSS: "loss", WIN: "win", VICTORY: "win", WINNER: "win", EXIT: "exit", INJURY: "injury", INJURED: "injury", LOAN: "transfer" };
export function cardKind(kind: SceneKind, text: CardText): SceneKind {
  const last = text.words?.split(" ").at(-1);
  const w = last ? WORD_KIND[last] : undefined;
  if (w === "win" && kind === "preview") return kind; // «a win could take them top»: not won yet
  return w || kind;
}
const OBJECTS = ["a huge classic soccer ball with clearly visible black pentagon and white hexagon panels (never a blank white circle), no logo", "a huge plain black football boot with no brand marks", "a generic plain silver trophy with no engraving"];

const seed = (s: string): number => parseInt(createHash("sha256").update(s).digest("hex").slice(0, 8), 16);

export function violations(c: { format: Format; block: string; dominant: Dominant; club: string | null; tint: string | null; figure?: string }, ledger: readonly LedgerRow[]): string[] {
  const recent = ledger.slice(-WINDOW);
  const out: string[] = [];
  const last = recent.at(-1);
  if (last && (last.format === c.format || last.dominant === c.dominant)) out.push("adjacent: same format or dominant");
  if (c.club && recent.some((r) => r.club === c.club && r.format === c.format)) out.push("same club, same format in window");
  if (recent.some((r) => r.format === c.format && r.block === c.block)) out.push("same format+block in window");
  // on flat cards the colour block is what the eye sees: same format + same tint = the same card
  if (recent.some((r) => r.format === c.format && r.tint === c.tint)) out.push("same format+tint in window");
  // the composition: the same pose in the last 3 cards reads as the same picture whatever the colour
  if (c.figure && recent.slice(-3).some((r) => r.figure === c.figure)) out.push("same figure in the last 3");
  return out;
}

/** Deterministic per note: start from its hash, take the first legal (format, block); else the least bad. */
/** Quote marks only on a real quote: the note itself carries words in quotation marks (30/10: «“ PLAYOFF» on plain news). */
export const hasQuote = (n: { title: string; body: string }): boolean => /[“”«»"]\s*\S[^“”«»"]{2,}[“”«»"]/.test(`${n.title} ${n.body}`);

export function pickCard(guidHash: string, kind: SceneKind, text: CardText, tint: string | null, club: string | null, ledger: readonly LedgerRow[], quoted = false): CardSpec {
  const k = cardKind(kind, text);
  const figs = FIGURE[k];
  const f0 = seed(`${guidHash}:fig`) % 2;
  const cands = [figs[f0], figs[1 - f0]].flatMap((figure) => FOR_TEXT[text.type].flatMap((f) => FORMATS[f].blocks.map((b) => ({ format: f, block: b, dominant: FORMATS[f].dominant, club, tint, figure }))));
  const start = seed(guidHash) % (cands.length / 2); // the note's own pose first, the other only if needed
  let best = cands[start];
  let bestV = Infinity;
  for (let k = 0; k < cands.length; k++) {
    const c = cands[(start + k) % cands.length];
    const v = violations(c, ledger).length;
    if (v < bestV) {
      best = c;
      bestV = v;
    }
    if (v === 0) break;
  }
  return { ...best, tint, text, kind: k, mood: MOOD[k], quoted, object: OBJECTS[seed(`${guidHash}:obj`) % OBJECTS.length] };
}

/** The tint of the card: the club's colour, else a neutral one picked by the note's hash. */
export function cardTint(clubTint: string | null, guidHash: string): string {
  return clubTint ?? NEUTRAL_TINTS[seed(`${guidHash}:tint`) % NEUTRAL_TINTS.length];
}

// ─── the prompt ──────────────────────────────────────────────────────────────

const CARD_GRAMMAR = "Flat graphic sports-news card, wide 16:9, bold editorial poster style, NOT a photograph: crisp vector-like shapes, hard shadows, bright saturated high-key colours, no dark cinematic mood, no glow. Grammar: ONE dominant element; ONE flat solid block of the club colour;";
export const CARD_STYLE =
  `${CARD_GRAMMAR} condensed white uppercase typography with a thin white hairline frame; deep navy #071329 used only as the ink/secondary tone. Keep the TOP-LEFT and TOP-RIGHT corners clean and empty (plain background only) for badges added later. STRICT: every human figure is a stylised flat silhouette FILLED with solid colour — no face, no facial features, never an empty or blank face outline, no skin-coloured blank head; figures framed from the knees up so no boots are visible; no club crest, no logo, no brand marks, no swoosh or stripes on any clothing or shoe, no sponsor, no official kit design, no two-tone kit; NO other text, letters, numbers, watermarks or pseudo-text anywhere except the exact words given; no betting symbols, no money.`;

/** For a card with no text: no typography in the grammar at all, and no empty band, box or frame. */
export const CARD_STYLE_NO_TEXT = CARD_STYLE.replace("condensed white uppercase typography with a thin white hairline frame;", "no typography at all, no band, no box, no frame, no hairline;").replace(
  "NO other text, letters, numbers, watermarks or pseudo-text anywhere except the exact words given",
  "NO text, letters, numbers, watermarks or pseudo-text anywhere",
);

export function cardPrompt(c: CardSpec): string {
  const p = cardPromptBase(c);
  return c.mood && !p.includes("MOOD of the figure") ? `${p} MOOD of the figure: ${c.mood}. Every word, head and hand entirely inside the frame with a clear margin (a figure may bleed off the bottom edge only).` : p;
}

function cardPromptBase(c: CardSpec): string {
  const T = c.tint ?? "cobalt blue";
  const other = c.block === "left" ? "right" : "left";
  const fig = /no people/.test(c.figure) ? `${c.figure}, in ${T}` : `${c.figure}, a stylised flat silhouette filled with solid colour, in plain ${T} kit`;
  const label = expectedText(c.text);
  const w = c.format === "number" ? c.text.words : label || undefined;
  // cut-out: the figure is NEVER the background colour (measured 30/10: red on red, unreadable) — navy and white on the club colour, as in the approved v3 preview
  const navy = /navy/.test(T);
  const figCut = navy && !/no people/.test(c.figure) ? `${c.figure}, a stylised flat silhouette filled with solid white with crisp navy details, clearly contrasting with the deep navy background` : /no people/.test(c.figure) ? `${c.figure}, in deep navy and white` : `${c.figure}, a stylised flat silhouette filled with solid deep navy #071329 with crisp white details, in a plain deep navy kit, clearly contrasting with the ${T} background (the figure is never ${T})`;
  // the pose carries the mood of the note; every element whole and inside the frame
  const moodLine = c.mood ? `. MOOD of the figure: ${c.mood}. Every word, head and hand entirely inside the frame with a clear margin (a figure may bleed off the bottom edge only)` : "";
  const chest = "framed from the chest up only (head and shoulders large in the frame)";
  const caption = (where: string) => (w ? ` ${where} large condensed white uppercase text reading exactly ${w}, with a thin white hairline frame around it.` : ` No text at all.`);
  switch (c.format) {
    case "split":
      if (!w) return `SPLIT card: the ${other} half is a flat illustration of ${fig} on a pale cream background; the ${c.block} half is one solid flat ${T} panel with ${c.object} in its centre, cut-out with a hard shadow. Dominant accent: ${T}. ${CARD_STYLE_NO_TEXT}`;
      return `SPLIT card: the ${other} half is a flat illustration of ${fig} on a pale cream background; the ${c.block} half is one solid flat ${T} panel.${caption(`On the ${T} panel, in the lower third,`)} Dominant accent: ${T}. ${CARD_STYLE}`;
    case "score":
      return `SCOREBOARD card: a giant condensed white numeral reading exactly ${c.text.big} fills a solid flat ${T} block covering the ${c.block} two thirds of the frame; on the other third, on a flat deep navy block, a huge plain white round soccer ball (association football, classic panels, never an oval American football or rugby ball) with no logo, cut-out style with a hard shadow. Nothing else: no band, no box, no frame, no empty panel in the lower third. No other text. Dominant accent: ${T}. ${CARD_STYLE}`;
    case "quote":
      return `${c.quoted ? "QUOTE card: giant white quotation marks in the upper middle," : "STATEMENT card: no quotation marks anywhere,"} ${fig} standing on the right, the whole frame a solid flat ${T} block;${caption("in the lower third,")} No other text. Dominant accent: ${T}. ${CARD_STYLE}`;
    case "cutout":
      if (!w) return `CUT-OUT card: ${figCut}, large, ${chest}, flat illustration cut out with a hard shadow on a solid flat ${T} background that fills the frame, a few bold flat geometric shapes in deep navy behind it. Dominant accent: ${T}. ${CARD_STYLE_NO_TEXT}`;
      return `CUT-OUT card: ${figCut}, ${chest}, flat illustration cut out with a hard shadow on a solid flat ${T} background that fills the frame${moodLine}; across the lower third a wide white band bordered by a thin hairline with condensed ${T} uppercase text reading exactly ${w}. No other text. Dominant accent: ${T}. ${CARD_STYLE}`;
    case "number":
      return `BIG NUMBER card: a giant condensed white numeral ${c.text.big} fills the ${c.block} half of the frame on a solid flat ${T} block; on the ${other} half, ${c.object}, cut-out flat illustration with a hard shadow on a pale cream background;${caption("in the lower third,")} No other text. Dominant accent: ${T}. ${CARD_STYLE}`;
    case "band":
      return `BAND card: upper two thirds a flat illustration of ${fig} on a solid flat white background, hard shadow; lower third a solid flat ${T} band with giant condensed white uppercase text reading exactly ${label}, with a thin white hairline frame. No other text. ${CARD_STYLE}`;
  }
}

// ─── the anti-duplicate ──────────────────────────────────────────────────────

/** Calibrated by art direction on PIL (29/10): «same picture» = BOTH under these. */
export const DHASH8_MAX = 24;
export const COLOR_MAX = 26;

export const hamming = (a: string, b: string): number => {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) {
    n += Number(x & BigInt(1));
    x >>= BigInt(1);
  }
  return n;
};
export const colourDist = (a: readonly number[], b: readonly number[]): number => a.reduce((s, v, i) => s + Math.abs(v - (b[i] ?? 0)), 0) / a.length;

/** Too close to a recent card: dHash AND colour both under the thresholds (the same-format+tint rule is in the rotation). */
export function tooSimilar(sig: { dhash: string; csig: number[] }, ledger: readonly LedgerRow[]): string | null {
  for (const r of ledger.slice(-WINDOW)) {
    if (r.dhash && r.csig) {
      const d = hamming(sig.dhash, r.dhash);
      const c = colourDist(sig.csig, r.csig);
      if (d < DHASH8_MAX && c < COLOR_MAX) return `looks like a recent card (dHash ${d}/64, colour ${c.toFixed(1)})`;
    }
  }
  return null;
}
