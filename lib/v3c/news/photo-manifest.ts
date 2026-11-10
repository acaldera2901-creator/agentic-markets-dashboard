// lib/v3c/news/photo-manifest.ts — real photos chosen by the social desk (drafts/social/real-photos-news/manifest.json) as a photo source
// for the news watcher, next to the Wikimedia lookup of photo.ts. Licence, author and source URL come FROM the manifest; the watcher's
// guard is unchanged (a card needs a photo WITH credit, else it is not made). Entries are keyed by the note's guid hash (news_items.guid_hash).
// A LaunchAgent cannot read ~/Desktop (TCC): the manifest and its files are mirrored into <watcher home>/photos/manifest/ (sync-photo-manifest.sh);
// a file path that does not exist is looked up by basename next to the manifest.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { PhotoRef } from "./photo";

type Entry = { guid?: string; person?: string; file?: string | null; author?: string; license?: string; licenseUrl?: string | null; url?: string; width?: number; height?: number; status?: string };

export function manifestPath(env: NodeJS.ProcessEnv = process.env): string {
  return env.NEWS_WATCHER_PHOTO_MANIFEST || join(env.NEWS_WATCHER_HOME || join(homedir(), "Library", "Application Support", "news-watcher"), "photos", "manifest", "manifest.json");
}

/** Only status "ready" with a file on disk, a person, an author, a licence and a source URL (the credit). Anything else → null. */
export function manifestPhoto(hash: string | undefined, env: NodeJS.ProcessEnv = process.env, log?: (m: string) => void): PhotoRef | null {
  if (!hash) return null;
  const mf = manifestPath(env);
  if (!existsSync(mf)) return null;
  let list: Entry[];
  try { list = JSON.parse(readFileSync(mf, "utf8")); } catch (e) { log?.(`photo manifest unreadable: ${String(e).slice(0, 80)}`); return null; }
  if (!Array.isArray(list)) return null;
  const e = list.find((x) => x && x.guid === hash && x.status === "ready");
  if (!e) return null;
  let file = e.file || "";
  if (!file || !existsSync(file)) file = file ? join(dirname(mf), basename(file)) : "";
  if (!file || !existsSync(file)) { log?.(`photo manifest ${e.person ?? "?"}: file not found`); return null; }
  if (!e.person || !e.author || !e.license || !e.url) { log?.(`photo manifest ${e.person ?? "?"}: incomplete credit (person/author/license/url) → not used`); return null; }
  log?.(`photo manifest: ${e.person} (${e.license})`);
  return { person: e.person, file, author: e.author, license: e.license, licenseUrl: e.licenseUrl ?? null, url: e.url, width: e.width ?? 0, height: e.height ?? 0 };
}
