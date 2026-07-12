import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PickCardVM } from "./pick-view-model";

const vm: PickCardVM = { id: "1", sport: "football", competition: "Serie A", kickoff: "2026-07-11T18:45:00Z",
  homeTeam: "Inter", awayTeam: "Verona", decision: "Vince l'Inter", odds: 1.55, confidenceScore: 78,
  why: "Inter in forma.", hasValue: true, locked: false, externalEventId: "B" };

const mockDetail = vi.fn();
vi.mock("./use-match-detail", () => ({ useMatchDetail: () => mockDetail() }));
import { PickCardExpanded } from "./PickCardExpanded";

const richDetail = {
  match_id: "B", league: "SA", league_name: "Serie A", home_team: "Inter", away_team: "Verona",
  kickoff: vm.kickoff, p_home: 0.72, p_draw: 0.18, p_away: 0.10, odds_home: 1.55, odds_draw: 4.2, odds_away: 6,
  edge: 0.08, best_selection: "HOME", confidence_score: 78,
  enrichment: { extra_markets: [{ key: "over_2_5", label: "Over 2.5", p: 0.61, model_odds: 1.64, market_odds: 1.72, edge: 0.05 }], soft_locked: true },
};

describe("PickCardExpanded", () => {
  it("loading", () => {
    mockDetail.mockReturnValue({ detail: null, loading: true, error: null });
    render(<PickCardExpanded pick={vm} />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });
  it("degradato: detail null → mostra recap + perché, nessun gruppo", () => {
    mockDetail.mockReturnValue({ detail: null, loading: false, error: null });
    render(<PickCardExpanded pick={vm} />);
    expect(screen.getByText("Vince l'Inter")).toBeInTheDocument();
    expect(screen.getByText(/Inter in forma/)).toBeInTheDocument();
    expect(screen.queryByText("Esiti principali")).toBeNull();
  });
  it("detail locked/incompleto → degradato (recap + perché, nessun gruppo)", () => {
    mockDetail.mockReturnValue({ detail: { match_id: "B", locked: true } as any, loading: false, error: null });
    render(<PickCardExpanded pick={vm} />);
    expect(screen.getByText("Vince l'Inter")).toBeInTheDocument();
    expect(screen.queryByText("Esiti principali")).toBeNull();
  });
  it("completo: mostra gruppi + Modello vs Mercato + soft Pro-lock", () => {
    mockDetail.mockReturnValue({ detail: richDetail, loading: false, error: null });
    render(<PickCardExpanded pick={vm} />);
    expect(screen.getByText("Esiti principali")).toBeInTheDocument();
    expect(screen.getByText("Gol")).toBeInTheDocument();
    expect(screen.getByText(/Modello vs Mercato/i)).toBeInTheDocument();
    expect(screen.getByText(/Prova Pro/i)).toBeInTheDocument(); // soft locked
  });
  it("stato errore", () => {
    mockDetail.mockReturnValue({ detail: null, loading: false, error: "boom" });
    render(<PickCardExpanded pick={vm} />);
    expect(screen.getByText(/qualcosa è andato storto/i)).toBeInTheDocument();
  });
});
