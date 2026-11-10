// lib/news/per-note.ts (#NEWS-FOTMOB-PROD-1026) — the picture made FOR one
// note (art direction, from the note's own text; never the source's image).
// The file name is opaque: news-<sha256(source id)[:12]>.webp with a .png
// beside it for <picture>, under /public/images/news — a public image URL
// never carries the source's id. The hash lives in per-note.server.ts
// (node:crypto, server only); this file is pure and safe for the browser:
// the id out of a URL, the list of delivered pictures, the lookup by name.
// A note with no picture of its own falls back to the picture of its kind
// (lib/news/kind.ts).
import type { NewsImage } from "./kind";

/** The per-note picture: a local webp with its png fallback, or the watcher's public URL (#NEWSWATCH-2-IMG); `own` marks it as made for the note. */
export type NoteImage = NewsImage & { own: true; png?: string };

const SIZE = { width: 1200, height: 675 } as const;

/** The stems of the pictures delivered so far (one line per picture: the hash of the source id, never the id). */
export const NOTE_IMAGE_NAMES: ReadonlySet<string> = new Set([
  "news-3ad88e639192", // 29/10 · Bayern unity
  "news-d92d970f9936", // 29/10 · Miami–Cincinnati late equaliser
  "news-85469d0dd84e", // 29/10 · Chivu/Inter no conviction
  "news-39567f5fa699", // 29/10 · Chelsea EFL Cup exit
]);

/** The picture with this stem, or null when none was delivered. */
export function noteImageByName(name: string): NoteImage | null {
  return NOTE_IMAGE_NAMES.has(name) ? { own: true, src: `/images/news/${name}.webp`, png: `/images/news/${name}.png`, ...SIZE } : null;
}

/** The source id in a note's URL: «/news/<id>-slug» or «/topnews/<number>-slug», language prefix or not; null for anything else. */
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

/**
 * Emma cards (vertical 4:5, photo + crests + logo drawn INTO the picture) are recognised by the suffix
 * «-e» on the public file name — news-<12 hex>-e.webp — so no migration and no column: the watcher
 * names them so on upload (storagePublisher). Its photo credit sits beside it as news-<12 hex>-e.credit.json.
 */
const EMMA_FILE = /\/news-[0-9a-f]{12}-e\.webp$/;
export const EMMA_PAGE_SIZE = { width: 1080, height: 1350 } as const;
export const isEmmaSrc = (src: string): boolean => EMMA_FILE.test(src.split("?")[0]);
export const emmaCreditUrl = (src: string): string | null => (isEmmaSrc(src) ? src.split("?")[0].replace(/\.webp$/, ".credit.json") : null);

/** The credit of a card's photo, as the watcher saved it; only plain https links survive, anything else is dropped. */
export type PhotoCredit = { person: string; author: string; license: string; licenseUrl: string | null; url: string | null };
export function parseCredit(raw: unknown): PhotoCredit | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const s = (v: unknown, max = 200): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const link = (v: unknown): string | null => { const t = s(v, 500); return /^https:\/\/[^\s"<>]+$/.test(t) ? t : null; };
  const author = s(o.author), license = s(o.license);
  if (!author || !license) return null;
  return { person: s(o.person), author, license, licenseUrl: link(o.licenseUrl), url: link(o.url) };
}
