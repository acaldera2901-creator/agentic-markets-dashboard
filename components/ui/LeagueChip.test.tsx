import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeagueChip } from "./LeagueChip";

describe("LeagueChip", () => {
  it("rende la lega senza cornice (data-kind league)", () => {
    render(<LeagueChip league="Premier League" />);
    expect(screen.getByText("Premier League")).toHaveAttribute("data-kind", "league");
  });
  it("lega assente → non rende nulla", () => {
    const { container } = render(<LeagueChip league={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
