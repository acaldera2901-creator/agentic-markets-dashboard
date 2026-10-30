// lib/news/per-note.server.ts (#NEWS-FOTMOB-PROD-1026) — server side of the
// per-note picture: the opaque file name for a source id (sha256, node:crypto,
// so this file never reaches the browser) and the lookup for a data card.
// The convention is the one the watcher follows when it saves a picture
// (NEWSWATCH-2): noteImageName(id) + ".webp" / ".png" under public/images/news.
import { createHash } from "node:crypto";
import { fotmobIdOf, noteImageByName, type NoteImage } from "./per-note";
import type { NewsCard } from "./table";

const SIZE = { width: 1200, height: 675 } as const;

/** The origin the watcher uploads to (the project's own Supabase); an image_url anywhere else is ignored. */
function storageOrigin(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  try { return raw ? new URL(raw).origin : null; } catch { return null; }
}

/** #NEWSWATCH-2-IMG — the watcher's picture for a note: only a URL on our own storage origin, else null. */
export function uploadedImage(imageUrl: string | null, origin: string | null = storageOrigin()): NoteImage | null {
  if (!imageUrl || !origin) return null;
  try {
    const u = new URL(imageUrl);
    if (u.origin !== origin || !/\.(webp|png|jpe?g|avif)$/i.test(u.pathname)) return null;
    return { own: true, src: u.toString(), ...SIZE };
  } catch {
    return null;
  }
}

/** The opaque file stem for a source id: «news-» + the first 12 hex chars of sha256(id). */
export function noteImageName(id: string): string {
  return `news-${createHash("sha256").update(id).digest("hex").slice(0, 12)}`;
}

/** The picture made for this note: the watcher's upload first, else the bundled file for its id, else null (→ the kind's picture). */
export function noteImage(card: Pick<NewsCard, "url" | "imageUrl">): NoteImage | null {
  const up = uploadedImage(card.imageUrl);
  if (up) return up;
  const id = fotmobIdOf(card.url);
  return id ? noteImageByName(noteImageName(id)) : null;
}
