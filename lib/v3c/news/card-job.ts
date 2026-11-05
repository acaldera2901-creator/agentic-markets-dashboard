// lib/v3c/news/card-job.ts — what the watcher hands to makeImage for one card: prompt, expected text and (emma) reference images.
// The ONLY thing the watcher changes for the new style is this argument; cadence, fetch, rewrite and publishing are untouched.
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { assetPaths } from "./assets";
import { isClubNote, photoRef, type PhotoRef } from "./photo";
import { kitIsNational } from "./photo-kit";
import { cardPrompt, expectedText, type CardSpec } from "./card";
import { emmaCardPrompt, emmaText, headlineLines, imageStyle } from "./card-emma";
import { titleCrestRefs } from "./emma-assets";
import type { NoteText } from "./rewrite";

export type CardJob = { prompt: string; expected: string; refs?: string[]; hfPrompt?: string; credit?: PhotoRef; clubNote?: boolean };

/** The photo's kit check, cached next to the photo (one visual read per picture): true = national-team shirt. */
function defaultKitCheck(env: NodeJS.ProcessEnv): (file: string) => Promise<boolean | null> {
  return async (file) => {
    const cache = `${file}.kit`;
    try { const c = readFileSync(cache, "utf8").trim(); if (c === "national" || c === "other") return c === "national"; } catch { /* no cache yet */ }
    const r = await kitIsNational(file, { claudeBin: env.NEWS_WATCHER_CLAUDE || join(homedir(), ".local", "bin", "claude"), env });
    if (r !== null) writeFileSync(cache, r ? "national" : "other");
    return r;
  };
}

/**
 * cardJob + the photo of the person (emma only). Photo first among the references, then the crests; the credit (author, licence, URL)
 * travels with the job and is saved next to the card. No photo found / any error → exactly cardJob (generic scene, no name).
 */
export async function cardJobWithPhoto(c: CardSpec, note: NoteText, teams: readonly string[], env: NodeJS.ProcessEnv = process.env, deps: { fetch?: typeof fetch; log?: (m: string) => void; kitCheck?: (file: string) => Promise<boolean | null> } = {}): Promise<CardJob> {
  const base = cardJob(c, note, teams, env);
  if (imageStyle(env.NEWS_IMAGE_STYLE) !== "emma") return base;
  const dir = env.NEWS_WATCHER_PHOTO_DIR || join(env.NEWS_WATCHER_HOME || join(homedir(), "Library", "Application Support", "news-watcher"), "photos");
  const photo = await photoRef(note, teams, { dir, fetch: deps.fetch, log: deps.log });
  if (!photo) return base;
  // club note + a national-team shirt in the picture (names and categories do not always say it): drop the photo, anonymous scene. Unreadable check = drop too.
  if (base.clubNote) {
    const national = await (deps.kitCheck ?? defaultKitCheck(env))(photo.file);
    if (national !== false) { deps.log?.(`photo ${photo.person}: dropped (${national === null ? "kit check unavailable" : "national-team shirt"} on a club note)`); return base; }
  }
  const crests = titleCrestRefs(note.title, assetPaths(env).publicDir);
  const assets = { photo: { person: photo.person }, crests: crests.map((x) => x.name), ...headlineAsset(c, note) };
  return { ...base, prompt: emmaCardPrompt(c, assets), expected: emmaText(c, assets).expected, refs: [photo.file, ...crests.map((x) => x.file)], credit: photo };
}

/** Crest files live in the site's public/ (override NEWS_WATCHER_PUBLIC_DIR); missing dir = no crest, never an invented one. */
export function cardJob(c: CardSpec, note: NoteText, teams: readonly string[], env: NodeJS.ProcessEnv = process.env): CardJob {
  if (imageStyle(env.NEWS_IMAGE_STYLE) !== "emma") return { prompt: cardPrompt(c, "legacy"), expected: expectedText(c.text) };
  const crests = titleCrestRefs(note.title, assetPaths(env).publicDir);
  const assets = { crests: crests.map((x) => x.name), ...headlineAsset(c, note) };
  return {
    prompt: emmaCardPrompt(c, assets),
    expected: emmaText(c, assets).expected,
    ...(isClubNote(note, teams) ? { clubNote: true } : {}),
    ...(crests.length ? { refs: crests.map((x) => x.file) } : {}),
    hfPrompt: emmaCardPrompt(c, headlineAsset(c, note)), // Higgsfield takes no reference images: same card without crest references
  };
}

/** The headline from the rewritten note's title, only when the card has no caption of its own (a quote/caption keeps priority). */
function headlineAsset(c: CardSpec, note: NoteText): { headline?: string[] } {
  void c; // Emma's rule (05/11): the headline is ALWAYS the note's title, shortened; a caption or a figure is at most a badge (emmaText)
  const h = headlineLines(note.title);
  return h.length ? { headline: h } : {};
}
