import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #WC-GEO-GATE (Decreto Dignità, D.L. 87/2018 art.9 — A2-B1/A2-B2): WcBoard must
// never surface the FortunePlay sportsbook link/quota to a geo-blocked (IT)
// viewer. Mirrors the football board's booksBlocked gate (app/app/page.tsx),
// sourced from the same server-side /api/geo-books endpoint.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

import WcBoard from "./WcBoard";

const ROW = {
  id: "wc-test-1",
  home_team: "Italy",
  away_team: "Brazil",
  league: "World Cup",
  starts_at: "2026-07-15T18:00:00Z",
  locked: false,
  pick: "HOME",
  notes: JSON.stringify({
    p_home: 0.5, p_draw: 0.25, p_away: 0.25,
    odds_home: 2.1, odds_draw: 3.2, odds_away: 3.5,
  }),
  confidence_score: 60,
  signal_type: "signal",
  edge_percent: 4,
};

function mockFetch(blocked: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/geo-books")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ blocked }) } as Response);
      }
      if (url.includes("/api/v2/predictions")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ predictions: [ROW] }) } as Response);
      }
      if (url.includes("/api/fortuneplay-odds")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ odds: {} }) } as Response);
      }
      if (url.includes("/api/live")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ live: {} }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }),
  );
}

async function openCard() {
  const card = await screen.findByText(/Programmato|Scheduled/i).then((el) => el.closest(".pred"));
  expect(card).toBeTruthy();
  await userEvent.click(card as HTMLElement);
}

describe("WcBoard — geo-gate sportsbook link (Decreto Dignità)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("IT (geo-books blocked) viewer never sees the FortunePlay bet link", async () => {
    mockFetch(true);
    render(<WcBoard />);
    await openCard();
    expect(screen.queryByText(/piazza scommessa|place bet/i)).not.toBeInTheDocument();
    expect(document.querySelector(".betbtn")).not.toBeInTheDocument();
    // model read-out (pronostico) still renders — only the book link is gated.
    expect(screen.getAllByText(/Italy/i).length).toBeGreaterThan(0);
  });

  it("non-IT (geo-books not blocked) viewer keeps the FortunePlay bet link", async () => {
    mockFetch(false);
    render(<WcBoard />);
    await openCard();
    expect(await screen.findByText(/piazza scommessa|place bet/i)).toBeInTheDocument();
    expect(document.querySelector(".betbtn")).toBeInTheDocument();
  });
});
