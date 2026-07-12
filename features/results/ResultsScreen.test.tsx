import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./use-track-record", () => ({ useTrackRecord: vi.fn() }));
vi.mock("./use-leaderboard", () => ({ useLeaderboard: vi.fn() }));

import { useTrackRecord } from "./use-track-record";
import { useLeaderboard } from "./use-leaderboard";
import { ResultsScreen } from "./ResultsScreen";

const mockedUseTrackRecord = vi.mocked(useTrackRecord);
const mockedUseLeaderboard = vi.mocked(useLeaderboard);

describe("ResultsScreen", () => {
  it("compone Track record + Classifica + BottomNav attivo su Risultati", () => {
    mockedUseTrackRecord.mockReturnValue({ history: [], stats: null, loading: false, error: null });
    mockedUseLeaderboard.mockReturnValue({
      entries: [], systemHitRate: null, systemSettled: 0, pointsPerWin: 0, loading: false, error: null,
    });

    render(<ResultsScreen />);

    expect(screen.getByRole("heading", { level: 2, name: /track record/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /classifica/i })).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /risultati/i });
    expect(link).toHaveAttribute("aria-current", "page");

    expect(screen.getAllByText(/18\+/).length).toBe(1);
  });
});
