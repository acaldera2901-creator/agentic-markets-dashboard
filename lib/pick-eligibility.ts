// #PICK-FLOOR-0830 — un badge PICK si accende solo se la riga supera il floor
// E il lato ha edge sopra soglia.
//
// Prima (app/app/page.tsx:5188-5195) le due chip gol erano complementari:
//   const recOver = overP >= underP;  chips: { rec: recOver }, { rec: !recOver }
// cioe' un lato era marcato SEMPRE, per costruzione, scelto per probabilita'
// invece che per valore, e senza applicare il floor — mentre l'1X2, tre righe
// sopra, il floor lo rispettava gia'.
//
// Il backtest del 30/08 (12.158 predizioni walk-forward) misura che sui totals
// le fasce di edge alto rendono peggio: >10% di edge dichiarato -> ROI -7,33%
// con CI 95% [-11,11, -3,40]. Marcare un lato a prescindere non e' sostenibile.

const DEFAULT_MIN_EDGE = 0.05;

/** Il lato Over/Under che merita il badge, o null se nessuno lo merita. */
export function goalPickSide(args: {
  overP: number | null;
  underP: number | null;
  overOdds: number | null;
  underOdds: number | null;
  belowFloor: boolean;
  minEdge?: number;
}): "over" | "under" | null {
  const { overP, underP, overOdds, underOdds, belowFloor } = args;
  const minEdge = args.minEdge ?? DEFAULT_MIN_EDGE;
  if (belowFloor) return null;

  const edge = (p: number | null, o: number | null) => (p != null && o != null ? p * o - 1 : null);
  const candidates = [
    { side: "over" as const, e: edge(overP, overOdds) },
    { side: "under" as const, e: edge(underP, underOdds) },
  ].filter((c): c is { side: "over" | "under"; e: number } => c.e != null && c.e >= minEdge);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.e - a.e);
  return candidates[0].side;
}

/** Un marcatore merita il badge solo con edge sopra soglia, non perche' e' il piu' probabile. */
export function scorerPickEligible(args: {
  p: number | null;
  odds: number | null;
  minEdge?: number;
}): boolean {
  const { p, odds } = args;
  const minEdge = args.minEdge ?? DEFAULT_MIN_EDGE;
  if (p == null || odds == null) return false;
  return p * odds - 1 >= minEdge;
}
