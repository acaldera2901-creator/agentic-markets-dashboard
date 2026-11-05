// lib/v3c/news/card-job.ts — what the watcher hands to makeImage for one card: prompt, expected text and (emma) reference images.
// The ONLY thing the watcher changes for the new style is this argument; cadence, fetch, rewrite and publishing are untouched.
import { homedir } from "node:os";
import { join } from "node:path";
import { assetPaths } from "./assets";
import { photoRef, type PhotoRef } from "./photo";
import { cardPrompt, expectedText, type CardSpec } from "./card";
import { emmaCardPrompt, emmaText, imageStyle } from "./card-emma";
import { crestRefs } from "./emma-assets";
import type { NoteText } from "./rewrite";

export type CardJob = { prompt: string; expected: string; refs?: string[]; hfPrompt?: string; credit?: PhotoRef };

/**
 * cardJob + the photo of the person (emma only). Photo first among the references, then the crests; the credit (author, licence, URL)
 * travels with the job and is saved next to the card. No photo found / any error → exactly cardJob (generic scene, no name).
 */
export async function cardJobWithPhoto(c: CardSpec, note: NoteText, teams: readonly string[], env: NodeJS.ProcessEnv = process.env, deps: { fetch?: typeof fetch; log?: (m: string) => void } = {}): Promise<CardJob> {
  const base = cardJob(c, note, teams, env);
  if (imageStyle(env.NEWS_IMAGE_STYLE) !== "emma") return base;
  const dir = env.NEWS_WATCHER_PHOTO_DIR || join(env.NEWS_WATCHER_HOME || join(homedir(), "Library", "Application Support", "news-watcher"), "photos");
  const photo = await photoRef(note, teams, { dir, fetch: deps.fetch, log: deps.log });
  if (!photo) return base;
  const crests = crestRefs(note.title, note.body, teams, assetPaths(env).publicDir);
  const assets = { photo: { person: photo.person }, crests: crests.map((x) => x.name) };
  return { ...base, prompt: emmaCardPrompt(c, assets), expected: emmaText(c, assets).expected, refs: [photo.file, ...crests.map((x) => x.file)], credit: photo };
}

/** Crest files live in the site's public/ (override NEWS_WATCHER_PUBLIC_DIR); missing dir = no crest, never an invented one. */
export function cardJob(c: CardSpec, note: NoteText, teams: readonly string[], env: NodeJS.ProcessEnv = process.env): CardJob {
  if (imageStyle(env.NEWS_IMAGE_STYLE) !== "emma") return { prompt: cardPrompt(c, "legacy"), expected: expectedText(c.text) };
  const crests = crestRefs(note.title, note.body, teams, assetPaths(env).publicDir);
  const assets = { crests: crests.map((x) => x.name) };
  return {
    prompt: emmaCardPrompt(c, assets),
    expected: emmaText(c, assets).expected,
    ...(crests.length ? { refs: crests.map((x) => x.file) } : {}),
    hfPrompt: emmaCardPrompt(c), // Higgsfield takes no reference images: same card without crest references
  };
}
