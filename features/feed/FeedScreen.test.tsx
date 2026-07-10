import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PickCardVM } from "./pick-view-model";

const vm = (o: Partial<PickCardVM>): PickCardVM => ({
  id: "1", sport: "football", competition: "Serie A", kickoff: "2026-07-10T18:45:00Z",
  homeTeam: "Inter", awayTeam: "Verona", decision: "Vince l'Inter", odds: 1.55,
  confidenceScore: 78, why: null, hasValue: true, locked: false, ...o,
});

const mockUsePicks = vi.fn();
vi.mock("./use-picks", () => ({ usePicks: () => mockUsePicks() }));

import { FeedScreen } from "./FeedScreen";

describe("FeedScreen", () => {
  it("stato loading", () => {
    mockUsePicks.mockReturnValue({ picks: [], loading: true, error: null });
    render(<FeedScreen />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });
  it("stato errore", () => {
    mockUsePicks.mockReturnValue({ picks: [], loading: false, error: "boom" });
    render(<FeedScreen />);
    expect(screen.getByText(/riprova|errore/i)).toBeInTheDocument();
  });
  it("stato vuoto", () => {
    mockUsePicks.mockReturnValue({ picks: [], loading: false, error: null });
    render(<FeedScreen />);
    expect(screen.getByText(/nessun pick/i)).toBeInTheDocument();
  });
  it("rende i pick e il disclaimer", () => {
    mockUsePicks.mockReturnValue({ picks: [vm({ id: "a", confidenceScore: 60 }), vm({ id: "b", confidenceScore: 85 })], loading: false, error: null });
    render(<FeedScreen />);
    expect(screen.getAllByText("Vince l'Inter").length).toBe(2);
    expect(screen.getByText(/18\+/)).toBeInTheDocument();
  });
});
