import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchHeader } from "./MatchHeader";

describe("MatchHeader", () => {
  it("un solo h1 con entrambe le squadre, pick ed edge", () => {
    render(<MatchHeader sport="football" league="Serie A" home="Inter" away="Milan" kickoffLabel="Sun 21 · 20:45" pick="Inter to win" edgePct={6.4} />);
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent("Inter");
    expect(h1[0]).toHaveTextContent("Milan");
    expect(screen.getByText("Inter to win")).toBeInTheDocument();
    expect(screen.getByText(/\+6\.4/)).toHaveAttribute("data-tone", "pos");
    expect(screen.getByText("Sun 21 · 20:45")).toBeInTheDocument();
  });
  it("live: badge col minuto e punteggio", () => {
    render(<MatchHeader sport="football" league={null} home="A" away="B" isLive liveMinute={71} score={{ home: 2, away: 1 }} pick="A" edgePct={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("Live");
    expect(screen.getByText("71′")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("2");
  });
  it("locked: Pro pick e lucchetto sull'edge", () => {
    render(<MatchHeader sport="tennis" league="ATP" home="Sinner" away="Alcaraz" pick="Sinner" edgePct={8} locked />);
    expect(screen.getByText("Pro pick")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toHaveAttribute("data-tone", "locked");
  });
});
