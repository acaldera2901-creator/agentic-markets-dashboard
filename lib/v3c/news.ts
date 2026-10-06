// lib/v3c/news.ts (#REDESIGN-V3C F9 · filone pages) — helper puri delle pagine News.

/** Minuti di lettura dal testo vero (230 parole al minuto), mai meno di 1. */
export function readingMinutes(html: string): number {
  const words = html
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}
