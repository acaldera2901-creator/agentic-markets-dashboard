import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PickCardVM } from "./pick-view-model";

const vm = (o: Partial<PickCardVM>): PickCardVM => ({
  id: "1", sport: "football", competition: "Serie A", kickoff: "2026-07-10T18:45:00Z",
  homeTeam: "Inter", awayTeam: "Verona", decision: "Vince l'Inter", odds: 1.55,
  confidenceScore: 78, why: null, hasValue: true, locked: false, externalEventId: null, ...o,
});

const mockUsePicks = vi.fn();
vi.mock("./use-picks", () => ({ usePicks: () => mockUsePicks() }));
vi.mock("./use-match-detail", () => ({ useMatchDetail: () => ({ detail: null, loading: false, error: null }) }));

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
  it("mette il pick del giorno (confidenza più alta) in cima e lo marca", () => {
    mockUsePicks.mockReturnValue({
      picks: [
        vm({ id: "a", confidenceScore: 60, decision: "Vince l'Inter", homeTeam: "Inter", awayTeam: "Verona" }),
        vm({ id: "b", confidenceScore: 85, decision: "Vince il Napoli", homeTeam: "Napoli", awayTeam: "Roma" }),
      ],
      loading: false,
      error: null,
    });
    const { container } = render(<FeedScreen />);
    // esattamente una card marcata come pick del giorno
    const heroes = container.querySelectorAll('[data-hero="true"]');
    expect(heroes).toHaveLength(1);
    // il pick del giorno (Napoli, conf 85) compare PRIMA dell'altro nel DOM
    const text = container.textContent ?? "";
    expect(text.indexOf("Napoli")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("Napoli")).toBeLessThan(text.indexOf("Inter"));
  });
  it("apre la scheda (Sheet) al click su 'Perché questa previsione'", async () => {
    mockUsePicks.mockReturnValue({ picks: [vm({ id: "a", locked: false })], loading: false, error: null });
    render(<FeedScreen />);
    await userEvent.click(screen.getByRole("button", { name: /perché questa previsione/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
