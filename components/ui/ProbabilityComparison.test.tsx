import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProbabilityComparison } from "./ProbabilityComparison";

describe("ProbabilityComparison", () => {
  it("MODEL | MARKET | EDGE nell'ordine, con la barra del gap", () => {
    render(<ProbabilityComparison modelPct={64} marketPct={52} edgePct={12} size="lg" />);
    const labels = screen.getAllByText(/^(Model|Market|Edge)$/).map((el) => el.textContent);
    expect(labels).toEqual(["Model", "Market", "Edge"]);
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.getByText("52")).toBeInTheDocument();
    expect(screen.getByText(/\+12\.0/)).toHaveAttribute("data-tone", "pos");
    const bar = screen.getByRole("img", { name: /model 64%, market 52%, edge \+12\.0 points/i });
    const gap = bar.querySelector(".br-prob__bar-gap") as HTMLElement;
    expect(gap).toHaveAttribute("data-tone", "pos");
    expect(gap.style.left).toBe("52%");
    expect(gap.style.width).toBe("12%");
  });
  it("senza mercato: mercato ed edge «—», nessun gap disegnato", () => {
    render(<ProbabilityComparison modelPct={58} marketPct={null} edgePct={7} />);
    const root = screen.getByRole("img", { name: /no market price, no edge claimed/i }).parentElement!;
    expect(root).toHaveAttribute("data-market", "none");
    expect(root.querySelectorAll(".br-prob__bar-gap")).toHaveLength(0);
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
  it("locked: lo slot edge mostra Pro", () => {
    render(<ProbabilityComparison modelPct={60} marketPct={50} edgePct={10} locked />);
    expect(screen.getByText("Pro")).toHaveAttribute("data-tone", "locked");
  });
});
