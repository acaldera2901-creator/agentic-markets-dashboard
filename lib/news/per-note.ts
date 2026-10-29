// lib/news/per-note.ts (#NEWS-FOTMOB-PROD-1026) — the picture made FOR one
// note (art direction, from the note's own text; never a FotMob image), looked
// up by the FotMob id of the note's source URL. Files under /public/images/news
// as news-<fotmobId>-<slug>.webp with a .png beside it for <picture>. A note
// with no picture of its own falls back to the picture of its kind
// (lib/news/kind.ts). Pure.
import type { NewsImage } from "./kind";
import type { NewsCard } from "./table";

/** The per-note picture: the webp, its png fallback, the fixed size. */
export type NoteImage = NewsImage & { png: string };

const SIZE = { width: 1200, height: 675 } as const;
const file = (name: string): NoteImage => ({ src: `/images/news/${name}.webp`, png: `/images/news/${name}.png`, ...SIZE });

/** FotMob id → picture. Added by hand, one line per delivered picture. */
export const NOTE_IMAGES: Readonly<Record<string, NoteImage>> = {
  "1h64s2rd5exkn16klbwyxxlsns": file("news-1h64s2rd5exkn16klbwyxxlsns-bayern-unity"),
  "4jikbwtyvot1ka7zjol4z8ww": file("news-4jikbwtyvot1ka7zjol4z8ww-miami-cincinnati-late-equaliser"),
  "34p7x1w2mryx1d30uxb50a7qb": file("news-34p7x1w2mryx1d30uxb50a7qb-chivu-inter-no-conviction"),
  "mb6zakc8ytax1tip7i9m9dlsx": file("news-mb6zakc8ytax1tip7i9m9dlsx-chelsea-efl-cup-exit"),
};

/** The FotMob id in a source URL: «/news/<id>-slug» or «/topnews/<number>-slug»; null for anything else. */
export function fotmobIdOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)fotmob\.com$/.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/(?:[a-z]{2}\/)?(?:news|topnews)\/([a-z0-9]+)(?:-|$)/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** The picture made for this note, or null (→ the kind's picture). */
export function noteImage(card: Pick<NewsCard, "url">): NoteImage | null {
  const id = fotmobIdOf(card.url);
  return id ? NOTE_IMAGES[id] ?? null : null;
}
