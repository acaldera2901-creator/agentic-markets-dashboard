// lib/v3c/news/emma-assets.ts — reference images for the «emma» style. Crests ONLY from the files already in the repo
// (public/crests/football via lib/ui/crest-map.json): no file = no crest, never drawn, never invented.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { crestUrl } from "../../ui/crest-assets";
import { noteBadges } from "../../news/clubs";

export type CrestRef = { name: string; url: string; file: string };

/** Crests of the clubs a note names (max 2): from the explicit team list and the text; each must exist on disk. */
export function crestRefs(title: string, body: string, teams: readonly string[], publicDir: string): CrestRef[] {
  const out: CrestRef[] = [];
  const add = (name: string, url: string | null) => {
    if (!url || out.length >= 2 || out.some((c) => c.url === url)) return;
    const file = join(publicDir, url.replace(/^\//, ""));
    if (existsSync(file)) out.push({ name, url, file });
  };
  for (const t of teams) add(t, crestUrl(t, "football"));
  for (const b of noteBadges(title, body, teams, 2)) add(b.name, b.crest);
  return out;
}

/**
 * Crests for an emma card: ONLY clubs the note's TITLE names. `teams` can hold the opponent named in the body (live 05/11: the Guirassy note
 * lists «Real Betis», his club is Dortmund): a crest that the headline does not name could put the wrong club next to the person.
 */
export function titleCrestRefs(title: string, publicDir: string): CrestRef[] {
  return crestRefs(title, "", [], publicDir);
}
