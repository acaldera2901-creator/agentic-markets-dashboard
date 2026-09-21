import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EdgeBadge } from "./EdgeBadge";

describe("EdgeBadge", () => {
  it("edge positivo: tono pos, segno +", () => {
    render(<EdgeBadge edgePct={12} size="lg" />);
    const el = screen.getByText(/\+12\.0/);
    expect(el).toHaveAttribute("data-tone", "pos");
    expect(el).toHaveAttribute("data-size", "lg");
  });
  it("edge negativo usa il meno tipografico", () => {
    render(<EdgeBadge edgePct={-2.3} />);
    expect(screen.getByText(/−2\.3/)).toHaveAttribute("data-tone", "neg");
  });
  it("senza mercato non dichiara nulla", () => {
    render(<EdgeBadge edgePct={null} />);
    const el = screen.getByLabelText(/no market price/i);
    expect(el).toHaveAttribute("data-tone", "none");
    expect(el.textContent).toBe("—");
  });
  it("locked mostra Pro", () => {
    render(<EdgeBadge edgePct={9} locked />);
    expect(screen.getByText("Pro")).toHaveAttribute("data-tone", "locked");
  });
});
