import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchHeader } from "./MatchHeader";

describe("MatchHeader", () => {
  it("un solo h1 con entrambe le squadre, e il pick sotto", () => {
    render(<MatchHeader sport="football" league="Serie A" home="Inter" away="Milan" kickoffLabel="Sun 21 · 20:45" pick="Inter to win" />);
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent("Inter");
    expect(h1[0]).toHaveTextContent("Milan");
    expect(screen.getByText("Inter to win")).toBeInTheDocument();
    expect(screen.getByText("Sun 21 · 20:45")).toBeInTheDocument();
  });
  it("live: badge col minuto e punteggio", () => {
    render(<MatchHeader sport="football" league={null} home="A" away="B" isLive liveMinute={71} score={{ home: 2, away: 1 }} pick="A" />);
    expect(screen.getByRole("status")).toHaveTextContent("Live");
    expect(screen.getByText("71′")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("2");
  });
  it("locked: Pro pick al posto del nome", () => {
    render(<MatchHeader sport="tennis" league="ATP" home="Sinner" away="Alcaraz" pick="P1" locked />);
    expect(screen.getByText("Pro pick")).toBeInTheDocument();
    expect(screen.queryByText("P1")).toBeNull();
  });
  // #RESTYLING-0921 round 14 — Andrea: «le chip negative non vanno bene e non
  // deve esserci più nessun riferimento nelle schede per quanto riguarda il
  // market, solo modello». Il chip dell'edge accanto al pick era l'ultimo
  // numero di mercato della testata: non deve poter tornare di nascosto.
  it("nessun chip dell'edge accanto al pick, in nessuno stato", () => {
    const { container } = render(
      <MatchHeader sport="football" league="Serie A" home="Inter" away="Milan" pick="Inter to win" />,
    );
    expect(container.querySelectorAll(".br-edge")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/[+−-]\d+[.,]\d/);
  });
});
