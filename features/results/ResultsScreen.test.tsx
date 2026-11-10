import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./use-track-record", () => ({ useTrackRecord: vi.fn() }));

import { useTrackRecord } from "./use-track-record";
import { ResultsScreen } from "./ResultsScreen";

const mockedUseTrackRecord = vi.mocked(useTrackRecord);

describe("ResultsScreen", () => {
  it("keeps Track record and Results navigation without loading the retired leaderboard", () => {
    mockedUseTrackRecord.mockReturnValue({ history: [], stats: null, loading: false, error: null });

    render(<ResultsScreen />);

    expect(screen.getByRole("heading", { level: 2, name: /track record/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: /classifica/i })).not.toBeInTheDocument();

    const link = screen.getByRole("link", { name: /risultati/i });
    expect(link).toHaveAttribute("aria-current", "page");

    expect(screen.getAllByText(/18\+/).length).toBe(1);
  });
});
