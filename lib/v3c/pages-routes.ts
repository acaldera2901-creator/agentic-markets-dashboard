// lib/v3c/pages-routes.ts (#REDESIGN-V3C pages) — le rewrite delle pagine «di sito».
// Stesso schema di F3 (lib/v3c/rewrites.ts): flag acceso, la URL di oggi serve la
// pagina v3c sotto app/v3c/* (beforeFiles: le pagine di oggi esistono nel
// filesystem); flag spento, nessuna rewrite e i file di oggi non importano nulla
// del redesign — né JS né CSS né font (misurato: un import dinamico dentro la
// pagina di oggi faceva comunque entrare il CSS v3c nella build a flag spento).
// /pricing è nuova: a flag spento resta il 404 di sempre.
import { envFlagOn } from "../redesign-flag";

type Rewrite = { source: string; destination: string };

export const V3C_PAGE_PATHS = [
  "/blog",
  "/blog/:slug",
  "/partners",
  "/pricing",
  "/how-it-works",
  "/leaderboard",
  "/community",
  "/invite",
  "/privacy",
  "/terms",
  "/profilo",
] as const;

export function v3cPagesRewrites(flag: string | undefined | null): Rewrite[] {
  if (!envFlagOn(flag)) return [];
  return V3C_PAGE_PATHS.map((p) => ({ source: p, destination: `/v3c${p}` }));
}

/** Unisce le rewrite F3 (forma `{ beforeFiles }` o `[]`) con queste, sempre in beforeFiles. */
export function mergeBeforeFiles(
  f3: { beforeFiles: Rewrite[] } | Rewrite[],
  pages: Rewrite[],
): { beforeFiles: Rewrite[] } | Rewrite[] {
  const base = Array.isArray(f3) ? f3 : f3.beforeFiles;
  if (Array.isArray(f3) && f3.length === 0 && pages.length === 0) return [];
  return { beforeFiles: [...base, ...pages] };
}
