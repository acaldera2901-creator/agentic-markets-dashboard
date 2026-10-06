// lib/v3c/pages-routes.ts (#REDESIGN-V3C pages) — le rewrite delle pagine «di sito».
// Stesso schema di F3 (lib/v3c/rewrites.ts): flag acceso, la URL di oggi serve la
// pagina v3c sotto app/v3c/* (beforeFiles: le pagine di oggi esistono nel
// filesystem); flag spento, nessuna rewrite e i file di oggi non importano nulla
// del redesign — né JS né CSS né font (misurato: un import dinamico dentro la
// pagina di oggi faceva comunque entrare il CSS v3c nella build a flag spento).
// /pricing è nuova: a flag spento resta il 404 di sempre.
// v3c-int: le rewrite le genera lib/v3c/rewrites.ts da questo elenco (una sola lista).
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
