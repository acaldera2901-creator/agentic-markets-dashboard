// #RESTYLING-0921 round 7 — le iniziali del crest.
// Il riferimento di Codex non disegna scudetti: mette un quadratino scuro con
// una, due o tre lettere. Niente asset, niente licenze, nessuna squadra
// privilegiata, e funziona per un campionato che non abbiamo mai visto.

/** Parole che non portano identità e non meritano una lettera. */
const NOISE = new Set([
  "fc", "cf", "sc", "ac", "as", "ss", "us", "uc", "afc", "cfc", "sv", "vfl",
  "vfb", "fsv", "tsg", "bsc", "de", "la", "le", "les", "el", "al", "il", "the",
  "of", "and", "y", "e", "i",
]);
// Attenzione: «City», «United», «Town» NON sono rumore. Toglierli fa collidere
// Manchester United e Manchester City sullo stesso «MAN», che è esattamente
// l'errore che un crest non può permettersi.

function words(team: string): string[] {
  return team
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // via i diacritici: «Atlético» → «Atletico»
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

/**
 * Da un nome squadra a 1-3 iniziali maiuscole.
 * - più parole «vere» → la prima lettera di ciascuna, al massimo tre
 *   («Manchester United» → «MU», «Paris Saint Germain» → «PSG»)
 * - una parola sola → le prime tre lettere («Arsenal» → «ARS»)
 * - niente da cui pescare → stringa vuota, e il chiamante rende il neutro.
 */
export function crestInitials(team: string | null | undefined): string {
  if (!team) return "";
  const all = words(team);
  if (all.length === 0) return "";
  const signal = all.filter((w) => !NOISE.has(w.toLowerCase()));
  const use = signal.length > 0 ? signal : all;
  if (use.length === 1) return use[0].slice(0, 3).toUpperCase();
  return use
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
