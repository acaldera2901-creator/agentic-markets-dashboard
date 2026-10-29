// lib/news/per-note.server.ts (#NEWS-FOTMOB-PROD-1026) — server side of the
// per-note picture: the opaque file name for a source id (sha256, node:crypto,
// so this file never reaches the browser) and the lookup for a data card.
// The convention is the one the watcher follows when it saves a picture
// (NEWSWATCH-2): noteImageName(id) + ".webp" / ".png" under public/images/news.
import { createHash } from "node:crypto";
import { fotmobIdOf, noteImageByName, type NoteImage } from "./per-note";
import type { NewsCard } from "./table";

/** The opaque file stem for a source id: «news-» + the first 12 hex chars of sha256(id). */
export function noteImageName(id: string): string {
  return `news-${createHash("sha256").update(id).digest("hex").slice(0, 12)}`;
}

/** The picture made for this note, or null (→ the kind's picture). */
export function noteImage(card: Pick<NewsCard, "url">): NoteImage | null {
  const id = fotmobIdOf(card.url);
  return id ? noteImageByName(noteImageName(id)) : null;
}
