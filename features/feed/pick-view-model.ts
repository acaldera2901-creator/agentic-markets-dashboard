import type { UnifiedPrediction } from "@/lib/unified-adapter";

export type ProjectedPrediction = Partial<UnifiedPrediction> & {
  id: string;
  locked?: boolean;
  final_score?: string | null;
};

export type PickCardVM = {
  id: string;
  sport: string;
  competition: string;
  kickoff: string;
  homeTeam: string | null;
  awayTeam: string | null;
  decision: string;
  odds: number | null;
  confidenceScore: number | null;
  why: string | null;
  hasValue: boolean;
  locked: boolean;
  externalEventId: string | null;
  result: "won" | "lost" | "void" | null;
  finalScore: string | null;
  settled: boolean;
};

// "unresolved" e qualsiasi altro valore non riconosciuto → null (non ancora settled).
function normalizeResult(result: string | null | undefined): "won" | "lost" | "void" | null {
  return result === "won" || result === "lost" || result === "void" ? result : null;
}

export function pickOutcomeLabel(result: "won" | "lost" | "void" | null): string | null {
  if (result === "won") return "Pronostico corretto";
  if (result === "lost") return "Non riuscito";
  if (result === "void") return "Annullato";
  return null;
}

// Elide l'articolo: "Vince l'Inter" vs "Vince il Napoli" è raffinabile; qui
// una regola minima ("l'" davanti a vocale) copre i casi comuni. Upgrade:
// tabella articoli per club se serve più naturalezza.
function vince(team: string): string {
  const art = /^[AEIOUaeiou]/.test(team.trim()) ? "l'" : "il ";
  return `Vince ${art}${team.trim()}`;
}

export function humanizePick(p: {
  market?: string | null; pick: string | null; home_team: string | null; away_team: string | null;
}): string {
  const m = (p.market ?? "").toLowerCase();
  const pick = (p.pick ?? "").trim();
  if (!pick) return "";

  if (m.includes("1x2") || m.includes("match_winner") || m.includes("winner")) {
    if (p.home_team && pick.toLowerCase() === p.home_team.toLowerCase()) return vince(p.home_team);
    if (p.away_team && pick.toLowerCase() === p.away_team.toLowerCase()) return vince(p.away_team);
    if (pick === "X" || /pareg/i.test(pick)) return "Pareggio";
    if (/^(1|home|casa)$/i.test(pick) && p.home_team) return vince(p.home_team);
    if (/^(2|away|trasferta)$/i.test(pick) && p.away_team) return vince(p.away_team);
    return pick;
  }
  if (m.includes("over_under") || m.includes("over/under") || m.includes("totals")) {
    return /gol|goal|set/i.test(pick) ? pick : `${pick} gol`;
  }
  if (m.includes("btts") || m.includes("gol/no") || m.includes("both_teams")) {
    return /^(yes|si|sì|gol)$/i.test(pick) ? "Gol (entrambe segnano)" : "No Gol";
  }
  return pick;
}

export function toPickCardVM(p: ProjectedPrediction): PickCardVM {
  const result = normalizeResult(p.result);
  return {
    id: p.id,
    sport: p.sport ?? "",
    competition: p.competition ?? "",
    kickoff: p.starts_at ?? "",
    homeTeam: p.home_team ?? p.player_one ?? null,
    awayTeam: p.away_team ?? p.player_two ?? null,
    decision: humanizePick({
      market: p.market,
      pick: p.pick ?? null,
      home_team: p.home_team ?? null,
      away_team: p.away_team ?? null,
    }),
    odds: p.odds ?? null,
    confidenceScore: p.confidence_score ?? null,
    why: p.explanation ?? null,
    hasValue: (p.edge_percent ?? 0) > 0,
    locked: p.locked === true,
    externalEventId: p.external_event_id ?? null,
    result,
    finalScore: p.final_score ?? null,
    settled: result !== null,
  };
}
