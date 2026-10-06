// #V3C-PARTNERS (F7) — aggancio di una partita del board a un book che scrive i
// nomi in un altro modo. Serve per Altenar: misurato il 06/10/2026, su 141
// partite del board senza chiave esatta in Wildz, 70 avevano lo stesso giorno
// e almeno una squadra uguale («KuPS Kuopio»/«KuPS», «Botafogo»/«Botafogo-RJ»,
// «PSV Eindhoven»/«PSV»). Le BetConstruct condividono i nomi fra loro e non
// passano di qui.
//
// Regola, volutamente stretta (un aggancio sbagliato è una quota falsa):
//   * calcio soltanto;
//   * calcio d'inizio entro 30 minuti;
//   * ENTRAMBE le squadre compatibili: le parole di un nome sono tutte
//     contenute nell'altro (dopo normName e senza punteggiatura);
//   * un solo candidato: se due partite del book sono compatibili, nessuna.
import type { FpMatch } from "@/lib/fortuneplay-live";
import { normName } from "@/lib/odds-api";

const KICKOFF_TOLERANCE_MS = 30 * 60_000;

function words(name: string): Set<string> {
  return new Set(normName(name).replace(/[^a-z0-9 ]+/g, " ").split(" ").filter(Boolean));
}

export function compatibleNames(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return false;
  const [small, big] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  for (const w of small) if (!big.has(w)) return false;
  return true;
}

export type OurFixture = { home: string; away: string; kickoff: string };

/** The single book fixture compatible with ours, and whether the book lists it the other way round. */
export function fuzzyFootballMatch(
  map: Map<string, FpMatch>,
  ours: OurFixture,
): { fm: FpMatch; swapped: boolean } | null {
  const t = Date.parse(ours.kickoff);
  if (!Number.isFinite(t)) return null;
  let found: { fm: FpMatch; swapped: boolean } | null = null;
  for (const fm of map.values()) {
    if (fm.sport !== "soccer" || !fm.startTime) continue;
    if (Math.abs(Date.parse(fm.startTime) - t) > KICKOFF_TOLERANCE_MS) continue;
    const straight = compatibleNames(fm.homeName, ours.home) && compatibleNames(fm.awayName, ours.away);
    const swapped = compatibleNames(fm.homeName, ours.away) && compatibleNames(fm.awayName, ours.home);
    if (!straight && !swapped) continue;
    if (found) return null; // ambiguous → no price rather than a wrong one
    found = { fm, swapped: !straight };
  }
  return found;
}
