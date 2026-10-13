// Mappa dei crest reali. #CLASSIC-ROOBET-1013 — popolata da
// scripts/crests/import-crests.mjs (TheSportsDB; licenza: decisione di Andrea,
// fonti per file in scripts/crests/sources.json). Chi non è in mappa cade sul
// quadratino con le iniziali di <Crest>.
import CREST_MAP from "./crest-map.json";

const MAP: Record<string, string> = CREST_MAP;

function key(team: string, sport: string): string {
  return `${sport.toLowerCase()}:${team.trim().toLowerCase()}`;
}

export function crestUrl(team: string | null, sport: string): string | null {
  if (!team) return null;
  return MAP[key(team, sport)] ?? null;
}
