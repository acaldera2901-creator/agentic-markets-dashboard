// lib/news/kind.ts (#NEWS-FOTMOB-PROD-1026) — which of our seven pictures goes
// with a note, from the note's own words (title and body, EN and IT). Pure,
// deterministic, no model call: the table has no image column and will never
// carry a FotMob picture, so the picture is ours and chosen by the TYPE of
// story, not by the story. Mapping, keywords and priority as set by the art
// direction (preview-news-prod/img-news/README.md, 26/10): an injury beats a
// result when a story carries both; nothing known → 7 · generica.
import type { NewsCard } from "./table";

export const NEWS_KINDS = ["risultato", "infortunio", "formazioni", "panchina", "premi", "mercato", "generica"] as const;
export type NewsKind = (typeof NEWS_KINDS)[number];
/** The number of the picture (news-0N-*.webp) for each kind. */
export const KIND_NUMBER: Record<NewsKind, 1 | 2 | 3 | 4 | 5 | 6 | 7> = { risultato: 1, infortunio: 2, formazioni: 3, panchina: 4, premi: 5, mercato: 6, generica: 7 };
export const KIND_BY_NUMBER: readonly NewsKind[] = ["generica", "risultato", "infortunio", "formazioni", "panchina", "premi", "mercato", "generica"];

const norm = (s: string): string => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'");

/** One regexp per kind, EN and IT, on normalised text. Order = priority on a tie: 02 > 06 > 05 > 03 > 04 > 01. */
const RULES: readonly [Exclude<NewsKind, "generica">, RegExp][] = [
  ["infortunio", /\b(injur\w*|stretcher|concussion|fracture\w*|hamstring|knee|ligament|surgery|sidelined|ruled out|out for (the|a|\d)|infortun\w*|barella|frattur\w*|lesion\w*|distorsion\w*|operazion\w*|operato|lungodegent\w*|fuori per)\b/g],
  ["mercato", /\b(transfer\w*|signs|signing\w*|signed|loan\w*|joins|set to leave|bid|deal|contract\w*|release clause|free agent|mercato|trasferiment\w*|prestito|rinnov\w*|firma\w*|cession\w*|acquist\w*|clausola)\b/g],
  ["premi", /\b(best xi|team of the (week|season)|totw|player of the (month|week|year|season)|awards?|ranking|ballon d'or|golden boot|trophy|named in|premi\w*|classific\w*|pallone d'oro|scarpa d'oro|miglior (giocatore|undici)|formazione della settimana)\b/g],
  ["formazioni", /\b(squads?|line-?ups?|starting (xi|eleven)|names? (his|the|their) (xi|eleven|squad|team)|left out|team news|formazion\w*|convocat\w*|undici|liste?|titolari)\b/g],
  ["panchina", /\b(manager|head coach|coach|says|said|criticis\w*|criticiz\w*|press conference|sack\w*|dismiss\w*|appoint\w*|under (growing |increasing |mounting )?(pressure|strain)|interim|tecnico|allenator\w*|dichiarazion\w*|esoner\w*|panchina|sotto (crescente )?pressione|mister)\b/g],
  ["risultato", /\b(beat|beats|won|wins|win|lost|loses|loss|defeat\w*|draws?|drew|victory|comeback|highlights|goals?|thrash\w*|clinch\w*|secures?|playoff\w*|batte|vince|vinto|perde|perso|sconfitt\w*|pareggi\w*|rimonta|vittoria|gol)\b|\b\d{1,2}-\d{1,2}\b/g],
];

const hits = (re: RegExp, s: string): number => (s.match(re) ?? []).length;

/** The picture number for a title and a summary: the title counts double, the body once; the first rule wins a tie; nothing → 7. */
export function pickNewsImage(title: string, summary: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const t = norm(title);
  const b = norm(summary);
  let best: NewsKind = "generica";
  let max = 0;
  for (const [kind, re] of RULES) {
    const n = 2 * hits(re, t) + hits(re, b);
    if (n > max) { max = n; best = kind; }
  }
  return KIND_NUMBER[best];
}

/** The kind of a note, from both its languages together (the texts only: a wire note without `model` is enough). */
export function newsKind(card: { note: Pick<NewsCard["note"], "en" | "it"> }): NewsKind {
  return KIND_BY_NUMBER[pickNewsImage(`${card.note.en.title} ${card.note.it.title}`, `${card.note.en.body} ${card.note.it.body}`)];
}

/** The «near» kind a note moves to when the note above it already shows the same picture (01↔07, 04↔06, 03→04; the rest → 07). */
const NEAR: Record<NewsKind, NewsKind> = { risultato: "generica", generica: "risultato", panchina: "mercato", mercato: "panchina", formazioni: "panchina", infortunio: "generica", premi: "generica" };

/** The same list with no two adjacent notes on the same picture: the second of a pair takes its near kind. */
export function dedupeKinds(kinds: readonly NewsKind[]): NewsKind[] {
  const out: NewsKind[] = [];
  for (const k of kinds) out.push(out.length && out[out.length - 1] === k ? NEAR[k] : k);
  return out;
}

/** One of our seven pictures (art direction 26/10, 1200 × 675 webp in /public/news). Only kinds whose file exists are listed: a missing picture is no picture, never a placeholder. */
export type NewsImage = { src: string; width: number; height: number };
const SIZE = { width: 1200, height: 675 } as const;
export const NEWS_IMAGES: Partial<Record<NewsKind, NewsImage>> = {
  risultato: { src: "/news/news-01-risultato.webp", ...SIZE },
  infortunio: { src: "/news/news-02-infortunio.webp", ...SIZE },
  formazioni: { src: "/news/news-03-formazioni.webp", ...SIZE },
  panchina: { src: "/news/news-04-panchina.webp", ...SIZE },
  premi: { src: "/news/news-05-premi.webp", ...SIZE },
  mercato: { src: "/news/news-06-mercato.webp", ...SIZE },
  generica: { src: "/news/news-07-generica.webp", ...SIZE },
};

export const newsImage = (kind: NewsKind): NewsImage | null => NEWS_IMAGES[kind] ?? null;
