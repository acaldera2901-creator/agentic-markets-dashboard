// Port TS di core/tennis_names.py (#FORTUNEPLAY-LIVE-ODDS-1). I feed divergono su
// punteggiatura, seed, nazione e score-suffix: chiavi canoniche per il lookup.
const SEEDING = /\(\d+\)\s*/g;
const NATION = /\([A-Z]{2,3}\)/g;
const SCORE_SUFFIX =
  /\s+\d+(?:[-–]\d+)?(?:\(\d+\))?(?:\s+\d+(?:[-–]\d+)?(?:\(\d+\))?)*(?:\s+(?:ret|w\/o|wo|walkover))?\s*$/i;
// Dopo toLowerCase() — rimuove char non-ASCII dopo decomposizione (equiv a encode('ascii','ignore') Python)
const PUNCT = /[^a-z0-9\s]/g;

export function cleanPlayerName(raw: string | null): string {
  if (!raw) return "";
  let name = String(raw);
  name = name.replace(SEEDING, "");
  name = name.replace(NATION, "");
  name = name.replace(SCORE_SUFFIX, "");
  name = name.replace(/\s+/g, " ");
  return name.replace(/^[\s\-–]+|[\s\-–]+$/g, "");
}

export function canonicalPlayerKey(raw: string | null): string {
  let name = cleanPlayerName(raw);
  name = name.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
  name = name.toLowerCase().replace(/-/g, " ");
  name = name.replace(PUNCT, " ");
  return name.replace(/\s+/g, " ").trim();
}
