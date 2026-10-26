// Mappa dei crest reali. #CLASSIC-ROOBET-1013 — popolata da
// scripts/crests/import-crests.mjs (TheSportsDB) e integrata con i ritratti
// ufficiali ATP/WTA/ITF e i loghi ESPN. Fonti per file in scripts/crests/sources.json. Chi non è in mappa cade sul
// quadratino con le iniziali di <Crest>.
import CREST_MAP from "./crest-map.json";

// Normalize typography only: never fuzzy-match names or strip identity-bearing words.
function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/\s+/g, " ");
}

const MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CREST_MAP).map(([name, url]) => [normalize(name), url]),
);

function key(team: string, sport: string): string {
  return `${normalize(sport)}:${normalize(team)}`;
}

export function crestUrl(team: string | null, sport: string): string | null {
  if (!team) return null;
  return MAP[key(team, sport)] ?? null;
}

// These source portraits are already framed around the face. Applying the
// full-body cutout zoom would crop the eyes and chin out of the avatar.
const HEADSHOTS = new Set([
  "/crests/tennis/tatiana-prozorova.webp",
  "/crests/tennis/mika-brunold.webp",
  "/crests/tennis/nuno-borges.webp",
  "/crests/tennis/daniel-altmaier.webp",
  "/crests/tennis/holger-rune.webp",
  "/crests/tennis/quentin-halys.webp",
  "/crests/tennis/julia-riera.webp",
  "/crests/tennis/laura-pigossi.webp",
  "/crests/tennis/carolina-alves.webp",
  "/crests/tennis/fernanda-labrana.webp",
]);

export function isCrestHeadshot(url: string): boolean {
  return HEADSHOTS.has(url);
}
