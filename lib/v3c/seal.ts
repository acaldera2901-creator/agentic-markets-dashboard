// lib/v3c/seal.ts (#REDESIGN-V3C F1)
// Il sigillo: «sealed 09:02 UTC · a91f…c3». L'hash intero vive nel registro;
// nella UI se ne mostrano i primi quattro e gli ultimi due caratteri, con i
// puntini di sospensione tipografici (U+2026), in JetBrains Mono.

const HEXISH = /^[0-9a-fA-F]+$/;

/**
 * Abbrevia un hash esadecimale. Sotto le 8 cifre non ha senso tagliarlo e si
 * mostra intero; un valore non esadecimale torna vuoto, così il componente
 * non stampa spazzatura come se fosse una prova.
 */
export function shortHash(hash: string | null | undefined, head = 4, tail = 2): string {
  if (!hash) return "";
  const h = hash.trim().toLowerCase();
  if (!HEXISH.test(h)) return "";
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

/** «09:02 UTC» da un ISO; l'ora del sigillo è sempre in UTC, scritta. */
export function sealTimeUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}
