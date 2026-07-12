import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeaderboardView } from "./LeaderboardView";
import { useLeaderboard } from "./use-leaderboard";
import type { LbRow, UseLeaderboardResult } from "./use-leaderboard";

vi.mock("./use-leaderboard", () => ({ useLeaderboard: vi.fn() }));

const mockedUseLeaderboard = vi.mocked(useLeaderboard);

const rows: LbRow[] = [
  { rank: 1, name: "Andrea", points: 340, betsWon: 17, betsTotal: 20, hitRate: 85, sport: null },
  { rank: 2, name: "Michele", points: 290, betsWon: 14, betsTotal: 20, hitRate: 70, sport: null },
  { rank: 3, name: "Luca", points: 210, betsWon: 10, betsTotal: 18, hitRate: 56, sport: null },
  { rank: 4, name: "Sara", points: 180, betsWon: 9, betsTotal: 17, hitRate: 53, sport: null },
];

const rowsStringHitRate: LbRow[] = [
  { rank: 5, name: "Marco", points: 150, betsWon: 8, betsTotal: 16, hitRate: "50.0%", sport: null },
];

function mock(overrides: Partial<UseLeaderboardResult>) {
  mockedUseLeaderboard.mockReturnValue({
    entries: overrides.entries ?? [],
    systemHitRate: overrides.systemHitRate ?? null,
    systemSettled: overrides.systemSettled ?? 0,
    pointsPerWin: overrides.pointsPerWin ?? 0,
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
  });
}

beforeEach(() => { vi.restoreAllMocks(); });

describe("LeaderboardView", () => {
  it("rende ogni riga con rank, nome, punti e hit-rate (numeric API shape)", () => {
    mock({ entries: rows });
    render(<LeaderboardView />);
    expect(screen.getByText("Andrea")).toBeInTheDocument();
    expect(screen.getByText("340")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("Michele")).toBeInTheDocument();
    expect(screen.getByText("290")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("Sara")).toBeInTheDocument();
    expect(screen.getByText("180")).toBeInTheDocument();
  });

  it("rende hit-rate come stringa se passato come string", () => {
    mock({ entries: rowsStringHitRate });
    render(<LeaderboardView />);
    expect(screen.getByText("50.0%")).toBeInTheDocument();
  });

  it("mostra il system hit-rate formattato quando systemSettled >= 30", () => {
    mock({ entries: rows, systemHitRate: 62, systemSettled: 30 });
    render(<LeaderboardView />);
    expect(screen.getByText("62%")).toBeInTheDocument();
  });

  it("nasconde il system hit-rate quando systemSettled < 30 (nessuna percentuale di sistema)", () => {
    mock({ entries: rows, systemHitRate: 62, systemSettled: 29 });
    render(<LeaderboardView />);
    expect(screen.queryByText("62%")).toBeNull();
    expect(screen.getByText(/dati insufficienti/i)).toBeInTheDocument();
  });

  it("stato loading", () => {
    mock({ loading: true });
    render(<LeaderboardView />);
    expect(screen.getByText(/Caricamento/i)).toBeInTheDocument();
  });

  it("stato empty", () => {
    mock({ entries: [] });
    render(<LeaderboardView />);
    expect(screen.getByText(/Nessun/i)).toBeInTheDocument();
  });

  it("non mostra mai testo relativo a soldi/pnl/roi", () => {
    mock({ entries: rows, systemHitRate: 62, systemSettled: 40 });
    const { container } = render(<LeaderboardView />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/pnl|profit|roi|€|\$|payout|stake/i);
  });

  it("stato error — mostra messaggio e copia retry", () => {
    mock({ entries: [], error: "boom" });
    render(<LeaderboardView />);
    expect(screen.getByText(/Qualcosa è andato storto/i)).toBeInTheDocument();
    expect(screen.getByText(/Riprova/i)).toBeInTheDocument();
  });

  it("rank 1–3 hanno data-top3='true', rank >= 4 no", () => {
    mock({ entries: rows });
    const { container } = render(<LeaderboardView />);

    // Rank 1, 2, 3 dovrebbero avere data-top3="true"
    const top3Badges = container.querySelectorAll('[data-top3="true"]');
    expect(top3Badges).toHaveLength(3);

    // Rank 4 non dovrebbe avere data-top3="true"
    const rankBadges = container.querySelectorAll('span[style*="inline-flex"]');
    const rank4Badge = rankBadges[3]; // fourth badge
    expect(rank4Badge).not.toHaveAttribute('data-top3', 'true');
  });
});
